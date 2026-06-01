create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.product_categories (name) values
  ('Snacks'), ('Beverages'), ('Tobacco'), ('Auto care'), ('FMCG'), ('Other');
