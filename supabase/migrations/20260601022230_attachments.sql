create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type public.attachment_entity not null,
  entity_id uuid not null,
  storage_path text not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index attachments_entity_idx on public.attachments(entity_type, entity_id);
