create table if not exists public.curated_restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 2 and 160),
  cuisine text not null check (length(trim(cuisine)) between 2 and 80),
  description text not null check (length(trim(description)) between 40 and 1200),
  description_source_url text not null check (description_source_url ~ '^https://'),
  address text not null check (length(trim(address)) between 4 and 300),
  neighborhood text,
  city text not null default 'São Paulo',
  state text not null default 'SP',
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  website_url text check (website_url is null or website_url ~ '^https://'),
  menu_url text check (menu_url is null or menu_url ~ '^https://'),
  source_url text not null check (source_url ~ '^https://'),
  price_per_person numeric(10,2) check (price_per_person is null or price_per_person >= 0),
  price_currency text not null default 'BRL' check (price_currency = 'BRL'),
  price_basis text not null default 'menu_items_only'
    check (price_basis in ('per_person', 'menu_items_only', 'unknown')),
  price_source_url text check (price_source_url is null or price_source_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (status <> 'published' or verified_at is not null)
);

create table if not exists public.curated_restaurant_photos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.curated_restaurants(id) on delete cascade,
  image_url text not null check (image_url ~ '^https://'),
  attribution text not null check (length(trim(attribution)) between 2 and 240),
  license_name text not null check (length(trim(license_name)) between 2 and 100),
  license_url text not null check (license_url ~ '^https://'),
  source_page_url text not null check (source_page_url ~ '^https://'),
  is_primary boolean not null default false,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, image_url)
);

create unique index if not exists curated_restaurant_one_primary_photo
  on public.curated_restaurant_photos (restaurant_id) where is_primary;

