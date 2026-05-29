# WP1 — Identity, Roles, Masters + RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the identity + master-data foundation with Postgres-RLS-enforced store scoping, real email-OTP auth/role context, Super-Admin store/user CRUD, and an automated RLS test proving each of the 9 roles sees only its permitted stores.

**Architecture:** Supabase Postgres holds `regions` (self-referencing tree), `stores`, `users` (profile mirror of `auth.users`), assignment tables, and `roles_permissions`. Authorization is centralized in two `SECURITY DEFINER` helpers — `auth_role()` and `accessible_store_ids()` — used by RLS policies. Migrations are forward-only SQL files pushed to the linked cloud project (no Docker). The Expo app replaces the WP0 auth stub with a real Supabase-session-backed context.

**Tech Stack:** Expo SDK 54 + Expo Router 6, NativeWind, TanStack Query, react-hook-form + zod, `@supabase/supabase-js`, Supabase CLI (`npx supabase`), `tsx` for Node scripts.

**Reference spec:** [docs/superpowers/specs/2026-05-29-wp1-identity-roles-masters-design.md](../specs/2026-05-29-wp1-identity-roles-masters-design.md)

---

## File map

**Created — database / scripts:**
- `supabase/config.toml` — CLI config (from `supabase init`)
- `supabase/migrations/<ts>_enums.sql` — all enums
- `supabase/migrations/<ts>_regions_stores.sql` — regions tree + stores
- `supabase/migrations/<ts>_users_assignments.sql` — users + assignment tables + profile trigger
- `supabase/migrations/<ts>_roles_permissions.sql` — grid table + §10 seed
- `supabase/migrations/<ts>_authz_rls.sql` — `auth_role()`, `accessible_store_ids()`, RLS enable + policies
- `supabase/seed/seed.ts` — regions/stores/9 users/assignments (service_role)
- `scripts/test-rls.ts` — signs in per role, asserts visible store set
- `types/database.ts` — generated DB types

**Created — app:**
- `lib/permissions.ts` — `Module`, `Verb`, permission map type + `can()` pure helper
- `lib/hooks/useStores.ts`, `lib/hooks/useUsers.ts` — TanStack Query hooks
- `lib/schemas/store.ts`, `lib/schemas/user.ts` — zod schemas
- `app/(app)/admin/_layout.tsx` — admin stack, gated to super_admin
- `app/(app)/admin/stores/index.tsx`, `app/(app)/admin/stores/[id].tsx`
- `app/(app)/admin/users/index.tsx`, `app/(app)/admin/users/[id].tsx`

**Modified — app:**
- `lib/supabase.ts` — typed client (`Database` generic)
- `lib/auth.tsx` — real session/role/permissions provider + email OTP
- `app/_layout.tsx` — gate on real session
- `app/(auth)/login.tsx` — email OTP (request code + verify)
- `app/(app)/_layout.tsx` — role-aware nav + admin gate
- `app/(app)/index.tsx` — role-aware home (remove WP0 `health_check` card)
- `package.json` — scripts: `db:push`, `gen:types`, `seed`, `test:rls`
- `.env` / `.env.example` — add `SUPABASE_SERVICE_ROLE_KEY` (server-only)

---

## Task 0: Supabase CLI tooling, env, and script runner

**Files:**
- Create: `supabase/config.toml` (via CLI)
- Modify: `package.json`, `.env`, `.env.example`

- [ ] **Step 1: Install the Supabase CLI (dev) and tsx**

Run:
```bash
npm install -D supabase tsx dotenv
```
Expected: packages added.

- [ ] **Step 2: Initialize Supabase project config**

Run:
```bash
npx supabase init
```
Expected: creates `supabase/config.toml`. If it asks about VS Code settings / Deno, answer `n`.

- [ ] **Step 3: Link to the cloud project (USER RUNS — needs DB password)**

Run (interactive — the user performs this once):
```bash
npx supabase login
npx supabase link --project-ref coangflvkvaggztuvmue
```
Expected: "Finished supabase link." A `supabase/.temp` link state is written. If `db push` later prompts for the DB password, that's expected.

- [ ] **Step 4: Add the service_role key to `.env` (server-only) and document it**

Add to `.env` (get the value from Supabase Dashboard → Project Settings → API → `service_role` secret):
```
# Server-only — used by supabase/seed and scripts/test-rls. NEVER prefix with EXPO_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
```
Append the same placeholder line to `.env.example` (with the placeholder value, not a real key).

- [ ] **Step 5: Add npm scripts**

