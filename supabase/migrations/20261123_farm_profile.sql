-- Producer accounts are provisioned with a trusted app_metadata.farm_id by an administrator.
begin;
alter table public.farms add column if not exists profile_version integer not null default 0;

create or replace function public.save_farm_profile(profile jsonb, expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  farm_key public.farms.id%type := (auth.jwt()->'app_metadata'->>'farm_id')::bigint;
  current_version integer;
  z public.delivery_zones%rowtype;
  p public.pickup_locations%rowtype;
  j jsonb;
  result jsonb;
  weekdays text[] := array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
begin
  if auth.uid() is null or farm_key is null or farm_key::text is distinct from profile->>'id' then
    raise exception 'Producer farm assignment required' using errcode='42501';
  end if;
  select profile_version into strict current_version from public.farms where id=farm_key for update;
  if current_version is distinct from expected_version then
    raise exception 'This profile changed. Reload before saving.' using errcode='40001';
  end if;
  if nullif(trim(profile->>'name'),'') is null or nullif(trim(profile->>'town'),'') is null
     or not (coalesce((profile->>'pickup_enabled')::boolean,false) or coalesce((profile->>'delivery_enabled')::boolean,false))
     or (coalesce(profile->>'contact_email','') <> '' and profile->>'contact_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     or (coalesce(profile->>'contact_phone','') <> '' and (profile->>'contact_phone' !~ '^[0-9 ()+.-]+$'
         or length(regexp_replace(profile->>'contact_phone','[^0-9]','','g')) <> 10))
     or coalesce((profile->>'delivery_minimum')::numeric,0)<0 or coalesce((profile->>'delivery_lead_time_days')::integer,0)<0
     or jsonb_typeof(profile->'farm_photos') is distinct from 'array' or jsonb_array_length(profile->'farm_photos')>4
     or jsonb_typeof(profile->'delivery_zones') is distinct from 'array'
     or jsonb_typeof(profile->'pickup_locations') is distinct from 'array' then
    raise exception 'Invalid farm profile';
  end if;

  -- Keep existing location IDs so saved orders continue to reference their pickup.
  if exists(select 1 from public.orders o join public.pickup_locations l on l.id=o.pickup_location_id
            where l.farm_id=farm_key and not exists(select 1 from jsonb_array_elements(profile->'pickup_locations') e where e->>'id'=l.id::text)) then
    raise exception 'This pickup location is used by an order';
  end if;
  delete from public.pickup_locations l where l.farm_id=farm_key and not exists
    (select 1 from jsonb_array_elements(profile->'pickup_locations') e where e->>'id'=l.id::text);
  delete from public.delivery_zones d where d.farm_id=farm_key and not exists
    (select 1 from jsonb_array_elements(profile->'delivery_zones') e where e->>'id'=d.id::text);

  for j in select value from jsonb_array_elements(profile->'delivery_zones') loop
    z := jsonb_populate_record(null::public.delivery_zones,j);
    if nullif(trim(z.name),'') is null or z.fee is null or z.fee < 0 or coalesce(cardinality(z.zip_codes),0)=0
       or exists(select 1 from unnest(z.zip_codes) code where code is null or code !~ '^[0-9]{5}$')
       or coalesce(cardinality(z.delivery_days),0)=0 or not z.delivery_days::text[] <@ weekdays then raise exception 'Invalid delivery zone'; end if;
    if z.id is null then
      insert into public.delivery_zones(farm_id,name,delivery_days,zip_codes,fee) values(farm_key,z.name,z.delivery_days,z.zip_codes,z.fee);
    else
      update public.delivery_zones set name=z.name,delivery_days=z.delivery_days,zip_codes=z.zip_codes,fee=z.fee where id=z.id and farm_id=farm_key;
      if not found then raise exception 'Unknown delivery zone'; end if;
    end if;
  end loop;
  for j in select value from jsonb_array_elements(profile->'pickup_locations') loop
    p := jsonb_populate_record(null::public.pickup_locations,j);
    if nullif(trim(p.name),'') is null or nullif(trim(p.address),'') is null or nullif(trim(p.times),'') is null
       or coalesce(cardinality(p.days),0)=0 or not p.days::text[] <@ weekdays then raise exception 'Invalid pickup location'; end if;
    if p.id is null then
      insert into public.pickup_locations(farm_id,name,address,days,times) values(farm_key,p.name,p.address,p.days,p.times);
    else
      update public.pickup_locations set name=p.name,address=p.address,days=p.days,times=p.times where id=p.id and farm_id=farm_key;
      if not found then raise exception 'Unknown pickup location'; end if;
    end if;
  end loop;

  delete from public.farm_photos where farm_id=farm_key;
  insert into public.farm_photos(farm_id,image,position)
    select farm_key,photo->>'image',ordinal-1 from jsonb_array_elements(profile->'farm_photos') with ordinality as photos(photo,ordinal);
  update public.farms set name=trim(profile->>'name'),town=trim(profile->>'town'),state=profile->>'state',
    story=profile->>'story',cover_photo=profile->>'cover_photo',practices=array(select jsonb_array_elements_text(profile->'practices')),
    contact_email=profile->>'contact_email',contact_phone=profile->>'contact_phone',
    delivery_enabled=(profile->>'delivery_enabled')::boolean,pickup_enabled=(profile->>'pickup_enabled')::boolean,
    delivery_minimum=(profile->>'delivery_minimum')::numeric,delivery_lead_time_days=(profile->>'delivery_lead_time_days')::integer,
    delivery_zips=array(select distinct unnest(zip_codes) from public.delivery_zones where farm_id=farm_key),
    profile_version=profile_version+1 where id=farm_key;
  select to_jsonb(f) || jsonb_build_object(
    'delivery_zones',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.delivery_zones d where d.farm_id=farm_key),'[]'::jsonb),
    'pickup_locations',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.pickup_locations l where l.farm_id=farm_key),'[]'::jsonb),
    'farm_photos',coalesce((select jsonb_agg(to_jsonb(i) order by i.position) from public.farm_photos i where i.farm_id=farm_key),'[]'::jsonb))
    into result from public.farms f where f.id=farm_key;
  return result;
end $$;
revoke all on function public.save_farm_profile(jsonb,integer) from public,anon;
grant execute on function public.save_farm_profile(jsonb,integer) to authenticated;
commit;
