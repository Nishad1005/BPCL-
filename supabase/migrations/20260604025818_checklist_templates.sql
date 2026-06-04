create table public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  frequency   public.checklist_frequency not null,
  active      boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.checklist_items (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.checklist_templates(id) on delete cascade,
  section         text,
  prompt          text not null,
  requires_photo  boolean not null default false,
  sort            integer not null default 0,
  unique (template_id, sort)
);
create index checklist_items_template_idx on public.checklist_items(template_id, sort);
