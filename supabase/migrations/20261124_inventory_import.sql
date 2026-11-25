begin;

create table if not exists public.inventory_import_requests (
  user_id uuid not null,
  request_id uuid not null,
  farm_id bigint not null references public.farms(id),
  plan jsonb not null,
  primary key (user_id, request_id)
);
alter table public.inventory_import_requests enable row level security;
revoke all on public.inventory_import_requests from public, anon, authenticated;

create or replace function public.import_farm_inventory(farm_key bigint, plan jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  rid uuid := (plan->>'requestId')::uuid;
  prior public.inventory_import_requests%rowtype;
  item jsonb;
  existing public.cuts%rowtype;
  part public.cow_parts%rowtype;
  previous jsonb;
  target_batch public.batches.id%type := (plan->>'batchId')::bigint;
  qty integer;
  price numeric;
  weight numeric;
  allocated integer;
begin
  if actor is null or farm_key is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or farm_key::text is distinct from auth.jwt()->'app_metadata'->>'farm_id' then
    raise exception 'Producer farm assignment required' using errcode='42501';
  end if;
  if rid is null or jsonb_typeof(plan->'cuts') is distinct from 'array'
     or jsonb_array_length(plan->'cuts') not between 1 and 1000 then
    raise exception 'Choose between 1 and 1000 valid rows.';
  end if;
  -- Serialize imports for this farm, including two first attempts for a new product.
  perform id from public.farms where id=farm_key for update;
  if not found then raise exception 'Farm not found.'; end if;
  select * into prior from public.inventory_import_requests where user_id=actor and request_id=rid;
  if found then
    if prior.farm_id<>farm_key or prior.plan<>plan then raise exception 'This request was already used for a different import.'; end if;
    return jsonb_array_length(prior.plan->'cuts');
  end if;
  if exists (select 1 from jsonb_array_elements(plan->'cuts') x group by lower(trim(x->>'name')) having count(*)>1) then
    raise exception 'Duplicate product name in file.';
  end if;
  if exists (select 1 from jsonb_array_elements(plan->'cuts') x where x->>'id' is null) then
    perform id from public.batches where id=target_batch and farm_id=farm_key for key share;
    if not found then raise exception 'Choose a batch belonging to your farm.'; end if;
  end if;
  -- Checkout and imports lock existing cuts in the same order.
  perform c.id from public.cuts c where c.farm_id=farm_key and c.id in
    (select (x->>'id')::bigint from jsonb_array_elements(plan->'cuts') x) order by c.id for update;
  for item in select value from jsonb_array_elements(plan->'cuts') loop
    if nullif(trim(item->>'name'),'') is null or coalesce(item->>'onHand','') !~ '^[0-9]+$'
       or jsonb_typeof(item->'pricePerPound') is distinct from 'number'
       or jsonb_typeof(item->'poundsPerPackage') is distinct from 'number' then
      raise exception 'Check product name, quantity, price and package weight.';
    end if;
    qty := (item->>'onHand')::integer;
    price := (item->>'pricePerPound')::numeric;
    weight := (item->>'poundsPerPackage')::numeric;
    if price<=0 or weight<=0 then raise exception 'Price and weight must be positive.'; end if;
    select * into strict part from public.cow_parts where lower(name)=lower(item->>'part');
    if exists(select 1 from public.cuts c where c.farm_id=farm_key and lower(trim(c.name))=lower(trim(item->>'name'))
      and c.id is distinct from (item->>'id')::bigint) then raise exception 'Inventory names changed. Review the matching cut.'; end if;
    if item->>'id' is null then
      insert into public.cuts(farm_id,batch_id,cow_part_id,name,packages_on_hand,total,price_per_pound,pounds_per_package,is_live,is_featured)
      values(farm_key,target_batch,part.id,trim(item->>'name'),qty,qty,price,weight,false,false);
    else
      select * into existing from public.cuts where farm_id=farm_key and id=(item->>'id')::bigint;
      if not found or lower(trim(existing.name))<>lower(trim(item->>'name')) then raise exception 'Inventory changed. Review the matching cut.'; end if;
      previous := item->'previous';
      if existing.packages_on_hand is distinct from (previous->>'onHand')::integer
        or existing.price_per_pound is distinct from (previous->>'pricePerPound')::numeric
        or existing.pounds_per_package is distinct from (previous->>'poundsPerPackage')::numeric
        or (select name from public.cow_parts where id=existing.cow_part_id) is distinct from previous->>'part'
        then raise exception 'Inventory changed since review. Check the refreshed quantities and prices.'; end if;
      select reserved into strict allocated from public.cut_stock where id=existing.id;
      if qty<allocated and qty<>existing.packages_on_hand then raise exception 'Qty cannot be below packages reserved for orders.'; end if;
      update public.cuts set cow_part_id=part.id,packages_on_hand=qty,price_per_pound=price,pounds_per_package=weight where id=existing.id;
    end if;
  end loop;
  insert into public.inventory_import_requests values (actor,rid,farm_key,plan);
  return jsonb_array_length(plan->'cuts');
end $$;
revoke all on function public.import_farm_inventory(bigint,jsonb) from public,anon;
grant execute on function public.import_farm_inventory(bigint,jsonb) to authenticated;
commit;
