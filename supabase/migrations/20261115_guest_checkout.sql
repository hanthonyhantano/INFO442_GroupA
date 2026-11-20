-- Apply in a development Supabase project first. Existing orders/order_items
-- columns were verified through the public API; no production changes were applied.
begin;
create table if not exists public.checkout_requests (
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.checkout_requests enable row level security;
revoke all on public.checkout_requests from anon, authenticated;

create or replace function public.submit_guest_checkout(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rid uuid := (payload->>'requestId')::uuid;
  cart public.carts%rowtype;
  cut public.cuts%rowtype;
  farm public.farms%rowtype;
  item jsonb;
  choice jsonb;
  oid public.orders.id%type;
  pickup public.pickup_locations.id%type;
  qty integer;
  subtotal numeric;
  fee numeric;
  result jsonb;
  receipts jsonb := '[]'::jsonb;
  fname text := trim(payload->'contact'->>'name');
  email text := trim(payload->'contact'->>'email');
  address text := trim(payload->'contact'->>'address');
begin
  if uid is null or rid is null then raise exception 'Guest session required'; end if;
  -- Serialize submissions from the same shopper, including duplicate retries.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select receipt into result from public.checkout_requests where user_id=uid and request_id=rid;
  if found then return result; end if;
  if coalesce(fname,'') = '' or length(fname)>200 or coalesce(email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid contact information'; end if;
  if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Invalid cart'; end if;
  select * into strict cart from public.carts where user_id=uid for update;
  if (select count(*) from public.cart_items where cart_id=cart.id) <> jsonb_array_length(payload->'items') then raise exception 'Cart changed. Review your cart'; end if;
  if (select count(distinct value->>'cutId') from jsonb_array_elements(payload->'items')) <> jsonb_array_length(payload->'items') then raise exception 'Duplicate cuts'; end if;
  -- Lock cuts in stable order. All checkout writes below run in one transaction.
  perform 1 from public.cuts where id in (select (value->>'cutId')::bigint from jsonb_array_elements(payload->'items')) order by id for update;
  for item in select value from jsonb_array_elements(payload->'items') loop
    if coalesce(item->>'quantity','') !~ '^[1-9][0-9]*$' then raise exception 'Invalid quantity'; end if;
    qty := (item->>'quantity')::integer;
    select * into strict cut from public.cuts where id=(item->>'cutId')::bigint;
    if qty<1 or not cut.is_live or qty>cut.packages_on_hand-coalesce(cut.held,0) then raise exception 'Stock changed. Review your cart'; end if;
    if not exists(select 1 from public.cart_items where cart_id=cart.id and id=(item->>'cartItemId')::bigint and cut_id=cut.id and quantity=qty) then raise exception 'Cart changed. Review your cart'; end if;
  end loop;
  for farm in select * from public.farms where id in (select c.farm_id from public.cuts c join public.cart_items ci on ci.cut_id=c.id where ci.cart_id=cart.id) order by id loop
    choice := payload->'fulfillment'->farm.id::text;
    select sum(ci.quantity*c.price_per_pound*c.pounds_per_package) into subtotal from public.cart_items ci join public.cuts c on c.id=ci.cut_id where ci.cart_id=cart.id and c.farm_id=farm.id;
    pickup := null; fee := 0;
    if choice->>'method'='pickup' then
      pickup := (choice->>'pickupId')::bigint;
      if not farm.pickup_enabled or not exists(select 1 from public.pickup_locations where id=pickup and farm_id=farm.id) then raise exception 'Select a valid pickup location'; end if;
    elsif choice->>'method'='delivery' then
      if not farm.delivery_enabled or coalesce(address,'')='' or subtotal<coalesce(farm.delivery_minimum,0) then raise exception 'Delivery unavailable or minimum not met'; end if;
      select min(z.fee) into fee from public.delivery_zones z where z.farm_id=farm.id and (payload->'contact'->>'zip')=any(z.zip_codes);
      if fee is null then raise exception 'ZIP is outside delivery area'; end if;
    else raise exception 'Choose pickup or delivery for each farm'; end if;
    insert into public.orders(order_number,farm_id,shopper_name,shopper_email,shopper_phone,fulfillment_method,delivery_address,pickup_location_id,status)
    values ('CC-'||rid::text||'-'||farm.id::text,farm.id,fname,email,nullif(payload->'contact'->>'phone',''),choice->>'method',case when choice->>'method'='delivery' then address||', '||(payload->'contact'->>'zip') else null end,pickup,'new') returning id into oid;
    insert into public.order_items(order_id,cut_id,quantity,price_per_pound,pounds_per_package)
    select oid,c.id,ci.quantity,c.price_per_pound,c.pounds_per_package from public.cart_items ci join public.cuts c on c.id=ci.cut_id where ci.cart_id=cart.id and c.farm_id=farm.id;
    receipts := receipts || jsonb_build_array(jsonb_build_object('id',oid,'farmName',farm.name,'estimatedTotal',subtotal+fee,'method',choice->>'method','deliveryFee',fee));
  end loop;
  -- Do not decrement on-hand stock: New orders reserve packages as held.
  -- Recompute rather than increment so existing held-maintenance triggers agree.
  update public.cuts c set held=(select coalesce(sum(oi.quantity),0) from public.order_items oi join public.orders o on o.id=oi.order_id where oi.cut_id=c.id and o.status='new') where c.id in (select cut_id from public.cart_items where cart_id=cart.id);
  delete from public.cart_items where cart_id=cart.id;
  result := jsonb_build_object('orders',receipts);
  insert into public.checkout_requests(user_id,request_id,receipt) values(uid,rid,result);
  return result;
end $$;
revoke all on function public.submit_guest_checkout(jsonb) from public, anon;
grant execute on function public.submit_guest_checkout(jsonb) to authenticated;
commit;
