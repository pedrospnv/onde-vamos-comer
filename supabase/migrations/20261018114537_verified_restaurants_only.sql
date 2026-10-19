alter table public.restaurants
  add column if not exists image_attribution text,
  add column if not exists image_source_url text,
  add column if not exists menu_url text,
  add column if not exists price_source_url text,
  add column if not exists verified_at timestamptz;

comment on column public.restaurants.image_attribution is
  'Visible credit required for the real restaurant photo.';
comment on column public.restaurants.image_source_url is
  'Source page for the real restaurant photo and its usage rights.';
comment on column public.restaurants.menu_url is
  'Official menu page containing current items and prices.';
comment on column public.restaurants.price_source_url is
  'Official source used to verify the average price per person.';
comment on column public.restaurants.verified_at is
  'Last manual verification date for business, description, photo, menu, and prices.';

create or replace function public.invalidate_restaurant_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.name is distinct from old.name
    or new.cuisine is distinct from old.cuisine
    or new.description is distinct from old.description
    or new.tags is distinct from old.tags
    or new.price_per_person is distinct from old.price_per_person
    or new.address is distinct from old.address
    or new.city is distinct from old.city
    or new.state is distinct from old.state
    or new.location is distinct from old.location
    or new.image_url is distinct from old.image_url
    or new.image_attribution is distinct from old.image_attribution
    or new.image_source_url is distinct from old.image_source_url
    or new.menu_url is distinct from old.menu_url
    or new.price_source_url is distinct from old.price_source_url
    or new.website_url is distinct from old.website_url
    or new.source is distinct from old.source
    or new.external_id is distinct from old.external_id
    or new.status is distinct from old.status
  ) and new.verified_at is not distinct from old.verified_at then
    new.verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists restaurants_invalidate_verification on public.restaurants;
create trigger restaurants_invalidate_verification
  before update on public.restaurants
  for each row execute function public.invalidate_restaurant_verification();

drop policy if exists "Anyone can read published restaurants" on public.restaurants;
drop policy if exists "Anyone can read verified restaurants" on public.restaurants;
create policy "Anyone can read verified restaurants"
  on public.restaurants for select to anon, authenticated
  using (
    status = 'published'
    and verified_at is not null
    and verified_at <= now()
    and verified_at > now() - interval '180 days'
    and nullif(btrim(cuisine), '') is not null
    and lower(btrim(cuisine)) <> 'não informada'
    and char_length(btrim(description)) >= 40
    and description <> 'Informações de localização mapeadas pela comunidade OpenStreetMap.'
    and price_per_person > 0
    and image_url ~* '^https://'
    and nullif(btrim(image_attribution), '') is not null
    and image_source_url ~* '^https://'
    and menu_url ~* '^https://'
    and price_source_url ~* '^https://'
  );

drop function if exists public.search_restaurants(
  text, numeric, text, double precision, double precision, double precision, integer, integer
);

create function public.search_restaurants(
  p_cuisine text default null,
  p_max_budget numeric default null,
  p_search text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default 15,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid, name text, slug text, cuisine text, description text,
  price_per_person numeric, rating numeric, rating_count integer,
  address text, city text, state text, lat double precision,
  lng double precision, distance_km double precision, tags text[],
  image_url text, image_attribution text, image_source_url text,
  menu_url text, price_source_url text, website_url text,
  is_demo boolean, source text, source_url text, verified_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    r.id, r.name, r.slug, r.cuisine, r.description, r.price_per_person,
    r.rating, r.rating_count, r.address, r.city, r.state,
    extensions.st_y(r.location::extensions.geometry) as lat,
    extensions.st_x(r.location::extensions.geometry) as lng,
    case when p_lat is not null and p_lng is not null then
      extensions.st_distance(
        r.location,
        extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography
      ) / 1000.0
    else null end as distance_km,
    r.tags, r.image_url, r.image_attribution, r.image_source_url,
    r.menu_url, r.price_source_url, r.website_url, r.is_demo, r.source,
    r.source_url, r.verified_at
  from public.restaurants r
  where r.status = 'published'
    and r.verified_at is not null
    and r.verified_at <= now()
    and r.verified_at > now() - interval '180 days'
    and nullif(btrim(r.cuisine), '') is not null
    and lower(btrim(r.cuisine)) <> 'não informada'
    and char_length(btrim(r.description)) >= 40
    and r.description <> 'Informações de localização mapeadas pela comunidade OpenStreetMap.'
    and r.price_per_person > 0
    and r.image_url ~* '^https://'
    and nullif(btrim(r.image_attribution), '') is not null
    and r.image_source_url ~* '^https://'
    and r.menu_url ~* '^https://'
    and r.price_source_url ~* '^https://'
    and (p_cuisine is null or r.cuisine ilike '%' || p_cuisine || '%')
    and (p_max_budget is null or r.price_per_person <= p_max_budget)
    and (
      p_search is null
      or r.name ilike '%' || p_search || '%'
      or r.description ilike '%' || p_search || '%'
      or r.address ilike '%' || p_search || '%'
      or exists (select 1 from unnest(r.tags) tag where tag ilike '%' || p_search || '%')
    )
    and (
      p_lat is null or p_lng is null
      or extensions.st_dwithin(
        r.location,
        extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography,
        greatest(1, least(coalesce(p_radius_km, 15), 100)) * 1000
      )
    )
  order by
    case when p_lat is not null and p_lng is not null then
      extensions.st_distance(
        r.location,
        extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography
      )
    else 0 end,
    r.rating desc nulls last,
    r.price_per_person asc nulls last
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 10000));
$$;

grant execute on function public.search_restaurants(
  text, numeric, text, double precision, double precision, double precision, integer, integer
) to anon, authenticated;

