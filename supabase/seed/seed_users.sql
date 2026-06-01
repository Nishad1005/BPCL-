-- Run in Supabase SQL Editor (executes as postgres, bypasses RLS) AFTER the 9
-- auth users exist. Idempotent. No service_role key required.

-- 1. Set role + display name per profile (matched by email).
update public.users u
set role = v.role::public.app_role, name = v.name
from (values
  ('super_admin@example.test','super_admin','Super Admin'),
  ('management@example.test','management','Management User'),
  ('state_area_manager@example.test','state_area_manager','Area Manager'),
  ('nso@example.test','nso','NSO User'),
  ('udc@example.test','udc','UDC User'),
  ('dealer@example.test','dealer','Dealer User'),
  ('marketing_vm@example.test','marketing_vm','Marketing VM'),
  ('training_admin@example.test','training_admin','Training Admin'),
  ('consultant@example.test','consultant','Consultant User')
) as v(email, role, name)
where u.email = v.email;

-- 2. Region assignment: Area Manager -> Madhya Pradesh (state node -> all MP stores).
insert into public.user_region_assignments (user_id, region_id)
select u.id, '00000000-0000-0000-0000-000000000001'
from public.users u where u.email = 'state_area_manager@example.test'
on conflict do nothing;

-- 3. Store assignments: NSO -> 2 Indore stores; UDC -> 1; Dealer -> 1.
insert into public.user_store_assignments (user_id, store_id, assignment_type)
select u.id, s.store_id::uuid, s.atype::public.assignment_type
from public.users u
join (values
  ('nso@example.test','00000000-0000-0000-0000-0000000000a1','nso'),
  ('nso@example.test','00000000-0000-0000-0000-0000000000a2','nso'),
  ('udc@example.test','00000000-0000-0000-0000-0000000000a1','udc'),
  ('dealer@example.test','00000000-0000-0000-0000-0000000000a1','dealer')
) as s(email, store_id, atype) on u.email = s.email
on conflict do nothing;