In `package.json` `"scripts"`, add:
```json
"db:push": "supabase db push",
"gen:types": "supabase gen types typescript --linked > types/database.ts",
"seed": "tsx supabase/seed/seed.ts",
"test:rls": "tsx scripts/test-rls.ts"
```

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml package.json package-lock.json .env.example
git commit -m "chore: add supabase CLI tooling, tsx runner, and db/seed scripts"
```

---

## Task 1: Enums migration

**Files:**
- Create: `supabase/migrations/<ts>_enums.sql`

- [ ] **Step 1: Generate the migration file**

Run:
```bash
npx supabase migration new enums
```
Expected: creates `supabase/migrations/<timestamp>_enums.sql`.

- [ ] **Step 2: Write the enum definitions**

Put this in the new file:
```sql
create type public.app_role as enum (
  'super_admin', 'management', 'state_area_manager', 'nso',
  'udc', 'dealer', 'marketing_vm', 'training_admin', 'consultant'
);

create type public.region_type as enum ('state', 'area', 'cluster');

create type public.assignment_type as enum ('nso', 'udc', 'dealer');

create type public.app_module as enum (
  'daily_kpi', 'nso_visit', 'promotion_vm', 'resolution', 'lms', 'coaching'
);
```

- [ ] **Step 3: Commit (push happens in Task 5 with the rest)**

```bash
git add supabase/migrations
git commit -m "feat(db): add core enums (role, region_type, assignment_type, module)"
```

---

## Task 2: Regions + stores migration

**Files:**
- Create: `supabase/migrations/<ts>_regions_stores.sql`

- [ ] **Step 1: Generate the migration file**

Run:
```bash
npx supabase migration new regions_stores
```

- [ ] **Step 2: Write the tables**

```sql
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.region_type not null,
  parent_id uuid references public.regions(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index regions_parent_id_idx on public.regions(parent_id);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  dealer_name text,
  address text,
  city text,
  state text,
  region_id uuid references public.regions(id) on delete restrict,
  latitude numeric,
  longitude numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index stores_region_id_idx on public.stores(region_id);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): add regions tree and stores master"
```

---

## Task 3: Users, assignments, and profile trigger migration

**Files:**
- Create: `supabase/migrations/<ts>_users_assignments.sql`

- [ ] **Step 1: Generate the migration file**

Run:
```bash
npx supabase migration new users_assignments
```

- [ ] **Step 2: Write tables + profile trigger**

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  mobile text,
  role public.app_role not null default 'udc',
  primary_store_id uuid references public.stores(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_store_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  assignment_type public.assignment_type not null,
  unique (user_id, store_id, assignment_type)
);
create index usa_user_id_idx on public.user_store_assignments(user_id);
create index usa_store_id_idx on public.user_store_assignments(store_id);

create table public.user_region_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  unique (user_id, region_id)
);
create index ura_user_id_idx on public.user_region_assignments(user_id);

-- Mirror every new auth user into public.users, reading name/role from metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'udc')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): add users profile, assignment tables, and auth-user trigger"
```

---

## Task 4: roles_permissions table + §10 grid seed migration

**Files:**
- Create: `supabase/migrations/<ts>_roles_permissions.sql`

- [ ] **Step 1: Generate the migration file**

Run:
```bash
npx supabase migration new roles_permissions
```

- [ ] **Step 2: Write the table + grid**

