create table public.daily_kpi_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  report_date date not null,
  udc_id uuid references public.users(id) on delete set null,
  nso_id uuid references public.users(id) on delete set null,
  nob integer not null check (nob >= 0),
  walk_ins integer check (walk_ins >= 0),
  total_sales numeric(12,2) not null check (total_sales >= 0),
  abv numeric(12,2) generated always as
    (case when nob > 0 then total_sales / nob else 0 end) stored,
  promotion_sales numeric(12,2),
  fuel_conversion_pct numeric(5,2),
  top_category_id uuid references public.product_categories(id) on delete set null,
  top_category_remarks text,
  slow_category_id uuid references public.product_categories(id) on delete set null,
  slow_category_remarks text,
  support_needed text,
  status public.kpi_status not null default 'submitted',
  late boolean not null default false,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  submitted_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique (store_id, report_date)
);
create index daily_kpi_store_date_idx on public.daily_kpi_reports(store_id, report_date desc);
create index daily_kpi_status_idx on public.daily_kpi_reports(status);

create table public.daily_kpi_stockout_items (
  id uuid primary key default gen_random_uuid(),
  kpi_report_id uuid not null references public.daily_kpi_reports(id) on delete cascade,
  sku text,
  category_id uuid references public.product_categories(id) on delete set null,
  remarks text,
  created_at timestamptz not null default now()
);
create index dksi_kpi_idx on public.daily_kpi_stockout_items(kpi_report_id);

create or replace function public.set_kpi_late_flag()
returns trigger
language plpgsql
as $$
declare cutoff time;
begin
  select daily_cutoff_time into cutoff from public.kpi_config where id = 1;
  new.late := ((new.submitted_at at time zone 'Asia/Kolkata')::time > cutoff);
  return new;
end;
$$;

create trigger kpi_set_late
  before insert or update of submitted_at on public.daily_kpi_reports
  for each row execute function public.set_kpi_late_flag();

create or replace function public.kpi_protect_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.submitted_by = auth.uid()
     and public.auth_role() not in ('nso','state_area_manager','super_admin') then
    raise exception 'Submitter cannot change KPI status';
  end if;
  return new;
end;
$$;

create trigger kpi_protect_status_trg
  before update on public.daily_kpi_reports
  for each row execute function public.kpi_protect_status();
