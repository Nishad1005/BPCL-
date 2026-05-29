create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.region_type not null,
  parent_id uuid references public.regions(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index regions_parent_id_idx on public.regions(parent_id);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  dealer_name text,
  address text,
  city text,
  state text,
  region_id uuid references public.regions(id) on delete restrict,
  latitude numeric,
  longitude numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index stores_region_id_idx on public.stores(region_id);
