create policy attachments_objects_insert_checklist on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'checklist_submission'
    and exists (
      select 1 from public.store_checklist_submissions s
      where s.id::text = (storage.foldername(name))[2]
        and s.submitted_by = auth.uid()
        and s.store_id in (select public.accessible_store_ids())
    )
  );
