alter table public.product_categories enable row level security;
create policy product_categories_read on public.product_categories for select to authenticated using (true);
create policy product_categories_admin_write on public.product_categories for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.kpi_config enable row level security;
create policy kpi_config_read on public.kpi_config for select to authenticated using (true);
create policy kpi_config_admin_write on public.kpi_config for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.attachments enable row level security;

create policy attachments_select on public.attachments for select to authenticated
  using (
    entity_type = 'daily_kpi_report' and exists (
      select 1 from public.daily_kpi_reports k
      where k.id = attachments.entity_id
        and k.store_id in (select public.accessible_store_ids())
    )
  );

create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and entity_type = 'daily_kpi_report' and exists (
      select 1 from public.daily_kpi_reports k
      where k.id = attachments.entity_id
        and k.store_id in (select public.accessible_store_ids())
    )
  );

create policy attachments_admin_delete on public.attachments for delete to authenticated
  using (public.auth_role() = 'super_admin');

alter table public.daily_kpi_reports enable row level security;

create policy kpi_select on public.daily_kpi_reports for select to authenticated
  using (store_id in (select public.accessible_store_ids()));

create policy kpi_insert on public.daily_kpi_reports for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and store_id in (select public.accessible_store_ids())
  );

create policy kpi_update_submitter on public.daily_kpi_reports for update to authenticated
  using (submitted_by = auth.uid() and status in ('submitted','rejected','edited'))
  with check (submitted_by = auth.uid());

create policy kpi_update_reviewer on public.daily_kpi_reports for update to authenticated
  using (
    public.auth_role() in ('nso','state_area_manager','super_admin')
    and store_id in (select public.accessible_store_ids())
  )
  with check (
    public.auth_role() in ('nso','state_area_manager','super_admin')
    and store_id in (select public.accessible_store_ids())
  );

create policy kpi_admin_delete on public.daily_kpi_reports for delete to authenticated
  using (public.auth_role() = 'super_admin');

alter table public.daily_kpi_stockout_items enable row level security;

create policy dksi_select on public.daily_kpi_stockout_items for select to authenticated
  using (exists (
    select 1 from public.daily_kpi_reports k
    where k.id = daily_kpi_stockout_items.kpi_report_id
      and k.store_id in (select public.accessible_store_ids())
  ));

create policy dksi_write on public.daily_kpi_stockout_items for all to authenticated
  using (exists (
    select 1 from public.daily_kpi_reports k
    where k.id = daily_kpi_stockout_items.kpi_report_id
      and k.store_id in (select public.accessible_store_ids())
      and (k.submitted_by = auth.uid() or public.auth_role() = 'super_admin')
  ))
  with check (exists (
    select 1 from public.daily_kpi_reports k
    where k.id = daily_kpi_stockout_items.kpi_report_id
      and k.store_id in (select public.accessible_store_ids())
      and (k.submitted_by = auth.uid() or public.auth_role() = 'super_admin')
  ));