This grid encodes REQUIREMENTS §10 (Dealer = view-only everywhere per §5). `can_approve` covers approve/validate/escalate verbs.
```sql
create table public.roles_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  module public.app_module not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_approve boolean not null default false,
  can_export boolean not null default false,
  unique (role, module)
);

insert into public.roles_permissions (role, module, can_view, can_create, can_edit, can_approve, can_export) values
-- super_admin: full everywhere
('super_admin','daily_kpi',true,true,true,true,true),
('super_admin','nso_visit',true,true,true,true,true),
('super_admin','promotion_vm',true,true,true,true,true),
('super_admin','resolution',true,true,true,true,true),
('super_admin','lms',true,true,true,true,true),
('super_admin','coaching',true,true,true,true,true),
-- management: view + escalate (approve = escalate on resolution)
('management','daily_kpi',true,false,false,false,true),
('management','nso_visit',true,false,false,false,true),
('management','promotion_vm',true,false,false,false,true),
('management','resolution',true,false,false,true,true),
('management','lms',true,false,false,false,true),
('management','coaching',true,false,false,false,true),
-- state_area_manager
('state_area_manager','daily_kpi',true,false,false,true,true),
('state_area_manager','nso_visit',true,false,false,true,true),
('state_area_manager','promotion_vm',true,false,false,false,true),
('state_area_manager','resolution',true,false,true,true,true),
('state_area_manager','lms',true,false,false,false,true),
('state_area_manager','coaching',true,false,false,false,true),
-- nso (assigned stores)
('nso','daily_kpi',true,false,false,true,true),
('nso','nso_visit',true,true,true,false,true),
('nso','promotion_vm',true,false,false,true,true),
('nso','resolution',true,true,true,false,true),
('nso','lms',true,false,false,false,false),
('nso','coaching',true,true,false,false,false),
-- udc / store manager (own store)
('udc','daily_kpi',true,true,false,false,false),
('udc','nso_visit',true,true,false,false,false),
('udc','promotion_vm',true,true,false,false,false),
('udc','resolution',true,true,false,false,false),
('udc','lms',true,false,false,false,false),
('udc','coaching',true,false,false,false,false),
-- dealer (view-only owned stores)
('dealer','daily_kpi',true,false,false,false,false),
('dealer','nso_visit',true,false,false,false,false),
('dealer','promotion_vm',true,false,false,false,false),
('dealer','resolution',true,false,false,false,false),
('dealer','lms',true,false,false,false,false),
('dealer','coaching',true,false,false,false,false),
-- marketing_vm
('marketing_vm','daily_kpi',true,false,false,false,false),
('marketing_vm','nso_visit',true,false,false,false,false),
('marketing_vm','promotion_vm',true,true,true,true,true),
('marketing_vm','resolution',true,true,false,false,true),
('marketing_vm','lms',true,false,false,false,false),
('marketing_vm','coaching',true,false,false,false,false),
-- training_admin
('training_admin','daily_kpi',true,false,false,false,false),
('training_admin','nso_visit',true,false,false,false,false),
('training_admin','promotion_vm',true,false,false,false,false),
('training_admin','resolution',true,false,false,false,false),
('training_admin','lms',true,true,true,true,true),
('training_admin','coaching',true,false,false,false,false),
-- consultant
('consultant','daily_kpi',true,false,false,false,true),
('consultant','nso_visit',true,false,false,false,true),
('consultant','promotion_vm',true,false,false,false,true),
('consultant','resolution',true,true,false,false,true),
('consultant','lms',true,false,false,false,false),
('consultant','coaching',true,true,true,false,true);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): add roles_permissions grid seeded from REQUIREMENTS §10"
```

---

## Task 5: Push schema migrations + generate types

**Files:**
- Create: `types/database.ts`

- [ ] **Step 1: Push all pending migrations to the cloud project**

Run:
```bash
npm run db:push
```
Expected: lists the 4 migrations and applies them. If prompted "Do you want to push these migrations to the remote database?", confirm `y`. Expected end: "Finished supabase db push."

- [ ] **Step 2: Verify tables exist (sanity query)**

Run:
```bash
npx supabase db dump --linked -s public --data-only=false | grep -E "create table .*(regions|stores|users|roles_permissions)" | head
```
Expected: prints the 4+ `create table` lines. (If `db dump` is unavailable, skip — Step 3 also proves it.)

- [ ] **Step 3: Generate typed DB definitions**

Run:
```bash
npm run gen:types
```
Expected: `types/database.ts` created, containing a `Database` type with `public.Tables.stores`, `users`, `regions`, `roles_permissions`, etc.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "feat(db): push WP1 schema and generate database types"
```

---

## Task 6: Seed script (regions, stores, 9 users, assignments)

**Files:**
- Create: `supabase/seed/seed.ts`

- [ ] **Step 1: Write the seed script**

```ts
// supabase/seed/seed.ts
// Run with: npm run seed
// Uses the service_role key (bypasses RLS). NEVER import this from app code.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const SEED_PASSWORD = 'Wp1-Test-Pass!';

