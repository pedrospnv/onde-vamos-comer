create extension if not exists postgis with schema extensions;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  cuisine text not null default 'Não informada',
  description text not null default '',
  price_per_person numeric(8,2) check (price_per_person >= 0),
  rating numeric(2,1) check (rating between 0 and 5),
  rating_count integer check (rating_count >= 0),
  address text not null,
  city text not null default 'São Paulo',
  state text not null default 'SP' check (char_length(state) = 2),
  location extensions.geography(point, 4326) not null,
  tags text[] not null default '{}',
  image_url text,
  website_url text,
  source text not null default 'openstreetmap' check (source in ('openstreetmap')),
  external_id text,
  source_url text,
  last_synced_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_demo boolean not null default false check (is_demo = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_source_external_id_key unique (source, external_id)
);

create index if not exists restaurants_location_gix on public.restaurants using gist (location);
create index if not exists restaurants_status_idx on public.restaurants (status);
create index if not exists restaurants_cuisine_idx on public.restaurants (cuisine);
create index if not exists restaurants_price_idx on public.restaurants (price_per_person);
create index if not exists restaurants_synced_idx on public.restaurants (source, last_synced_at);

alter table public.restaurants enable row level security;
grant select on public.restaurants to anon, authenticated;

create policy "Anyone can read published restaurants"
  on public.restaurants for select to anon, authenticated
  using (status = 'published');

create or replace function public.search_restaurants(
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
  image_url text, website_url text, is_demo boolean,
  source text, source_url text
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
    r.tags, r.image_url, r.website_url, r.is_demo, r.source, r.source_url
  from public.restaurants r
  where r.status = 'published'
    and (p_cuisine is null or r.cuisine ilike '%' || p_cuisine || '%')
    -- Unknown prices remain visible, but the interface must clearly label them as unknown.
    and (p_max_budget is null or r.price_per_person is null or r.price_per_person <= p_max_budget)
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

grant execute on function public.search_restaurants(text, numeric, text, double precision, double precision, double precision, integer, integer)
  to anon, authenticated;
