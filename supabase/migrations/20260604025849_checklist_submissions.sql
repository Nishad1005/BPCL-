create table public.store_checklist_submissions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.checklist_templates(id) on delete restrict,
  store_id      uuid not null references public.stores(id) on delete cascade,
  period_start  date not null,
  submitted_by  uuid not null references public.users(id) on delete restrict,
  submitted_at  timestamptz not null default now(),
  score         numeric(5,2) not null default 0,
  unique (template_id, store_id, period_start)
);
create index scs_store_period_idx on public.store_checklist_submissions(store_id, period_start desc);

create table public.checklist_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.store_checklist_submissions(id) on delete cascade,
  item_id       uuid not null references public.checklist_items(id) on delete restrict,
  answer        public.checklist_answer not null,
  remarks       text,
  has_photo     boolean not null default false,
  unique (submission_id, item_id)
);
create index ca_submission_idx on public.checklist_answers(submission_id);

create or replace function public.enforce_checklist_photo()
returns trigger
language plpgsql
as $$
declare needs_photo boolean;
begin
  if new.answer = 'done' then
    select requires_photo into needs_photo
    from public.checklist_items where id = new.item_id;
    if coalesce(needs_photo, false) and not coalesce(new.has_photo, false) then
      raise exception 'Checklist item requires a photo when answered Done';
    end if;
  end if;
  return new;
end;
$$;

create trigger checklist_answers_photo_enforce
  before insert or update on public.checklist_answers
  for each row execute function public.enforce_checklist_photo();
