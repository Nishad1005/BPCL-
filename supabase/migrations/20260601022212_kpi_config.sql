create table public.kpi_config (
  id integer primary key check (id = 1),
  daily_cutoff_time time not null default '22:00',
  updated_at timestamptz not null default now()
);

insert into public.kpi_config (id, daily_cutoff_time) values (1, '22:00');