async function main() {
  // --- Regions: 2 states -> areas ---
  const { data: mp } = await admin.from('regions').insert({ name: 'Madhya Pradesh', type: 'state' }).select().single();
  const { data: cg } = await admin.from('regions').insert({ name: 'Chhattisgarh', type: 'state' }).select().single();
  const { data: mpIndore } = await admin.from('regions').insert({ name: 'Indore Area', type: 'area', parent_id: mp!.id }).select().single();
  const { data: mpBhopal } = await admin.from('regions').insert({ name: 'Bhopal Area', type: 'area', parent_id: mp!.id }).select().single();
  const { data: cgRaipur } = await admin.from('regions').insert({ name: 'Raipur Area', type: 'area', parent_id: cg!.id }).select().single();

  // --- Stores: 5 total (3 in MP, 2 in CG) ---
  const storesInput = [
    { store_name: 'Indore Forecourt 1', city: 'Indore', state: 'Madhya Pradesh', region_id: mpIndore!.id, dealer_name: 'Indore Dealer' },
    { store_name: 'Indore Forecourt 2', city: 'Indore', state: 'Madhya Pradesh', region_id: mpIndore!.id, dealer_name: 'Indore Dealer' },
    { store_name: 'Bhopal Forecourt 1', city: 'Bhopal', state: 'Madhya Pradesh', region_id: mpBhopal!.id, dealer_name: 'Bhopal Dealer' },
    { store_name: 'Raipur Forecourt 1', city: 'Raipur', state: 'Chhattisgarh', region_id: cgRaipur!.id, dealer_name: 'Raipur Dealer' },
    { store_name: 'Raipur Forecourt 2', city: 'Raipur', state: 'Chhattisgarh', region_id: cgRaipur!.id, dealer_name: 'Raipur Dealer' },
  ];
  const { data: stores } = await admin.from('stores').insert(storesInput).select();
  const S = stores!; // S[0],S[1] Indore; S[2] Bhopal; S[3],S[4] Raipur

  // --- 9 users, one per role ---
  const roles = [
    'super_admin', 'management', 'state_area_manager', 'nso',
    'udc', 'dealer', 'marketing_vm', 'training_admin', 'consultant',
  ] as const;

  const userIds: Record<string, string> = {};
  for (const role of roles) {
    const email = `${role}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { name: role, role },
    });
    if (error) throw new Error(`createUser ${role}: ${error.message}`);
    userIds[role] = data.user!.id;
  }

  // --- Assignments ---
  // State/Area Manager -> MP Indore area (sees all MP stores via region subtree? no: only Indore subtree).
  // Assign to the STATE node so they see all of MP (Indore + Bhopal = 3 stores).
  await admin.from('user_region_assignments').insert({ user_id: userIds.state_area_manager, region_id: mp!.id });

  // NSO -> 2 stores (both Indore)
  await admin.from('user_store_assignments').insert([
    { user_id: userIds.nso, store_id: S[0].id, assignment_type: 'nso' },
    { user_id: userIds.nso, store_id: S[1].id, assignment_type: 'nso' },
  ]);

  // UDC -> 1 store
  await admin.from('user_store_assignments').insert({ user_id: userIds.udc, store_id: S[0].id, assignment_type: 'udc' });

  // Dealer -> 1 store
  await admin.from('user_store_assignments').insert({ user_id: userIds.dealer, store_id: S[0].id, assignment_type: 'dealer' });

  console.log('Seed complete:', { regions: 5, stores: S.length, users: roles.length });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the seed**

Run:
```bash
npm run seed
```
Expected: `Seed complete: { regions: 5, stores: 5, users: 9 }`. (Re-running will fail on duplicate emails — that's fine; this is a one-shot seed. To re-seed, delete the auth users in the dashboard first.)

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/seed.ts
git commit -m "feat(db): seed multi-state regions, stores, and one user per role"
```

---

## Task 7: RLS test script (write failing — RLS not yet enabled)

**Files:**
- Create: `scripts/test-rls.ts`

- [ ] **Step 1: Write the RLS test**

```ts
// scripts/test-rls.ts
// Run with: npm run test:rls
// Signs in as each seed user (anon client) and asserts how many stores RLS lets them read.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SEED_PASSWORD } from '../supabase/seed/seed';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Expected visible store COUNT per role given the Task 6 seed (5 stores; 3 in MP, 2 in CG).
const expected: Record<string, number> = {
  super_admin: 5,
  management: 5,
  state_area_manager: 3, // MP state subtree (Indore 2 + Bhopal 1)
  nso: 2,                // 2 assigned
  udc: 1,                // 1 own
  dealer: 1,             // 1 owned
  marketing_vm: 5,
  training_admin: 5,
  consultant: 5,
};

async function visibleStoreCount(role: string): Promise<number> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email: `${role}@example.test`, password: SEED_PASSWORD });
  if (signInErr) throw new Error(`signIn ${role}: ${signInErr.message}`);
  const { data, error } = await client.from('stores').select('id');
  if (error) throw new Error(`select stores as ${role}: ${error.message}`);
  await client.auth.signOut();
  return data!.length;
}

async function main() {
  let failures = 0;
  for (const [role, exp] of Object.entries(expected)) {
    const got = await visibleStoreCount(role);
    const ok = got === exp;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${role.padEnd(20)} expected ${exp}, saw ${got}`);
  }
  console.log(failures === 0 ? '\nAll roles scoped correctly.' : `\n${failures} role(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it and confirm it FAILS (RLS not enabled yet → everyone sees all 5)**

Run:
```bash
npm run test:rls
```
Expected: scoped roles FAIL, e.g. `FAIL  state_area_manager expected 3, saw 5`, `FAIL  nso expected 2, saw 5`, `FAIL  udc expected 1, saw 5`, `FAIL  dealer expected 1, saw 5`. Non-zero exit. This proves the test detects missing authorization.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-rls.ts
git commit -m "test(db): add RLS store-scoping test (red — RLS not yet enabled)"
```

---

## Task 8: Authorization helpers + RLS policies (green)

**Files:**
- Create: `supabase/migrations/<ts>_authz_rls.sql`

- [ ] **Step 1: Generate the migration file**

Run:
```bash
npx supabase migration new authz_rls
```

- [ ] **Step 2: Write helpers + enable RLS + policies**

```sql
-- ---- Authorization helpers (SECURITY DEFINER bypasses RLS to avoid recursion) ----
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
  else -- nso, udc, dealer
    return query select store_id from public.user_store_assignments where user_id = auth.uid();
  end if;
end;
$$;

-- ---- stores ----
alter table public.stores enable row level security;
create policy stores_select on public.stores for select to authenticated
  using (id in (select public.accessible_store_ids()));
create policy stores_admin_write on public.stores for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- ---- users ----
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

-- ---- regions ----
alter table public.regions enable row level security;
create policy regions_read on public.regions for select to authenticated using (true);
create policy regions_admin_write on public.regions for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- ---- roles_permissions ----
alter table public.roles_permissions enable row level security;
create policy roles_permissions_read on public.roles_permissions for select to authenticated using (true);
create policy roles_permissions_admin_write on public.roles_permissions for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- ---- user_store_assignments ----
alter table public.user_store_assignments enable row level security;
create policy usa_read on public.user_store_assignments for select to authenticated
  using (user_id = auth.uid() or public.auth_role() = 'super_admin');
create policy usa_admin_write on public.user_store_assignments for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- ---- user_region_assignments ----
alter table public.user_region_assignments enable row level security;
create policy ura_read on public.user_region_assignments for select to authenticated
  using (user_id = auth.uid() or public.auth_role() = 'super_admin');
create policy ura_admin_write on public.user_region_assignments for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');
```

- [ ] **Step 3: Push**

Run:
```bash
npm run db:push
```
Expected: applies `<ts>_authz_rls.sql`. "Finished supabase db push."

- [ ] **Step 4: Run the RLS test — confirm GREEN**

Run:
```bash
npm run test:rls
```
Expected: every line `PASS`, ending `All roles scoped correctly.`, exit 0. **This is the WP1 acceptance gate.**

- [ ] **Step 5: Regenerate types (new functions don't change table types, but keep in sync) and commit**

```bash
npm run gen:types
git add supabase/migrations types/database.ts
git commit -m "feat(db): add auth_role/accessible_store_ids helpers and RLS policies"
```

---

## Task 9: Typed client + permissions helper + real auth context

**Files:**
- Modify: `lib/supabase.ts`
- Create: `lib/permissions.ts`
- Modify: `lib/auth.tsx`

- [ ] **Step 1: Type the Supabase client**

In `lib/supabase.ts`, change the import + client to use the generated `Database` type:
```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
// ...existing url/key guard unchanged...
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```
(Keep the existing `import 'react-native-url-polyfill/auto';`, AsyncStorage import, and the env guard.)

- [ ] **Step 2: Write the permissions helper**

```ts
// lib/permissions.ts
export type Module = 'daily_kpi' | 'nso_visit' | 'promotion_vm' | 'resolution' | 'lms' | 'coaching';
export type Verb = 'view' | 'create' | 'edit' | 'approve' | 'export';
export type AppRole =
  | 'super_admin' | 'management' | 'state_area_manager' | 'nso'
  | 'udc' | 'dealer' | 'marketing_vm' | 'training_admin' | 'consultant';

export type PermissionRow = {
  module: Module;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_export: boolean;
};

const VERB_COLUMN: Record<Verb, keyof PermissionRow> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  approve: 'can_approve',
  export: 'can_export',
};

export function can(perms: PermissionRow[], module: Module, verb: Verb): boolean {
  const row = perms.find((p) => p.module === module);
  return row ? Boolean(row[VERB_COLUMN[verb]]) : false;
}
```

- [ ] **Step 3: Rewrite `lib/auth.tsx` as a real session/role/permissions provider**

```tsx
// lib/auth.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { can, type AppRole, type Module, type PermissionRow, type Verb } from '@/lib/permissions';

type Profile = { id: string; name: string; role: AppRole; primary_store_id: string | null };

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  can: (module: Module, verb: Verb) => boolean;
  isAdmin: boolean;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setPerms([]);
      return;
    }
    (async () => {
      const { data: prof } = await supabase
        .from('users')
        .select('id, name, role, primary_store_id')
        .eq('id', session.user.id)
        .maybeSingle();
      setProfile(prof as Profile | null);
      if (prof) {
        const { data: rows } = await supabase
          .from('roles_permissions')
          .select('module, can_view, can_create, can_edit, can_approve, can_export')
          .eq('role', prof.role);
        setPerms((rows ?? []) as PermissionRow[]);
      }
    })();
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      can: (module, verb) => can(perms, module, verb),
      isAdmin: profile?.role === 'super_admin',
      signInWithOtp: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        return { error: error?.message ?? null };
      },
      verifyOtp: async (email, token) => {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, perms, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: exit 0. (If `app/(app)/index.tsx` or `login.tsx` still reference the old `isSignedIn`/`signIn`, they're updated in Tasks 10–11; if tsc errors only there, proceed — those tasks fix them. Resolve any error in the three files touched here.)

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts lib/permissions.ts lib/auth.tsx
git commit -m "feat(auth): typed client, permissions helper, real Supabase session/role context"
```

---

## Task 10: Email-OTP login + root layout gate

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Rewrite the login screen for email OTP (request code, then verify)**

```tsx
// app/(auth)/login.tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    const { error } = await signInWithOtp(email.trim());
    setBusy(false);
    if (error) setError(error);
    else setStage('code');
  };

  const submitCode = async () => {
    setBusy(true);
    setError(null);
    const { error } = await verifyOtp(email.trim(), token.trim());
    setBusy(false);
    if (error) setError(error);
    // On success, the auth state listener flips the route automatically.
  };

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-neutral-950">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Store Performance</Text>
      <Text className="text-center text-neutral-500 dark:text-neutral-400">
        {stage === 'email' ? 'Sign in with your email — we’ll send a one-time code.' : `Enter the code sent to ${email}.`}
      </Text>

      {stage === 'email' ? (
        <TextInput
          className="w-full max-w-xs rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      ) : (
        <TextInput
          className="w-full max-w-xs rounded-xl border border-neutral-300 px-4 py-3 text-center text-lg tracking-widest text-neutral-900 dark:border-neutral-700 dark:text-white"
          placeholder="123456"
          keyboardType="number-pad"
          value={token}
          onChangeText={setToken}
        />
      )}

      {error && <Text className="max-w-xs text-center text-red-600 dark:text-red-400">{error}</Text>}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={stage === 'email' ? requestCode : submitCode}
        className="w-full max-w-xs items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {busy ? <ActivityIndicator color="#fff" /> : (
          <Text className="text-base font-semibold text-white">
            {stage === 'email' ? 'Send code' : 'Verify & sign in'}
          </Text>
        )}
      </Pressable>

      {stage === 'code' && (
        <Pressable onPress={() => setStage('email')}>
          <Text className="text-blue-600 dark:text-blue-400">Use a different email</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Gate the root layout on the real session**

In `app/_layout.tsx`, replace the `RootNavigator` to use `session` + a loading guard:
```tsx
function RootNavigator() {
  const { session, loading } = useAuth();
  if (loading) return null; // keep splash until session resolves
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
```
(Keep the `QueryClientProvider` + `AuthProvider` + `ThemeProvider` wrapping and the `import '../global.css';` unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (login.tsx no longer uses old stub API).

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login.tsx" app/_layout.tsx
git commit -m "feat(auth): email-OTP login flow and session-gated routing"
```

---

## Task 11: Role-aware home + admin gate

**Files:**
- Modify: `app/(app)/index.tsx`
- Modify: `app/(app)/_layout.tsx`

- [ ] **Step 1: Replace the WP0 home with a role-aware placeholder (removes `health_check`)**

```tsx
// app/(app)/index.tsx
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function HomeScreen() {
  const { profile, signOut, isAdmin } = useAuth();

  return (
    <ScrollView contentContainerClassName="flex-grow gap-6 bg-white px-6 py-16 dark:bg-neutral-950">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          Welcome{profile?.name ? `, ${profile.name}` : ''}
        </Text>
        <Text className="text-base text-neutral-500 dark:text-neutral-400">
          Role: {profile?.role ?? '—'}
        </Text>
      </View>

      {isAdmin && (
        <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Admin</Text>
          <Link href="/admin/stores" className="text-blue-600 dark:text-blue-400">Manage stores</Link>
          <Link href="/admin/users" className="text-blue-600 dark:text-blue-400">Manage users</Link>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        className="items-center rounded-xl border border-neutral-300 px-6 py-4 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-900">
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Keep `(app)/_layout.tsx` as a stack (no change needed beyond existing)**

Confirm `app/(app)/_layout.tsx` is:
```tsx
import { Stack } from 'expo-router';
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```
(No edit if already this.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/index.tsx"
git commit -m "feat(app): role-aware home with admin entry points"
```

---

## Task 12: Admin — stores CRUD

**Files:**
- Create: `lib/schemas/store.ts`
- Create: `lib/hooks/useStores.ts`
- Create: `app/(app)/admin/_layout.tsx`
- Create: `app/(app)/admin/stores/index.tsx`
- Create: `app/(app)/admin/stores/[id].tsx`

- [ ] **Step 1: Zod schema**

```ts
// lib/schemas/store.ts
import { z } from 'zod';

export const storeSchema = z.object({
  store_name: z.string().min(1, 'Required'),
  dealer_name: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  region_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export type StoreFormValues = z.infer<typeof storeSchema>;
```

- [ ] **Step 2: TanStack Query hooks**

```ts
// lib/hooks/useStores.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StoreFormValues } from '@/lib/schemas/store';

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('*').order('store_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: ['stores', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regions').select('id, name, type').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: StoreFormValues }) => {
      const payload = { ...values, dealer_name: values.dealer_name || null };
      if (id && id !== 'new') {
        const { error } = await supabase.from('stores').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stores').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores'] }),
  });
}
```

- [ ] **Step 3: Admin layout (gate to super_admin)**

```tsx
// app/(app)/admin/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: true }} />;
}
```

- [ ] **Step 4: Stores list**

```tsx
// app/(app)/admin/stores/index.tsx
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useStores } from '@/lib/hooks/useStores';

export default function StoresList() {
  const { data, isPending, error } = useStores();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Stores' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={
          <Link href="/admin/stores/new" className="mb-2 text-blue-600 dark:text-blue-400">+ New store</Link>
        }
        renderItem={({ item }) => (
          <Link href={`/admin/stores/${item.id}`} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.store_name}</Text>
              <Text className="text-neutral-500">{[item.city, item.state].filter(Boolean).join(', ')}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 5: Store create/edit form**

```tsx
// app/(app)/admin/stores/[id].tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { storeSchema, type StoreFormValues } from '@/lib/schemas/store';
import { useRegions, useSaveStore, useStore } from '@/lib/hooks/useStores';

export default function StoreForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: existing, isPending } = useStore(id);
  const { data: regions } = useRegions();
  const save = useSaveStore();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { store_name: '', dealer_name: '', city: '', state: '', region_id: null, active: true },
  });

  useEffect(() => {
    if (existing) reset({
      store_name: existing.store_name, dealer_name: existing.dealer_name ?? '',
      city: existing.city ?? '', state: existing.state ?? '',
      region_id: existing.region_id, active: existing.active,
    });
  }, [existing, reset]);

  const onSubmit = (values: StoreFormValues) =>
    save.mutate({ id: isNew ? undefined : id, values }, { onSuccess: () => router.back() });

  if (!isNew && isPending) return <ActivityIndicator className="mt-8" />;

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: isNew ? 'New store' : 'Edit store' }} />
      <Field name="store_name" label="Store name" control={control} error={errors.store_name?.message} />
      <Field name="dealer_name" label="Dealer name" control={control} />
      <Field name="city" label="City" control={control} />
      <Field name="state" label="State" control={control} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Region</Text>
        <Controller control={control} name="region_id" render={({ field }) => (
          <View className="flex-row flex-wrap gap-2">
            {(regions ?? []).map((reg) => (
              <Pressable key={reg.id} onPress={() => field.onChange(reg.id)}
                className={`rounded-full border px-3 py-1 ${field.value === reg.id ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                <Text className={field.value === reg.id ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{reg.name}</Text>
              </Pressable>
            ))}
          </View>
        )} />
      </View>
      <Controller control={control} name="active" render={({ field }) => (
        <View className="flex-row items-center justify-between">
          <Text className="text-neutral-900 dark:text-white">Active</Text>
          <Switch value={field.value} onValueChange={field.onChange} />
        </View>
      )} />
      {save.error && <Text className="text-red-600">{(save.error as Error).message}</Text>}
      <Pressable disabled={save.isPending} onPress={handleSubmit(onSubmit)}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({ name, label, control, error }: { name: keyof StoreFormValues; label: string; control: any; error?: string }) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Controller control={control} name={name} render={({ field }) => (
        <TextInput
          className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
          value={(field.value as string) ?? ''} onChangeText={field.onChange} />
      )} />
      {error && <Text className="text-red-600">{error}</Text>}
    </View>
  );
}
```

- [ ] **Step 6: Install the react-hook-form zod resolver**

Run:
```bash
npx expo install @hookform/resolvers
```
Expected: package added.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add lib/schemas/store.ts lib/hooks/useStores.ts "app/(app)/admin" package.json package-lock.json
git commit -m "feat(admin): stores list and create/edit form"
```

---

## Task 13: Admin — users CRUD

**Files:**
- Create: `lib/schemas/user.ts`
- Create: `lib/hooks/useUsers.ts`
- Create: `app/(app)/admin/users/index.tsx`
- Create: `app/(app)/admin/users/[id].tsx`

- [ ] **Step 1: Zod schema**

```ts
// lib/schemas/user.ts
import { z } from 'zod';

export const APP_ROLES = [
  'super_admin', 'management', 'state_area_manager', 'nso',
  'udc', 'dealer', 'marketing_vm', 'training_admin', 'consultant',
] as const;

export const userSchema = z.object({
  name: z.string().min(1, 'Required'),
  role: z.enum(APP_ROLES),
  primary_store_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export type UserFormValues = z.infer<typeof userSchema>;
```

- [ ] **Step 2: Hooks (edit existing profiles; creating new auth users is out of scope for the in-app form — see note)**

```ts
// lib/hooks/useUsers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UserFormValues } from '@/lib/schemas/user';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, name, role, primary_store_id, active').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: ['users', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, name, role, primary_store_id, active').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UserFormValues }) => {
      const { error } = await supabase.from('users').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
```

> **Note (scope):** The in-app users form **edits existing profiles** (name, role, primary store, active). Provisioning brand-new auth users requires the `service_role` admin API and is handled by the seed script in WP1; a full in-app invite flow is deferred (it needs a Supabase Edge Function so the service key never touches the client). This keeps WP1 client-safe.

- [ ] **Step 3: Users list**

```tsx
// app/(app)/admin/users/index.tsx
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useUsers } from '@/lib/hooks/useUsers';

export default function UsersList() {
  const { data, isPending, error } = useUsers();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Users' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerClassName="p-4 gap-2"
        renderItem={({ item }) => (
          <Link href={`/admin/users/${item.id}`} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.name || '(no name)'}</Text>
              <Text className="text-neutral-500">{item.role}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 4: User edit form**

```tsx
// app/(app)/admin/users/[id].tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { APP_ROLES, userSchema, type UserFormValues } from '@/lib/schemas/user';
import { useSaveUser, useUser } from '@/lib/hooks/useUsers';

export default function UserForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: existing, isPending } = useUser(id);
  const save = useSaveUser();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', role: 'udc', primary_store_id: null, active: true },
  });

  useEffect(() => {
    if (existing) reset({
      name: existing.name, role: existing.role as UserFormValues['role'],
      primary_store_id: existing.primary_store_id, active: existing.active,
    });
  }, [existing, reset]);

  if (isPending) return <ActivityIndicator className="mt-8" />;

  const onSubmit = (values: UserFormValues) =>
    save.mutate({ id: id!, values }, { onSuccess: () => router.back() });

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Edit user' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Name</Text>
        <Controller control={control} name="name" render={({ field }) => (
          <TextInput className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
            value={field.value} onChangeText={field.onChange} />
        )} />
        {errors.name && <Text className="text-red-600">{errors.name.message}</Text>}
      </View>

      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Role</Text>
        <Controller control={control} name="role" render={({ field }) => (
          <View className="flex-row flex-wrap gap-2">
            {APP_ROLES.map((r) => (
              <Pressable key={r} onPress={() => field.onChange(r)}
                className={`rounded-full border px-3 py-1 ${field.value === r ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                <Text className={field.value === r ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{r}</Text>
              </Pressable>
            ))}
          </View>
        )} />
      </View>

      <Controller control={control} name="active" render={({ field }) => (
        <View className="flex-row items-center justify-between">
          <Text className="text-neutral-900 dark:text-white">Active</Text>
          <Switch value={field.value} onValueChange={field.onChange} />
        </View>
      )} />

      {save.error && <Text className="text-red-600">{(save.error as Error).message}</Text>}
      <Pressable disabled={save.isPending} onPress={handleSubmit(onSubmit)}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save</Text>}
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas/user.ts lib/hooks/useUsers.ts "app/(app)/admin/users"
git commit -m "feat(admin): users list and profile edit form"
```

---

## Task 14: Full verification + web run

**Files:** none (verification only)

- [ ] **Step 1: Lint + typecheck**

Run:
```bash
npx tsc --noEmit && npx expo lint
```
Expected: tsc exit 0; lint reports no errors.

- [ ] **Step 2: Re-run the RLS acceptance test (must stay green)**

Run:
```bash
npm run test:rls
```
Expected: all PASS, `All roles scoped correctly.`, exit 0.

- [ ] **Step 3: Web bundle check**

Run:
```bash
npx expo export --platform web
```
Expected: exit 0; routes include `/`, `/login`, `/admin/stores`, `/admin/stores/[id]`, `/admin/users`, `/admin/users/[id]`.

- [ ] **Step 4: Manual web smoke test (the human-verifiable acceptance)**

Run `npx expo start --web --clear`, then in the browser:
1. Sign in as `super_admin@example.test` (request code → check the inbox/Supabase Auth logs for the OTP → verify). Confirm the Admin card appears; open Manage stores (see all 5) and Manage users (see all 9).
2. Sign out, sign in as `udc@example.test`. Confirm NO admin card, and that any store query is limited (1 store).
Document the result. (OTP delivery uses Supabase's built-in email; in dev you can read the code from Dashboard → Authentication → Logs if email isn't configured.)

- [ ] **Step 5: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore(wp1): verification pass — typecheck, lint, RLS test, web export"
```

---

## WP1 acceptance summary

WP1 is complete when:
- `npm run test:rls` is green for all 9 roles (DB-enforced store scoping ✅).
- A real email-OTP login routes users in, and Super Admin (and only Super Admin) sees/uses the admin store + user screens (screen scoping ✅).
- Migrations are committed in `supabase/migrations/`, types regenerated, seed reproducible.
