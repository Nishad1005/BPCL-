create type public.app_role as enum (
  'super_admin', 'management', 'state_area_manager', 'nso',
  'udc', 'dealer', 'marketing_vm', 'training_admin', 'consultant'
);

create type public.region_type as enum ('state', 'area', 'cluster');

create type public.assignment_type as enum ('nso', 'udc', 'dealer');

create type public.app_module as enum (
  'daily_kpi', 'nso_visit', 'promotion_vm', 'resolution', 'lms', 'coaching'
);
