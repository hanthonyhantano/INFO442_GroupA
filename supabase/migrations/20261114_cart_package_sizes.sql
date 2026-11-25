-- Upgrade older carts to the row identity used by the multi-size cart.
begin;

alter table public.cart_items add column if not exists pack_size_lb numeric;

update public.cart_items ci
set pack_size_lb = c.pounds_per_package
from public.cuts c
where c.id = ci.cut_id and ci.pack_size_lb is null;

alter table public.cart_items alter column pack_size_lb set not null;

do $$
declare
  legacy record;
  cart_column smallint;
  cut_column smallint;
  size_column smallint;
begin
  select attnum into cart_column from pg_attribute
  where attrelid = 'public.cart_items'::regclass and attname = 'cart_id';
  select attnum into cut_column from pg_attribute
  where attrelid = 'public.cart_items'::regclass and attname = 'cut_id';

  for legacy in
    select conname from pg_constraint
    where conrelid = 'public.cart_items'::regclass and contype = 'u'
      and cardinality(conkey) = 2 and conkey @> array[cart_column, cut_column]
  loop
    execute format('alter table public.cart_items drop constraint %I', legacy.conname);
  end loop;

  -- Some projects installed the old pair as a standalone unique index.
  for legacy in
    select i.relname from pg_index x join pg_class i on i.oid = x.indexrelid
    where x.indrelid = 'public.cart_items'::regclass and x.indisunique
      and not x.indisprimary and x.indnkeyatts = 2 and x.indexprs is null
      and array[x.indkey[0], x.indkey[1]] @> array[cart_column, cut_column]
      and not exists (select 1 from pg_constraint where conindid = x.indexrelid)
  loop
    execute format('drop index public.%I', legacy.relname);
  end loop;
  select attnum into size_column from pg_attribute
    where attrelid='public.cart_items'::regclass and attname='pack_size_lb';
  if not exists (select 1 from pg_index i where i.indrelid='public.cart_items'::regclass
    and i.indisunique and i.indisvalid and i.indimmediate and i.indpred is null
    and i.indnkeyatts=3 and array[i.indkey[0],i.indkey[1],i.indkey[2]]
      @> array[cart_column,cut_column,size_column]) then
    create unique index cart_items_cart_cut_pack_size_uidx on public.cart_items(cart_id,cut_id,pack_size_lb);
  end if;
end $$;

commit;