create table if not exists public.curated_menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.curated_restaurants(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  description text,
  price_brl numeric(10,2) not null check (price_brl >= 0),
  price_basis text not null check (price_basis in ('unit', 'portion', 'combo', 'per_person', 'per_100g')),
  service_mode text not null default 'unknown' check (service_mode in ('dine_in', 'delivery', 'both', 'unknown')),
  source_url text not null check (source_url ~ '^https://'),
  source_checked_at timestamptz not null,
  price_status text not null default 'needs_confirmation'
    check (price_status in ('current', 'needs_confirmation', 'historical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name, price_basis, service_mode, source_checked_at)
);

create index if not exists curated_restaurants_public_search
  on public.curated_restaurants (status, cuisine, neighborhood, name);
create index if not exists curated_menu_items_restaurant_price
  on public.curated_menu_items (restaurant_id, price_brl);

alter table public.curated_restaurants enable row level security;
alter table public.curated_restaurant_photos enable row level security;
alter table public.curated_menu_items enable row level security;

revoke all on public.curated_restaurants from anon, authenticated;
revoke all on public.curated_restaurant_photos from anon, authenticated;
revoke all on public.curated_menu_items from anon, authenticated;
grant select on public.curated_restaurants to anon, authenticated;
grant select on public.curated_restaurant_photos to anon, authenticated;
grant select on public.curated_menu_items to anon, authenticated;

drop policy if exists "Published curated restaurants are readable" on public.curated_restaurants;
create policy "Published curated restaurants are readable"
  on public.curated_restaurants for select to anon, authenticated
  using (
    status = 'published'
    and verified_at is not null
    and verified_at <= now()
    and verified_at >= now() - interval '180 days'
  );

drop policy if exists "Photos for published curated restaurants are readable" on public.curated_restaurant_photos;
create policy "Photos for published curated restaurants are readable"
  on public.curated_restaurant_photos for select to anon, authenticated
  using (exists (
    select 1 from public.curated_restaurants r
    where r.id = restaurant_id and r.status = 'published'
      and r.verified_at <= now() and r.verified_at >= now() - interval '180 days'
  ));

drop policy if exists "Menus for published curated restaurants are readable" on public.curated_menu_items;
create policy "Menus for published curated restaurants are readable"
  on public.curated_menu_items for select to anon, authenticated
  using (exists (
    select 1 from public.curated_restaurants r
    where r.id = restaurant_id and r.status = 'published'
      and r.verified_at <= now() and r.verified_at >= now() - interval '180 days'
  ));

-- Initial hand-curated seed. Menu values retain their source date and context;
-- item prices are never interpreted as a per-person budget estimate.
insert into public.curated_restaurants
  (slug, name, cuisine, description, description_source_url, address, neighborhood, website_url, menu_url, source_url, price_basis, price_source_url, status, verified_at)
values
  ('mocoto-vila-clementino', 'Mocotó — Vila Clementino', 'Brasileira · sertaneja',
   'Casa de cozinha sertaneja com pratos nordestinos, dadinhos de tapioca, baião de dois e receitas próprias da unidade da Vila Clementino.',
   'https://mocoto.com.br/', 'Rua Pedro de Toledo, 450, Vila Clementino, São Paulo - SP', 'Vila Clementino',
   'https://mocoto.com.br/', 'https://linktr.ee/mocotorestaurante', 'https://mocoto.com.br/', 'menu_items_only',
   'https://vejasp.abril.com.br/coluna/arnaldo-lorencato/comer-e-beber-2026-ifood/', 'published', now()),
  ('di-cunto-mooca', 'Di Cunto — Mooca', 'Italiana · padaria e confeitaria',
   'Casa tradicional da Mooca com padaria, confeitaria e pratos italianos; a ficha de delivery lista salgados, massas e doces da marca.',
   'https://dicunto.com.br/', 'Rua Borges de Figueiredo, 61 - A89, Mooca, São Paulo - SP, 03110-010', 'Mooca',
   'https://dicunto.com.br/', 'https://www.rappi.com.br/restaurantes/900628834-di-cunto',
   'https://www.rappi.com.br/restaurantes/900628834-di-cunto', 'menu_items_only',
   'https://www.rappi.com.br/restaurantes/900628834-di-cunto', 'published', now()),
  ('bar-estadao', 'Bar e Lanches Estadão', 'Brasileira · lanches e pratos',
   'Bar e lanchonete tradicional no centro de São Paulo, conhecido pelo sanduíche de pernil e por refeições rápidas servidas ao longo do dia.',
   'https://estadaolanches.com.br/historia.html', 'Viaduto Nove de Julho, 193, Centro, São Paulo - SP, 01050-060', 'Centro',
   'https://estadaolanches.com.br/', 'https://estadaolanches.com.br/cardapio-portugues.pdf',
   'https://estadaolanches.com.br/localizacao.html', 'menu_items_only',
   'https://estadaolanches.com.br/cardapio-portugues.pdf', 'published', now()),
  ('famiglia-mancini-trattoria', 'Famiglia Mancini Trattoria', 'Italiana',
   'Trattoria italiana da Rua Avanhandava, com antepastos variados e pratos de porções generosas pensados para compartilhar.',
   'https://www.famigliamancini.com.br/', 'Rua Avanhandava, 81, Bela Vista, São Paulo - SP', 'Bela Vista',
   'https://www.famigliamancini.com.br/', 'https://www.famigliamancini.com.br/',
   'https://www.famigliamancini.com.br/', 'menu_items_only',
   'https://cdn.me-qr.com/pdf/12607216.pdf?time=1712578944', 'published', now()),
  ('cantina-casteloes', 'Cantina e Pizzaria Castelões', 'Italiana · pizza',
   'Cantina histórica do Brás com pizzas clássicas e pratos italianos, instalada no mesmo endereço desde a década de 1920.',
   'https://prefeitura.sp.gov.br/documents/d/cultura/cantina-casteloes-1', 'Rua Jairo Góes, 126, Brás, São Paulo - SP, 03004-010', 'Brás',
   'https://linktr.ee/cantina.casteloes', 'https://linktr.ee/cantina.casteloes',
   'https://prefeitura.sp.gov.br/documents/d/cultura/cantina-casteloes-1', 'menu_items_only',
   'https://cdnc.heyzine.com/files/uploaded/v2/8defb716b7af41c4de32ae5f3abb937315e91c7f.pdf', 'published', now());

insert into public.curated_restaurant_photos
  (restaurant_id, image_url, attribution, license_name, license_url, source_page_url, is_primary, verified_at)
values
  ((select id from public.curated_restaurants where slug = 'mocoto-vila-clementino'),
   'https://commons.wikimedia.org/wiki/Special:FilePath/Cassava_strips_(16076228735).jpg?width=1200',
   'MATHIAS, M H / CC BY 2.0', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/',
   'https://commons.wikimedia.org/wiki/File:Cassava_strips_(16076228735).jpg', true, now()),
  ((select id from public.curated_restaurants where slug = 'di-cunto-mooca'),
   'https://commons.wikimedia.org/wiki/Special:FilePath/Di_Cunto_-_restaurante_04.jpg?width=1200',
   'Joalpe / CC BY-SA 4.0', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/',
   'https://commons.wikimedia.org/wiki/File:Di_Cunto_-_restaurante_04.jpg', true, now()),
  ((select id from public.curated_restaurants where slug = 'bar-estadao'),
   'https://commons.wikimedia.org/wiki/Special:FilePath/Webysther_20160305155624_-_Bar_e_Lanches_Estad%C3%A3o.jpg?width=1200',
   'Webysther Nunes / CC BY-SA 4.0', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/',
   'https://commons.wikimedia.org/wiki/File:Webysther_20160305155624_-_Bar_e_Lanches_Estad%C3%A3o.jpg', true, now()),
  ((select id from public.curated_restaurants where slug = 'famiglia-mancini-trattoria'),
   'https://commons.wikimedia.org/wiki/Special:FilePath/Famiglia_Mancini,_S%C3%A3o_Paulo,_Brazil.jpg?width=1200',
   'Wilfredor / CC BY-SA 4.0', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/',
   'https://commons.wikimedia.org/wiki/File:Famiglia_Mancini,_S%C3%A3o_Paulo,_Brazil.jpg', true, now()),
  ((select id from public.curated_restaurants where slug = 'cantina-casteloes'),
   'https://commons.wikimedia.org/wiki/Special:FilePath/Cantina_Pizzaria_Castel%C3%B5es_(5465164254).jpg?width=1200',
   'Monica Kaneko / CC BY-SA 2.0', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/',
   'https://commons.wikimedia.org/wiki/File:Cantina_Pizzaria_Castel%C3%B5es_(5465164254).jpg', true, now());

insert into public.curated_menu_items
  (restaurant_id, name, price_brl, price_basis, service_mode, source_url, source_checked_at, price_status)
values
  ((select id from public.curated_restaurants where slug = 'mocoto-vila-clementino'), 'Dadinhos de tapioca · 6 unidades', 32.90, 'portion', 'delivery', 'https://vejasp.abril.com.br/coluna/arnaldo-lorencato/comer-e-beber-2026-ifood/', '2026-09-11T12:30:00-03:00', 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'mocoto-vila-clementino'), 'Dadinhos de tapioca · 12 unidades', 43.90, 'portion', 'delivery', 'https://vejasp.abril.com.br/coluna/arnaldo-lorencato/comer-e-beber-2026-ifood/', '2026-09-11T12:30:00-03:00', 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'mocoto-vila-clementino'), 'Pudim de tapioca', 28.90, 'unit', 'delivery', 'https://vejasp.abril.com.br/coluna/arnaldo-lorencato/comer-e-beber-2026-ifood/', '2026-09-11T12:30:00-03:00', 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'mocoto-vila-clementino'), 'Mocofava · 550 g', 78.90, 'portion', 'delivery', 'https://vejasp.abril.com.br/coluna/arnaldo-lorencato/comer-e-beber-2026-ifood/', '2026-09-11T12:30:00-03:00', 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'mocoto-vila-clementino'), 'Carne de sol com mandioca', 129.90, 'portion', 'delivery', 'https://vejasp.abril.com.br/coluna/arnaldo-lorencato/comer-e-beber-2026-ifood/', '2026-09-11T12:30:00-03:00', 'needs_confirmation'),

  ((select id from public.curated_restaurants where slug = 'di-cunto-mooca'), 'Coxinha · 10 unidades', 49.99, 'combo', 'delivery', 'https://www.rappi.com.br/restaurantes/900628834-di-cunto', now(), 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'di-cunto-mooca'), 'Cannoli · combo', 68.90, 'combo', 'delivery', 'https://www.rappi.com.br/restaurantes/900628834-di-cunto', now(), 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'di-cunto-mooca'), 'Éclair · combo', 74.90, 'combo', 'delivery', 'https://www.rappi.com.br/restaurantes/900628834-di-cunto', now(), 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'di-cunto-mooca'), 'Lasagne alla Bolognese + cannoli', 84.90, 'combo', 'delivery', 'https://www.rappi.com.br/restaurantes/900628834-di-cunto', now(), 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'di-cunto-mooca'), 'Gnocchi al sugo + éclair', 85.50, 'combo', 'delivery', 'https://www.rappi.com.br/restaurantes/900628834-di-cunto', now(), 'needs_confirmation'),

  ((select id from public.curated_restaurants where slug = 'bar-estadao'), 'Picadinho', 33.00, 'portion', 'dine_in', 'https://estadaolanches.com.br/cardapio-portugues.pdf', '2024-10-22T00:00:00-03:00', 'historical'),
  ((select id from public.curated_restaurants where slug = 'bar-estadao'), 'Costela com arroz, feijão e farofa', 37.00, 'portion', 'dine_in', 'https://estadaolanches.com.br/cardapio-portugues.pdf', '2024-10-22T00:00:00-03:00', 'historical'),
  ((select id from public.curated_restaurants where slug = 'bar-estadao'), 'Prato da casa', 39.00, 'portion', 'dine_in', 'https://estadaolanches.com.br/cardapio-portugues.pdf', '2024-10-22T00:00:00-03:00', 'historical'),
  ((select id from public.curated_restaurants where slug = 'bar-estadao'), 'Pernil à brasileira', 39.00, 'portion', 'dine_in', 'https://estadaolanches.com.br/cardapio-portugues.pdf', '2024-10-22T00:00:00-03:00', 'historical'),

  ((select id from public.curated_restaurants where slug = 'famiglia-mancini-trattoria'), 'Couvert musical obrigatório · por pessoa', 35.00, 'per_person', 'dine_in', 'https://cdn.me-qr.com/pdf/12607216.pdf?time=1712578944', '2024-04-08T00:00:00-03:00', 'historical'),
  ((select id from public.curated_restaurants where slug = 'famiglia-mancini-trattoria'), 'Polenta ao ragu de ossobuco', 69.00, 'portion', 'dine_in', 'https://cdn.me-qr.com/pdf/12607216.pdf?time=1712578944', '2024-04-08T00:00:00-03:00', 'historical'),
  ((select id from public.curated_restaurants where slug = 'famiglia-mancini-trattoria'), 'Fettuccine ao pesto', 110.00, 'portion', 'dine_in', 'https://cdn.me-qr.com/pdf/12607216.pdf?time=1712578944', '2024-04-08T00:00:00-03:00', 'historical'),
  ((select id from public.curated_restaurants where slug = 'famiglia-mancini-trattoria'), 'Spaghetti à Bolognesa', 110.00, 'portion', 'dine_in', 'https://cdn.me-qr.com/pdf/12607216.pdf?time=1712578944', '2024-04-08T00:00:00-03:00', 'historical'),

  ((select id from public.curated_restaurants where slug = 'cantina-casteloes'), 'Mussarela · pizza grande', 98.00, 'portion', 'dine_in', 'https://cdnc.heyzine.com/files/uploaded/v2/8defb716b7af41c4de32ae5f3abb937315e91c7f.pdf', now(), 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'cantina-casteloes'), 'Espaguete ao sugo · individual', 79.00, 'portion', 'dine_in', 'https://cdnc.heyzine.com/files/uploaded/v2/8defb716b7af41c4de32ae5f3abb937315e91c7f.pdf', now(), 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'cantina-casteloes'), 'Tábua de frios · pequena', 69.00, 'portion', 'dine_in', 'https://cdnc.heyzine.com/files/uploaded/v2/8defb716b7af41c4de32ae5f3abb937315e91c7f.pdf', now(), 'needs_confirmation'),
  ((select id from public.curated_restaurants where slug = 'cantina-casteloes'), 'Cannolo', 25.00, 'unit', 'dine_in', 'https://cdnc.heyzine.com/files/uploaded/v2/8defb716b7af41c4de32ae5f3abb937315e91c7f.pdf', now(), 'needs_confirmation');
