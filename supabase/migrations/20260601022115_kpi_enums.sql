create type public.kpi_status as enum ('submitted','approved','rejected','edited');

create type public.attachment_entity as enum (
  'daily_kpi_report','checklist_submission','nso_visit','promotion_compliance'
);
