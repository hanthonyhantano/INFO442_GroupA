-- The inventory and batch cut selectors read from cow_parts.
-- Add the option without changing any existing cuts or inventory.
begin;

insert into public.cow_parts (name, description, cooking_tags, inventory_group)
select 'Ground', 'Ground beef for burgers, meatballs, and skillet dishes.',
       chuck.cooking_tags, chuck.inventory_group
from public.cow_parts chuck
where lower(chuck.name) = 'chuck'
  and not exists (
    select 1 from public.cow_parts existing
    where lower(existing.name) in ('ground', 'ground beef')
  )
order by chuck.id
limit 1;

commit;
