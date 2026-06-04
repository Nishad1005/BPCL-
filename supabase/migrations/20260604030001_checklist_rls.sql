alter table public.checklist_templates enable row level security;
create policy ct_read on public.checklist_templates for select to authenticated using (true);
create policy ct_admin_write on public.checklist_templates for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.checklist_items enable row level security;
create policy ci_read on public.checklist_items for select to authenticated using (true);
create policy ci_admin_write on public.checklist_items for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.store_checklist_submissions enable row level security;

create policy scs_select on public.store_checklist_submissions for select to authenticated
  using (store_id in (select public.accessible_store_ids()));

create policy scs_insert on public.store_checklist_submissions for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and store_id in (select public.accessible_store_ids())
  );

create policy scs_admin_update on public.store_checklist_submissions for update to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

create policy scs_owner_score_update on public.store_checklist_submissions for update to authenticated
  using (submitted_by = auth.uid()) with check (submitted_by = auth.uid());

create policy scs_admin_delete on public.store_checklist_submissions for delete to authenticated
  using (public.auth_role() = 'super_admin');

alter table public.checklist_answers enable row level security;

create policy ca_select on public.checklist_answers for select to authenticated
  using (exists (
    select 1 from public.store_checklist_submissions s
    where s.id = checklist_answers.submission_id
      and s.store_id in (select public.accessible_store_ids())
  ));

create policy ca_insert on public.checklist_answers for insert to authenticated
  with check (exists (
    select 1 from public.store_checklist_submissions s
    where s.id = checklist_answers.submission_id
      and s.submitted_by = auth.uid()
      and s.store_id in (select public.accessible_store_ids())
  ));

create policy ca_admin_write on public.checklist_answers for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

create policy attachments_select_checklist on public.attachments for select to authenticated
  using (
    entity_type = 'checklist_submission' and exists (
      select 1 from public.store_checklist_submissions s
      where s.id = attachments.entity_id
        and s.store_id in (select public.accessible_store_ids())
    )
  );

create policy attachments_insert_checklist on public.attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and entity_type = 'checklist_submission' and exists (
      select 1 from public.store_checklist_submissions s
      where s.id = attachments.entity_id
        and s.submitted_by = auth.uid()
        and s.store_id in (select public.accessible_store_ids())
    )
  );
