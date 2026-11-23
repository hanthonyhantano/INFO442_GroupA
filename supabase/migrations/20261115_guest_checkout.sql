-- Install after the package-size migration and the producer order stock schema.
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
  farm public.farms%rowtype;
  choice jsonb;
  oid public.orders.id%type;
  order_ref public.orders.order_number%type;
  pickup public.pickup_locations.id%type;
  subtotal numeric;
  fee numeric;
  lines jsonb;
  receipt jsonb;
  receipts jsonb := '[]'::jsonb;
  fname text := trim(payload->'contact'->>'name');
  email text := trim(payload->'contact'->>'email');
  address text := trim(payload->'contact'->>'address');
  zip text := payload->'contact'->>'zip';
begin
  if uid is null or rid is null then
    raise exception 'Guest session required';
  end if;

  -- Serialize a shopper's requests so a lost response can be retried safely.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select r.receipt into receipt from public.checkout_requests r
  where r.user_id = uid and r.request_id = rid;
  if found then return receipt; end if;

  if coalesce(fname, '') = '' or length(fname) > 200
     or coalesce(email, '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid contact information';
  end if;
  if jsonb_typeof(payload->'items') is distinct from 'array' then
    raise exception 'Invalid cart';
  end if;
  if jsonb_array_length(payload->'items') not between 1 and 100 then
    raise exception 'Invalid cart';
  end if;

  select * into cart from public.carts where user_id = uid for update;
  if not found then raise exception 'Cart changed. Review your cart'; end if;
  perform ci.id from public.cart_items ci where ci.cart_id = cart.id
  order by ci.id for update;

  -- The same cut may occur on different rows. Require one matching payload
  -- entry per owned cart row, including the package size the shopper reviewed.
  if (select count(*) from public.cart_items ci where ci.cart_id = cart.id)
       <> jsonb_array_length(payload->'items')
     or (select count(distinct item->>'cartItemId')
         from jsonb_array_elements(payload->'items') as entry(item))
       <> jsonb_array_length(payload->'items')
     or exists (
       select 1 from jsonb_array_elements(payload->'items') as entry(item)
       where not exists (
         select 1 from public.cart_items ci
         where ci.cart_id = cart.id and ci.id::text = item->>'cartItemId'
           and ci.cut_id::text = item->>'cutId' and ci.quantity > 0
           and to_jsonb(ci.quantity) = item->'quantity'
           and ci.pack_size_lb > 0 and ci.pack_size_lb < 'Infinity'::numeric
           and to_jsonb(ci.pack_size_lb) = item->'packSizeLb'
       )
     ) then
    raise exception 'Cart changed. Review your cart';
  end if;

  -- Serialize competing submissions for a cut before checking their combined quantity.
  perform c.id from public.cuts c
  where c.id in (select ci.cut_id from public.cart_items ci where ci.cart_id = cart.id)
  order by c.id for update;
  if exists (
    select 1
    from public.cart_items ci
    join public.cuts c on c.id = ci.cut_id
    left join public.cut_stock s on s.id = c.id
    where ci.cart_id = cart.id
    group by c.id, c.is_live, c.packages_on_hand, c.held, s.reserved
    having c.is_live is not true
       or sum(ci.quantity) > greatest(
         coalesce(c.packages_on_hand, 0) - greatest(coalesce(c.held, 0), coalesce(s.reserved, 0)),
         0
       )
  ) then
    raise exception 'Stock changed. Review your cart';
  end if;

  for farm in
    select f.* from public.farms f
    where f.id in (
      select c.farm_id from public.cart_items ci join public.cuts c on c.id = ci.cut_id
      where ci.cart_id = cart.id
    ) order by f.id
  loop
    choice := payload->'fulfillment'->farm.id::text;
    select
      sum(ci.quantity * c.price_per_pound * ci.pack_size_lb),
      jsonb_agg(jsonb_build_object(
        'cartItemId', ci.id, 'name', c.name, 'quantity', ci.quantity,
        'lbsPerPackage', ci.pack_size_lb,
        'estimatedTotal', ci.quantity * c.price_per_pound * ci.pack_size_lb
      ) order by ci.id)
    into subtotal, lines
    from public.cart_items ci join public.cuts c on c.id = ci.cut_id
    where ci.cart_id = cart.id and c.farm_id = farm.id;

    pickup := null;
    fee := 0;
    if choice->>'method' = 'pickup' then
      select id into pickup from public.pickup_locations
      where id::text = choice->>'pickupId' and farm_id = farm.id;
      if farm.pickup_enabled is not true or pickup is null then
        raise exception 'Select a valid pickup location';
      end if;
    elsif choice->>'method' = 'delivery' then
      if farm.delivery_enabled is not true or coalesce(address, '') = ''
         or subtotal < coalesce(farm.delivery_minimum, 0) then
        raise exception 'Delivery unavailable or minimum not met';
      end if;
      select min(z.fee) into fee from public.delivery_zones z
      where z.farm_id = farm.id and zip = any(z.zip_codes);
      if coalesce(zip, '') !~ '^[0-9]{5}$' or fee is null then
        raise exception 'ZIP is outside delivery area';
      end if;
    else
      raise exception 'Choose pickup or delivery for each farm';
    end if;

    insert into public.orders(
      order_number, farm_id, shopper_name, shopper_email, shopper_phone,
      fulfillment_method, delivery_address, pickup_location_id, status
    )
    values (
      'CC-' || rid::text || '-' || farm.id::text, farm.id, fname, email,
      nullif(payload->'contact'->>'phone', ''), choice->>'method',
      case when choice->>'method' = 'delivery' then address || ', ' || zip end,
      pickup, 'new'
    )
    returning id, order_number into oid, order_ref;

    -- Use the producer order allocation fields and let its stock view account
    -- for the reservation. Do not overwrite existing holds on the cuts table.
    insert into public.order_items(
      order_id, cut_id, quantity, reserved_quantity, price_per_pound, pounds_per_package
    )
    select oid, c.id, ci.quantity, ci.quantity, c.price_per_pound, ci.pack_size_lb
    from public.cart_items ci join public.cuts c on c.id = ci.cut_id
    where ci.cart_id = cart.id and c.farm_id = farm.id;

    receipts := receipts || jsonb_build_array(jsonb_build_object(
      'id', oid, 'orderNumber', order_ref, 'farmName', farm.name, 'items', lines,
      'estimatedTotal', subtotal + fee, 'method', choice->>'method', 'deliveryFee', fee
    ));
  end loop;

  delete from public.cart_items where cart_id = cart.id;
  receipt := jsonb_build_object('orders', receipts);
  insert into public.checkout_requests(user_id, request_id, receipt) values (uid, rid, receipt);
  return receipt;
end $$;

revoke all on function public.submit_guest_checkout(jsonb) from public, anon;
grant execute on function public.submit_guest_checkout(jsonb) to authenticated;
commit;
