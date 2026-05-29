create or replace function public.auth_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.users where id = auth.uid(); $$;

create or replace function public.accessible_store_ids()
returns setof uuid
language plpgsql stable security definer set search_path = public
as $$
declare r public.app_role;
begin
  select role into r from public.users where id = auth.uid();
  if r in ('super_admin','management','marketing_vm','training_admin','consultant') then
    return query select id from public.stores;
  elsif r = 'state_area_manager' then
    return query
      with recursive sub(region_id) as (
        select region_id from public.user_region_assignments where user_id = auth.uid()
        union
        select reg.id from public.regions reg join sub on reg.parent_id = sub.region_id
      )
      select s.id from public.stores s where s.region_id in (select region_id from sub);
  else
    return query select store_id from public.user_store_assignments where user_id = auth.uid();
  end if;
end;
$$;

alter table public.stores enable row level security;
create policy stores_select on public.stores for select to authenticated
  using (id in (select public.accessible_store_ids()));
create policy stores_admin_write on public.stores for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.users enable row level security;
create policy users_select on public.users for select to authenticated
  using (
    id = auth.uid()
    or public.auth_role() = 'super_admin'
    or (
      public.auth_role() in ('management','state_area_manager')
      and (
        primary_store_id in (select public.accessible_store_ids())
        or exists (
          select 1 from public.user_store_assignments a
          where a.user_id = public.users.id
            and a.store_id in (select public.accessible_store_ids())
        )
      )
    )
  );
create policy users_self_update on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin_write on public.users for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.regions enable row level security;
create policy regions_read on public.regions for select to authenticated using (true);
create policy regions_admin_write on public.regions for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.roles_permissions enable row level security;
create policy roles_permissions_read on public.roles_permissions for select to authenticated using (true);
create policy roles_permissions_admin_write on public.roles_permissions for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.user_store_assignments enable row level security;
create policy usa_read on public.user_store_assignments for select to authenticated
  using (user_id = auth.uid() or public.auth_role() = 'super_admin');
create policy usa_admin_write on public.user_store_assignments for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

alter table public.user_region_assignments enable row level security;
create policy ura_read on public.user_region_assignments for select to authenticated
  using (user_id = auth.uid() or public.auth_role() = 'super_admin');
create policy ura_admin_write on public.user_region_assignments for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');
