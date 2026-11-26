-- The selectors read cow_parts. Preserve existing Ground or Ground Beef rows.
begin;
lock table public.cow_parts in share row exclusive mode;
insert into public.cow_parts (name, description)
select 'Ground', 'Ground beef for burgers, meatballs, and skillet dishes.'
where not exists (
  select 1 from public.cow_parts where lower(trim(name)) in ('ground', 'ground beef')
);
commit;
