create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  mobile text,
  role public.app_role not null default 'udc',
  primary_store_id uuid references public.stores(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_store_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  assignment_type public.assignment_type not null,
  unique (user_id, store_id, assignment_type)
);
create index usa_user_id_idx on public.user_store_assignments(user_id);
create index usa_store_id_idx on public.user_store_assignments(store_id);

create table public.user_region_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  unique (user_id, region_id)
);
create index ura_user_id_idx on public.user_region_assignments(user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'udc')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
