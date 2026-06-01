create policy attachments_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.attachments a
      where a.storage_path = storage.objects.name
    )
  );

create policy attachments_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'daily_kpi_report'
    and exists (
      select 1 from public.daily_kpi_reports k
      where k.id::text = (storage.foldername(name))[2]
        and k.store_id in (select public.accessible_store_ids())
    )
  );

create policy attachments_objects_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.auth_role() = 'super_admin');
