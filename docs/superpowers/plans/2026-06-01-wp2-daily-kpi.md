# WP2 — M1 Daily KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the daily KPI loop end-to-end — UDC submits a KPI (optional photo via private Storage), NSO approves/rejects, DB blocks duplicates, and per-role visibility is RLS-enforced.

**Architecture:** Postgres holds `daily_kpi_reports` (with generated `abv` and a `unique(store_id, report_date)` duplicate guard), a child `daily_kpi_stockout_items` table, `product_categories` master, single-row `kpi_config` for cutoff time, and a generic `attachments` table backed by a private Supabase Storage bucket. RLS reuses WP1's `auth_role()` and `accessible_store_ids()` helpers. Forward-only migrations are pushed to the linked cloud project (no Docker). The Expo app adds `kpi/*` routes plus a small Super-Admin categories + kpi-config surface.

**Tech Stack:** Same as WP1, plus `expo-image-picker` for photo capture.

**Reference spec:** [docs/superpowers/specs/2026-06-01-wp2-daily-kpi-design.md](../specs/2026-06-01-wp2-daily-kpi-design.md)

## Security constraints (NON-NEGOTIABLE — same as WP1)

- **No `service_role` key in app env, no `EXPO_PUBLIC_` exposure.** The seed/test scripts read only `SEED_PASSWORD` from gitignored `.env.seed`.
- **Private Storage bucket** (`attachments`), signed URLs only (5-min expiry). No public read.

## Review checkpoints (HARD STOPS — wait for the human)

- **Checkpoint A** — after ALL migration SQL (Tasks 1–8) is written, BEFORE `db push`. Show every migration file's content. Do not push until approved.
- **Checkpoint B** — after the extended RLS test runs green. Show per-assertion output. Do not start app code (Task 11+) until approved.

---

## File map

**Created — database / scripts:**
- `supabase/migrations/<ts>_kpi_enums.sql` — `kpi_status`, `attachment_entity`
- `supabase/migrations/<ts>_product_categories.sql` — table + seed
- `supabase/migrations/<ts>_kpi_config.sql` — single-row config
- `supabase/migrations/<ts>_attachments.sql` — generic attachments table
- `supabase/migrations/<ts>_daily_kpi.sql` — reports + stockouts + triggers
- `supabase/migrations/<ts>_attachments_storage_bucket.sql` — private bucket
- `supabase/migrations/<ts>_kpi_rls.sql` — RLS policies for the 5 tables
- `supabase/migrations/<ts>_attachments_storage_policies.sql` — `storage.objects` policies (daily_kpi_report branch)
- Extended: `scripts/test-rls.ts` — KPI fixtures + assertions

**Created — app:**
- `lib/storage.ts` — `uploadAttachmentObject`, `signedUrlFor`
- `lib/schemas/kpi.ts` — zod schemas
- `lib/hooks/useCategories.ts`
- `lib/hooks/useKpi.ts` — today / by-id / pending / missing-today / submit / review
- `app/(app)/kpi/_layout.tsx`
- `app/(app)/kpi/index.tsx`, `app/(app)/kpi/new.tsx`, `app/(app)/kpi/[id].tsx`, `app/(app)/kpi/pending.tsx`
- `app/(app)/admin/categories/index.tsx`, `app/(app)/admin/categories/[id].tsx`
- `app/(app)/admin/kpi-config.tsx`
- `lib/schemas/category.ts`, `lib/hooks/useCategoryAdmin.ts`

**Modified — app:**
- `app/(app)/index.tsx` — UDC "not submitted today" banner; NSO "stores missing today" tile; link to `/kpi`

---

## Task 0: Install `expo-image-picker`

- [ ] **Step 1:** Run `npx expo install expo-image-picker`
Expected: package added.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(wp2): install expo-image-picker"
```

---

## Task 1: kpi_enums migration (write only)

- [ ] **Step 1:** Run `npx supabase migration new kpi_enums`

- [ ] **Step 2: Write**

```sql
create type public.kpi_status as enum ('submitted','approved','rejected','edited');

create type public.attachment_entity as enum (
  'daily_kpi_report','checklist_submission','nso_visit','promotion_compliance'
);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): add kpi_status and attachment_entity enums"
```

---

## Task 2: product_categories migration (write only)

- [ ] **Step 1:** Run `npx supabase migration new product_categories`

- [ ] **Step 2: Write**

```sql
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.product_categories (name) values
  ('Snacks'), ('Beverages'), ('Tobacco'), ('Auto care'), ('FMCG'), ('Other');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): product_categories master + starter list"
```

---

## Task 3: kpi_config migration (write only)

- [ ] **Step 1:** Run `npx supabase migration new kpi_config`

- [ ] **Step 2: Write**

```sql
create table public.kpi_config (
  id integer primary key check (id = 1),
  daily_cutoff_time time not null default '22:00',
  updated_at timestamptz not null default now()
);

insert into public.kpi_config (id, daily_cutoff_time) values (1, '22:00');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): kpi_config single-row table seeded with 22:00 cutoff"
```

---

## Task 4: attachments migration (write only)

- [ ] **Step 1:** Run `npx supabase migration new attachments`

- [ ] **Step 2: Write**

```sql
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type public.attachment_entity not null,
  entity_id uuid not null,
  storage_path text not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index attachments_entity_idx on public.attachments(entity_type, entity_id);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): generic attachments table (reused by WP3/4/5)"
```

---

## Task 5: daily_kpi migration (write only)

Includes the reports table (with generated `abv` and unique guard), the stockouts child, the `set_late_flag` trigger, and a `kpi_protect_status` trigger that stops a non-reviewer submitter from approving themselves.

- [ ] **Step 1:** Run `npx supabase migration new daily_kpi`

- [ ] **Step 2: Write**

```sql
create table public.daily_kpi_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  report_date date not null,
  udc_id uuid references public.users(id) on delete set null,
  nso_id uuid references public.users(id) on delete set null,
  nob integer not null check (nob >= 0),
  walk_ins integer check (walk_ins >= 0),
  total_sales numeric(12,2) not null check (total_sales >= 0),
  abv numeric(12,2) generated always as
    (case when nob > 0 then total_sales / nob else 0 end) stored,
  promotion_sales numeric(12,2),
  fuel_conversion_pct numeric(5,2),
  top_category_id uuid references public.product_categories(id) on delete set null,
  top_category_remarks text,
  slow_category_id uuid references public.product_categories(id) on delete set null,
  slow_category_remarks text,
  support_needed text,
  status public.kpi_status not null default 'submitted',
  late boolean not null default false,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  submitted_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique (store_id, report_date)
);
create index daily_kpi_store_date_idx on public.daily_kpi_reports(store_id, report_date desc);
create index daily_kpi_status_idx on public.daily_kpi_reports(status);

create table public.daily_kpi_stockout_items (
  id uuid primary key default gen_random_uuid(),
  kpi_report_id uuid not null references public.daily_kpi_reports(id) on delete cascade,
  sku text,
  category_id uuid references public.product_categories(id) on delete set null,
  remarks text,
  created_at timestamptz not null default now()
);
create index dksi_kpi_idx on public.daily_kpi_stockout_items(kpi_report_id);

-- Set the `late` flag from kpi_config.daily_cutoff_time (project TZ: Asia/Kolkata).
create or replace function public.set_kpi_late_flag()
returns trigger
language plpgsql
as $$
declare cutoff time;
begin
  select daily_cutoff_time into cutoff from public.kpi_config where id = 1;
  new.late := ((new.submitted_at at time zone 'Asia/Kolkata')::time > cutoff);
  return new;
end;
$$;

create trigger kpi_set_late
  before insert or update of submitted_at on public.daily_kpi_reports
  for each row execute function public.set_kpi_late_flag();

-- Submitters can edit non-status fields; only reviewers can change status.
create or replace function public.kpi_protect_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.submitted_by = auth.uid()
     and public.auth_role() not in ('nso','state_area_manager','super_admin') then
    raise exception 'Submitter cannot change KPI status';
  end if;
  return new;
end;
$$;

create trigger kpi_protect_status_trg
  before update on public.daily_kpi_reports
  for each row execute function public.kpi_protect_status();
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): daily_kpi_reports + stockouts + late/status-protect triggers"
```

---

## Task 6: attachments_storage_bucket migration (write only)

- [ ] **Step 1:** Run `npx supabase migration new attachments_storage_bucket`

- [ ] **Step 2: Write**

```sql
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(storage): create private attachments bucket"
```

---

## Task 7: kpi_rls migration (write only)

- [ ] **Step 1:** Run `npx supabase migration new kpi_rls`

- [ ] **Step 2: Write**

```sql
-- product_categories
alter table public.product_categories enable row level security;
create policy product_categories_read on public.product_categories for select to authenticated using (true);
create policy product_categories_admin_write on public.product_categories for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- kpi_config
alter table public.kpi_config enable row level security;
create policy kpi_config_read on public.kpi_config for select to authenticated using (true);
create policy kpi_config_admin_write on public.kpi_config for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- attachments — WP2 implements ONLY the daily_kpi_report branch.
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

-- daily_kpi_reports
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

-- daily_kpi_stockout_items — inherit parent scope
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
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): RLS policies for kpi tables, categories, config, attachments"
```

---

## Task 8: attachments_storage_policies migration (write only)

Path convention: `daily_kpi_report/<kpi_id>/<uuid>.<ext>`. The storage policies enforce that the second path segment is a kpi row in scope.

- [ ] **Step 1:** Run `npx supabase migration new attachments_storage_policies`

- [ ] **Step 2: Write**

```sql
-- SELECT: an authenticated user may read the object iff a matching attachments row
-- exists AND that row's entity is in scope (which the attachments RLS already enforces).
create policy attachments_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.attachments a
      where a.storage_path = storage.objects.name
    )
  );

-- INSERT: the path must encode 'daily_kpi_report/<kpi_id>/...' AND that kpi row must be in scope.
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

-- DELETE: super_admin only.
create policy attachments_objects_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.auth_role() = 'super_admin');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(storage): RLS policies on storage.objects (daily_kpi_report branch)"
```

---

## 🛑 CHECKPOINT A — present all 8 migration files; do NOT push until approved.

- [ ] Present the contents of Tasks 1–8 migration files to the human. Wait for explicit approval.

---

## Task 9: Push migrations + regen types

- [ ] **Step 1: Push**

```bash
npm run db:push
```
Expected: applies 8 migrations; ends "Finished supabase db push."

- [ ] **Step 2: Regenerate types**

```bash
npm run gen:types
```
Expected: `types/database.ts` updated to include the new tables/enums.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(db): push WP2 schema and regenerate types"
```

---

## Task 10: Extend RLS test with KPI fixtures + assertions

**Files:** Modify `scripts/test-rls.ts`

This test signs in as `udc`, inserts a KPI row + a stockout child for `Indore Forecourt 1`, attempts a duplicate, then asserts visibility counts per role and that NSO can approve / UDC cannot.

- [ ] **Step 1: Replace `scripts/test-rls.ts` with**

```ts
// scripts/test-rls.ts — run with: npm run test:rls
import { config } from 'dotenv';
config();
config({ path: '.env.seed' });

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const password = process.env.SEED_PASSWORD!;
if (!url || !anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!password) throw new Error('Missing SEED_PASSWORD (create .env.seed)');

const STORE_INDORE_1 = '00000000-0000-0000-0000-0000000000a1';

function clientFor(role: string) {
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signIn(c: ReturnType<typeof clientFor>, role: string) {
  const { error } = await c.auth.signInWithPassword({ email: `${role}@example.test`, password });
  if (error) throw new Error(`signIn ${role}: ${error.message}`);
}

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
}

async function visibleStoreCount(role: string): Promise<number> {
  const c = clientFor(role); await signIn(c, role);
  const { data, error } = await c.from('stores').select('id');
  if (error) throw new Error(`select stores as ${role}: ${error.message}`);
  await c.auth.signOut();
  return data!.length;
}

async function visibleKpiCount(role: string): Promise<number> {
  const c = clientFor(role); await signIn(c, role);
  const { data, error } = await c.from('daily_kpi_reports').select('id');
  if (error) throw new Error(`select kpi as ${role}: ${error.message}`);
  await c.auth.signOut();
  return data!.length;
}

async function ensureUdcKpiForToday(): Promise<string> {
  const c = clientFor('udc'); await signIn(c, 'udc');
  const today = new Date().toISOString().slice(0, 10);
  // If a row already exists from a prior test run, return it.
  const { data: existing } = await c.from('daily_kpi_reports')
    .select('id').eq('store_id', STORE_INDORE_1).eq('report_date', today).maybeSingle();
  if (existing) { await c.auth.signOut(); return existing.id; }

  const { data: me } = await c.auth.getUser();
  const { data: row, error } = await c.from('daily_kpi_reports').insert({
    store_id: STORE_INDORE_1,
    report_date: today,
    nob: 25,
    walk_ins: 80,
    total_sales: 5000,
    submitted_by: me.user!.id,
  }).select('id').single();
  if (error) throw new Error(`udc insert kpi: ${error.message}`);

  const { error: sErr } = await c.from('daily_kpi_stockout_items').insert({
    kpi_report_id: row.id, sku: 'TEST-SKU', remarks: 'auto fixture',
  });
  if (sErr) throw new Error(`udc insert stockout: ${sErr.message}`);

  await c.auth.signOut();
  return row.id;
}

async function expectDuplicateBlocked() {
  const c = clientFor('udc'); await signIn(c, 'udc');
  const today = new Date().toISOString().slice(0, 10);
  const { data: me } = await c.auth.getUser();
  const { error } = await c.from('daily_kpi_reports').insert({
    store_id: STORE_INDORE_1, report_date: today, nob: 1, total_sales: 1, submitted_by: me.user!.id,
  });
  await c.auth.signOut();
  check('duplicate (store,date) blocked', error?.code === '23505', error?.message);
}

async function expectUdcCannotApprove(kpiId: string) {
  const c = clientFor('udc'); await signIn(c, 'udc');
  const { error } = await c.from('daily_kpi_reports')
    .update({ status: 'approved' }).eq('id', kpiId);
  await c.auth.signOut();
  check('udc cannot self-approve', error !== null && /status/i.test(error?.message ?? ''), error?.message);
}

async function expectNsoCanApprove(kpiId: string) {
  const c = clientFor('nso'); await signIn(c, 'nso');
  const { data: me } = await c.auth.getUser();
  const { error } = await c.from('daily_kpi_reports')
    .update({
      status: 'approved',
      reviewed_by: me.user!.id,
      reviewed_at: new Date().toISOString(),
      review_comment: 'looks good',
    }).eq('id', kpiId);
  await c.auth.signOut();
  check('nso can approve', error === null, error?.message);
}

async function main() {
  // 1. Existing per-role store visibility (from WP1, must still pass).
  const expectedStores: Record<string, number> = {
    super_admin: 5, management: 5, state_area_manager: 3,
    nso: 2, udc: 1, dealer: 1,
    marketing_vm: 5, training_admin: 5, consultant: 5,
  };
  for (const [role, exp] of Object.entries(expectedStores)) {
    const got = await visibleStoreCount(role);
    check(`stores ${role}`, got === exp, `expected ${exp}, saw ${got}`);
  }

  // 2. Ensure today's KPI fixture exists.
  const kpiId = await ensureUdcKpiForToday();

  // 3. Duplicate guard.
  await expectDuplicateBlocked();

  // 4. Per-role KPI visibility (every role assigned/scoped to S1 sees 1 row).
  const expectedKpi: Record<string, number> = {
    super_admin: 1, management: 1, state_area_manager: 1,
    nso: 1, udc: 1, dealer: 1,
    marketing_vm: 1, training_admin: 1, consultant: 1,
  };
  for (const [role, exp] of Object.entries(expectedKpi)) {
    const got = await visibleKpiCount(role);
    check(`kpi ${role}`, got === exp, `expected ${exp}, saw ${got}`);
  }

  // 5. UDC cannot approve; NSO can.
  await expectUdcCannotApprove(kpiId);
  await expectNsoCanApprove(kpiId);

  console.log(failures === 0 ? '\nAll WP2 assertions passed.' : `\n${failures} assertion(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it**

```bash
npm run test:rls
```
Expected: all `PASS`, ending `All WP2 assertions passed.`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-rls.ts
git commit -m "test(wp2): extend RLS test with KPI fixtures and review-action assertions"
```

- [ ] 🛑 **CHECKPOINT B — present the PASS/FAIL output and wait for approval before Task 11.**

---

## Task 11: Storage helpers

**Files:** Create `lib/storage.ts`

- [ ] **Step 1: Write `lib/storage.ts`**

```ts
import { supabase } from '@/lib/supabase';

type EntityType = 'daily_kpi_report' | 'checklist_submission' | 'nso_visit' | 'promotion_compliance';

function uuid(): string {
  // Works on web and RN (RN polyfilled by react-native-url-polyfill/auto).
  return (globalThis.crypto as Crypto).randomUUID();
}

export async function uploadAttachmentObject(opts: {
  entityType: EntityType;
  entityId: string;
  file: Blob;
  ext: string;
}): Promise<string> {
  const path = `${opts.entityType}/${opts.entityId}/${uuid()}.${opts.ext}`;
  const { error } = await supabase.storage.from('attachments').upload(path, opts.file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function signedUrlFor(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat(storage): upload + signed-URL helpers for attachments bucket"
```

---

## Task 12: Schemas + hooks (categories, kpi)

**Files:** Create `lib/schemas/kpi.ts`, `lib/hooks/useCategories.ts`, `lib/hooks/useKpi.ts`

- [ ] **Step 1: `lib/schemas/kpi.ts`**

```ts
import { z } from 'zod';

const optionalText = z.string().optional().or(z.literal(''));

export const stockoutItemSchema = z.object({
  sku: optionalText,
  category_id: z.string().uuid().nullable().optional(),
  remarks: optionalText,
});

export const kpiFormSchema = z.object({
  store_id: z.string().uuid(),
  nob: z.coerce.number().int().nonnegative(),
  walk_ins: z.coerce.number().int().nonnegative().optional(),
  total_sales: z.coerce.number().nonnegative(),
  promotion_sales: z.coerce.number().nonnegative().optional(),
  fuel_conversion_pct: z.coerce.number().min(0).max(100).optional(),
  top_category_id: z.string().uuid().nullable().optional(),
  top_category_remarks: optionalText,
  slow_category_id: z.string().uuid().nullable().optional(),
  slow_category_remarks: optionalText,
  support_needed: optionalText,
  stockouts: z.array(stockoutItemSchema),
});

export type KpiFormValues = z.infer<typeof kpiFormSchema>;
export type StockoutItem = z.infer<typeof stockoutItemSchema>;
```

- [ ] **Step 2: `lib/hooks/useCategories.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useCategories() {
  return useQuery({
    queryKey: ['product_categories', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories').select('id, name, active').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
}
```

- [ ] **Step 3: `lib/hooks/useKpi.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadAttachmentObject } from '@/lib/storage';
import type { KpiFormValues } from '@/lib/schemas/kpi';

const today = () => new Date().toISOString().slice(0, 10);

export function useTodayKpi(storeId: string | undefined) {
  return useQuery({
    queryKey: ['kpi', 'today', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_kpi_reports').select('*')
        .eq('store_id', storeId!).eq('report_date', today()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiReport(id: string | undefined) {
  return useQuery({
    queryKey: ['kpi', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: report, error } = await supabase
        .from('daily_kpi_reports')
        .select('*, daily_kpi_stockout_items(*), stores(store_name)')
        .eq('id', id!).single();
      if (error) throw error;
      const { data: atts } = await supabase
        .from('attachments').select('*')
        .eq('entity_type', 'daily_kpi_report').eq('entity_id', id!);
      return { ...report, attachments: atts ?? [] };
    },
  });
}

export function usePendingKpi() {
  return useQuery({
    queryKey: ['kpi', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_kpi_reports')
        .select('id, report_date, status, store_id, late, nob, total_sales, abv, stores(store_name)')
        .eq('status', 'submitted')
        .order('report_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMissingTodayStores() {
  return useQuery({
    queryKey: ['kpi', 'missing-today'],
    queryFn: async () => {
      const [{ data: stores, error: sErr }, { data: reports, error: rErr }] = await Promise.all([
        supabase.from('stores').select('id, store_name').eq('active', true),
        supabase.from('daily_kpi_reports').select('store_id').eq('report_date', today()),
      ]);
      if (sErr) throw sErr;
      if (rErr) throw rErr;
      const done = new Set((reports ?? []).map((r) => r.store_id));
      return (stores ?? []).filter((s) => !done.has(s.id));
    },
  });
}

export function useSubmitKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { values: KpiFormValues; photo?: { blob: Blob; ext: string } | null }) => {
      const { values, photo } = args;

      const [{ data: udcAsg }, { data: nsoAsg }, { data: me }] = await Promise.all([
        supabase.from('user_store_assignments').select('user_id')
          .eq('store_id', values.store_id).eq('assignment_type', 'udc').limit(1).maybeSingle(),
        supabase.from('user_store_assignments').select('user_id')
          .eq('store_id', values.store_id).eq('assignment_type', 'nso').limit(1).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (!me.user) throw new Error('Not signed in');

      const { stockouts, ...kpi } = values;

      const insertPayload = {
        store_id: kpi.store_id,
        report_date: today(),
        nob: kpi.nob,
        walk_ins: kpi.walk_ins ?? null,
        total_sales: kpi.total_sales,
        promotion_sales: kpi.promotion_sales ?? null,
        fuel_conversion_pct: kpi.fuel_conversion_pct ?? null,
        top_category_id: kpi.top_category_id || null,
        top_category_remarks: kpi.top_category_remarks || null,
        slow_category_id: kpi.slow_category_id || null,
        slow_category_remarks: kpi.slow_category_remarks || null,
        support_needed: kpi.support_needed || null,
        udc_id: udcAsg?.user_id ?? null,
        nso_id: nsoAsg?.user_id ?? null,
        submitted_by: me.user.id,
      };

      const { data: row, error } = await supabase.from('daily_kpi_reports')
        .insert(insertPayload).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('Already submitted today for this store');
        throw error;
      }

      const cleanStockouts = stockouts
        .filter((s) => s.sku || s.category_id || s.remarks)
        .map((s) => ({
          kpi_report_id: row.id,
          sku: s.sku || null,
          category_id: s.category_id || null,
          remarks: s.remarks || null,
        }));
      if (cleanStockouts.length > 0) {
        const { error: sErr } = await supabase.from('daily_kpi_stockout_items').insert(cleanStockouts);
        if (sErr) throw sErr;
      }

      if (photo) {
        const path = await uploadAttachmentObject({
          entityType: 'daily_kpi_report', entityId: row.id, file: photo.blob, ext: photo.ext,
        });
        const { error: aErr } = await supabase.from('attachments').insert({
          entity_type: 'daily_kpi_report', entity_id: row.id, storage_path: path, uploaded_by: me.user.id,
        });
        if (aErr) throw aErr;
      }

      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi'] }),
  });
}

export function useReviewKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; decision: 'approved' | 'rejected'; comment?: string }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from('daily_kpi_reports').update({
        status: args.decision,
        reviewed_by: me.user!.id,
        reviewed_at: new Date().toISOString(),
        review_comment: args.comment ?? null,
      }).eq('id', args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi'] }),
  });
}
```

- [ ] **Step 4: Typecheck** — `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/kpi.ts lib/hooks/useCategories.ts lib/hooks/useKpi.ts
git commit -m "feat(kpi): zod schema + TanStack hooks for KPI + categories"
```

---

## Task 13: KPI form screen

**Files:** Create `app/(app)/kpi/_layout.tsx`, `app/(app)/kpi/new.tsx`

- [ ] **Step 1: `app/(app)/kpi/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
export default function KpiLayout() {
  return <Stack screenOptions={{ headerShown: true }} />;
}
```

- [ ] **Step 2: `app/(app)/kpi/new.tsx`**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { kpiFormSchema, type KpiFormValues } from '@/lib/schemas/kpi';
import { useCategories } from '@/lib/hooks/useCategories';
import { useSubmitKpi } from '@/lib/hooks/useKpi';

export default function NewKpiScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const submit = useSubmitKpi();
  const { data: cats } = useCategories();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const defaultStore = profile?.primary_store_id ?? '';
  const { control, handleSubmit, watch, formState: { errors } } = useForm<KpiFormValues>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: {
      store_id: defaultStore,
      nob: 0, walk_ins: undefined, total_sales: 0,
      promotion_sales: undefined, fuel_conversion_pct: undefined,
      top_category_id: null, top_category_remarks: '',
      slow_category_id: null, slow_category_remarks: '',
      support_needed: '',
      stockouts: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'stockouts' });

  const nob = watch('nob');
  const sales = watch('total_sales');
  const liveAbv = useMemo(() => (Number(nob) > 0 ? (Number(sales) / Number(nob)).toFixed(2) : '—'), [nob, sales]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const blob = await (await fetch(asset.uri)).blob();
    setPhotoUri(asset.uri);
    setPhotoBlob(blob);
  };

  const onSubmit = (values: KpiFormValues) => {
    const photo = photoBlob ? { blob: photoBlob, ext: 'jpg' } : null;
    submit.mutate({ values, photo }, { onSuccess: (row) => router.replace(`/kpi/${row.id}`) });
  };

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: "Today's KPI" }} />

      <Field control={control} name="nob" label="NOB (Number of Bills)" keyboardType="numeric" error={errors.nob?.message} />
      <Field control={control} name="walk_ins" label="Walk-ins (estimate ok)" keyboardType="numeric" />
      <Field control={control} name="total_sales" label="Total Sales (₹)" keyboardType="decimal-pad" error={errors.total_sales?.message} />

      <View className="rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
        <Text className="text-sm text-neutral-500">ABV (auto)</Text>
        <Text className="text-xl font-semibold text-neutral-900 dark:text-white">₹ {liveAbv}</Text>
      </View>

      <Field control={control} name="promotion_sales" label="Promotion Sales (₹, optional)" keyboardType="decimal-pad" />
      <Field control={control} name="fuel_conversion_pct" label="Fuel → store conversion % (optional)" keyboardType="decimal-pad" />

      <CategoryPicker control={control} name="top_category_id" label="Top selling category" cats={cats ?? []} />
      <Field control={control} name="top_category_remarks" label="Top category remarks" />
      <CategoryPicker control={control} name="slow_category_id" label="Slow moving category" cats={cats ?? []} />
      <Field control={control} name="slow_category_remarks" label="Slow category remarks" />

      <Text className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">Stockouts</Text>
      {fields.map((f, i) => (
        <View key={f.id} className="gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <Field control={control} name={`stockouts.${i}.sku`} label="SKU" />
          <CategoryPicker control={control} name={`stockouts.${i}.category_id`} label="Category" cats={cats ?? []} />
          <Field control={control} name={`stockouts.${i}.remarks`} label="Remarks" />
          <Pressable onPress={() => remove(i)} className="self-end"><Text className="text-red-600">Remove</Text></Pressable>
        </View>
      ))}
      <Pressable onPress={() => append({ sku: '', category_id: null, remarks: '' })}
        className="items-center rounded-xl border border-dashed border-neutral-400 p-3">
        <Text className="text-neutral-700 dark:text-neutral-300">+ Add stockout item</Text>
      </Pressable>

      <Field control={control} name="support_needed" label="Support needed" multiline />

      <Text className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">Photo (optional)</Text>
      {photoUri && <Image source={{ uri: photoUri }} style={{ width: 120, height: 120, borderRadius: 12 }} />}
      <Pressable onPress={pickPhoto} className="items-center rounded-xl border border-neutral-300 p-3 dark:border-neutral-700">
        <Text className="text-neutral-700 dark:text-neutral-300">{photoUri ? 'Replace photo' : 'Add photo'}</Text>
      </Pressable>

      {submit.error && <Text className="text-red-600">{(submit.error as Error).message}</Text>}
      <Pressable disabled={submit.isPending} onPress={handleSubmit(onSubmit)}
        className="mt-2 items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Submit KPI</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({ control, name, label, keyboardType, error, multiline }: {
  control: any; name: string; label: string;
  keyboardType?: 'numeric' | 'decimal-pad' | 'default';
  error?: string; multiline?: boolean;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Controller control={control} name={name} render={({ field }) => (
        <TextInput
          className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
          value={field.value == null ? '' : String(field.value)}
          onChangeText={field.onChange}
          keyboardType={keyboardType}
          multiline={multiline}
        />
      )} />
      {error && <Text className="text-red-600">{error}</Text>}
    </View>
  );
}

function CategoryPicker({ control, name, label, cats }: {
  control: any; name: string; label: string; cats: { id: string; name: string }[];
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Controller control={control} name={name} render={({ field }) => (
        <View className="flex-row flex-wrap gap-2">
          {cats.map((c) => (
            <Pressable key={c.id} onPress={() => field.onChange(field.value === c.id ? null : c.id)}
              className={`rounded-full border px-3 py-1 ${field.value === c.id ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
              <Text className={field.value === c.id ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )} />
    </View>
  );
}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/kpi"
git commit -m "feat(kpi): submission form with live ABV, stockouts, optional photo"
```

---

## Task 14: KPI today/index, detail, pending queue

**Files:** Create `app/(app)/kpi/index.tsx`, `app/(app)/kpi/[id].tsx`, `app/(app)/kpi/pending.tsx`

- [ ] **Step 1: `app/(app)/kpi/index.tsx`** (today's-status + history)

```tsx
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useTodayKpi } from '@/lib/hooks/useKpi';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

function useRecentKpi(storeId: string | undefined) {
  return useQuery({
    queryKey: ['kpi', 'recent', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_kpi_reports').select('id, report_date, status, late, nob, total_sales, abv')
        .eq('store_id', storeId!).order('report_date', { ascending: false }).limit(14);
      if (error) throw error;
      return data;
    },
  });
}

export default function KpiIndex() {
  const { profile } = useAuth();
  const storeId = profile?.primary_store_id ?? undefined;
  const today = useTodayKpi(storeId);
  const recent = useRecentKpi(storeId);

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Daily KPI' }} />

      <View className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        {today.isPending ? <ActivityIndicator /> : today.data ? (
          <Link href={`/kpi/${today.data.id}`}>
            <Text className="text-neutral-700 dark:text-neutral-300">
              Today: {today.data.status} • NOB {today.data.nob} • Sales ₹{today.data.total_sales} • ABV ₹{today.data.abv}
            </Text>
          </Link>
        ) : (
          <Link href="/kpi/new" className="text-blue-600 dark:text-blue-400">+ Submit today's KPI</Link>
        )}
      </View>

      <FlatList
        data={recent.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={<Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Recent</Text>}
        renderItem={({ item }) => (
          <Link href={`/kpi/${item.id}`} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="text-neutral-900 dark:text-white">{item.report_date} — {item.status}{item.late ? ' (late)' : ''}</Text>
              <Text className="text-neutral-500">NOB {item.nob} • ₹{item.total_sales} • ABV ₹{item.abv}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: `app/(app)/kpi/[id].tsx`** (detail + review)

```tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useKpiReport, useReviewKpi } from '@/lib/hooks/useKpi';
import { signedUrlFor } from '@/lib/storage';

export default function KpiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { data, isPending, error } = useKpiReport(id);
  const review = useReviewKpi();
  const [comment, setComment] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.attachments) return;
    (async () => {
      const urls = await Promise.all(data.attachments.map((a: { storage_path: string }) => signedUrlFor(a.storage_path)));
      setPhotoUrls(urls);
    })();
  }, [data]);

  if (isPending) return <ActivityIndicator className="mt-8" />;
  if (error) return <Text className="p-6 text-red-600">{(error as Error).message}</Text>;
  if (!data) return null;

  const canReview = ['nso', 'state_area_manager', 'super_admin'].includes(profile?.role ?? '') && data.status === 'submitted';

  const decide = (decision: 'approved' | 'rejected') =>
    review.mutate({ id: id!, decision, comment: decision === 'rejected' ? comment : undefined }, {
      onSuccess: () => router.back(),
    });

  return (
    <ScrollView contentContainerClassName="gap-3 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: `${(data as any).stores?.store_name ?? 'Store'} — ${data.report_date}` }} />
      <Row label="Status" value={`${data.status}${data.late ? ' (late)' : ''}`} />
      <Row label="NOB" value={data.nob} />
      <Row label="Walk-ins" value={data.walk_ins ?? '—'} />
      <Row label="Total Sales" value={`₹${data.total_sales}`} />
      <Row label="ABV" value={`₹${data.abv}`} />
      <Row label="Promotion sales" value={data.promotion_sales ?? '—'} />
      <Row label="Fuel→store %" value={data.fuel_conversion_pct ?? '—'} />
      <Row label="Support needed" value={data.support_needed ?? '—'} />

      {data.daily_kpi_stockout_items?.length > 0 && (
        <View className="gap-1">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Stockouts</Text>
          {data.daily_kpi_stockout_items.map((s: any) => (
            <Text key={s.id} className="text-neutral-700 dark:text-neutral-300">
              • {s.sku || '(no SKU)'} {s.remarks ? `— ${s.remarks}` : ''}
            </Text>
          ))}
        </View>
      )}

      {photoUrls.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 200, height: 200, borderRadius: 12 }} />)}

      {data.review_comment && <Row label="Review comment" value={data.review_comment} />}

      {canReview && (
        <View className="mt-4 gap-2">
          <TextInput placeholder="Comment (required for reject)" value={comment} onChangeText={setComment}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white" />
          {review.error && <Text className="text-red-600">{(review.error as Error).message}</Text>}
          <View className="flex-row gap-2">
            <Pressable onPress={() => decide('approved')} disabled={review.isPending}
              className="flex-1 items-center rounded-xl bg-green-600 px-4 py-3 active:bg-green-700">
              <Text className="font-semibold text-white">Approve</Text>
            </Pressable>
            <Pressable onPress={() => decide('rejected')} disabled={review.isPending || !comment}
              className="flex-1 items-center rounded-xl bg-red-600 px-4 py-3 disabled:opacity-50 active:bg-red-700">
              <Text className="font-semibold text-white">Reject</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <View className="flex-row justify-between border-b border-neutral-100 pb-1 dark:border-neutral-900">
      <Text className="text-neutral-500">{label}</Text>
      <Text className="text-neutral-900 dark:text-white">{String(value)}</Text>
    </View>
  );
}
```

- [ ] **Step 3: `app/(app)/kpi/pending.tsx`** (NSO queue)

```tsx
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { usePendingKpi } from '@/lib/hooks/useKpi';

export default function PendingKpi() {
  const { data, isPending, error } = usePendingKpi();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Pending review' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerClassName="p-4 gap-2"
        renderItem={({ item }) => (
          <Link href={`/kpi/${item.id}`} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{(item as any).stores?.store_name ?? '—'}</Text>
              <Text className="text-neutral-500">{item.report_date}{item.late ? ' • late' : ''} • NOB {item.nob} • ₹{item.total_sales}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 4: Typecheck** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/kpi"
git commit -m "feat(kpi): index/recent, detail with review actions, NSO pending queue"
```

---

## Task 15: Home tiles for KPI

**Files:** Modify `app/(app)/index.tsx`

- [ ] **Step 1: Replace `app/(app)/index.tsx` with**

```tsx
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useMissingTodayStores, useTodayKpi } from '@/lib/hooks/useKpi';

export default function HomeScreen() {
  const { profile, signOut, isAdmin } = useAuth();
  const storeId = profile?.primary_store_id ?? undefined;
  const today = useTodayKpi(storeId);
  const isReviewer = ['nso', 'state_area_manager'].includes(profile?.role ?? '');
  const missing = useMissingTodayStores();

  return (
    <ScrollView contentContainerClassName="flex-grow gap-6 bg-white px-6 py-16 dark:bg-neutral-950">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          Welcome{profile?.name ? `, ${profile.name}` : ''}
        </Text>
        <Text className="text-base text-neutral-500 dark:text-neutral-400">Role: {profile?.role ?? '—'}</Text>
      </View>

      {storeId && !today.isPending && !today.data && (
        <Link href="/kpi/new" className="rounded-xl border border-amber-400 bg-amber-50 p-4 dark:bg-amber-950">
          <Text className="font-semibold text-amber-900 dark:text-amber-200">You haven&apos;t submitted today&apos;s KPI</Text>
          <Text className="text-amber-800 dark:text-amber-300">Tap to submit now</Text>
        </Link>
      )}

      <Link href="/kpi" className="text-blue-600 dark:text-blue-400">Open Daily KPI</Link>

      {isReviewer && (
        <View className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Reviews</Text>
          <Link href="/kpi/pending" className="text-blue-600 dark:text-blue-400">Pending KPI reviews</Link>
          {missing.isPending ? <ActivityIndicator /> : (
            <Text className="text-neutral-600 dark:text-neutral-300">
              Stores missing today&apos;s report: {missing.data?.length ?? 0}
            </Text>
          )}
        </View>
      )}

      {isAdmin && (
        <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Admin</Text>
          <Link href="/admin/stores" className="text-blue-600 dark:text-blue-400">Manage stores</Link>
          <Link href="/admin/users" className="text-blue-600 dark:text-blue-400">Manage users</Link>
          <Link href="/admin/categories" className="text-blue-600 dark:text-blue-400">Product categories</Link>
          <Link href="/admin/kpi-config" className="text-blue-600 dark:text-blue-400">KPI config</Link>
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={signOut}
        className="items-center rounded-xl border border-neutral-300 px-6 py-4 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-900">
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/index.tsx"
git commit -m "feat(home): UDC missing-today banner + NSO pending/missing tiles"
```

---

## Task 16: Admin — categories CRUD + kpi-config

**Files:** Create `lib/schemas/category.ts`, `lib/hooks/useCategoryAdmin.ts`, `app/(app)/admin/categories/index.tsx`, `app/(app)/admin/categories/[id].tsx`, `app/(app)/admin/kpi-config.tsx`

- [ ] **Step 1: `lib/schemas/category.ts`**

```ts
import { z } from 'zod';
export const categorySchema = z.object({
  name: z.string().min(1, 'Required'),
  active: z.boolean(),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;
```

- [ ] **Step 2: `lib/hooks/useCategoryAdmin.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CategoryFormValues } from '@/lib/schemas/category';

export function useAllCategories() {
  return useQuery({
    queryKey: ['product_categories', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: ['product_categories', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase.from('product_categories').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CategoryFormValues }) => {
      if (id && id !== 'new') {
        const { error } = await supabase.from('product_categories').update(values).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_categories').insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_categories'] }),
  });
}

export function useKpiConfig() {
  return useQuery({
    queryKey: ['kpi_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kpi_config').select('*').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveKpiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cutoff: string) => {
      const { error } = await supabase.from('kpi_config')
        .update({ daily_cutoff_time: cutoff, updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi_config'] }),
  });
}
```

- [ ] **Step 3: `app/(app)/admin/categories/index.tsx`**

```tsx
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAllCategories } from '@/lib/hooks/useCategoryAdmin';

export default function CategoriesList() {
  const { data, isPending, error } = useAllCategories();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Categories' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={<Link href="/admin/categories/new" className="mb-2 text-blue-600 dark:text-blue-400">+ New category</Link>}
        renderItem={({ item }) => (
          <Link href={`/admin/categories/${item.id}`} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.name}</Text>
              <Text className="text-neutral-500">{item.active ? 'Active' : 'Inactive'}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 4: `app/(app)/admin/categories/[id].tsx`**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { categorySchema, type CategoryFormValues } from '@/lib/schemas/category';
import { useCategory, useSaveCategory } from '@/lib/hooks/useCategoryAdmin';

export default function CategoryForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: existing, isPending } = useCategory(id);
  const save = useSaveCategory();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', active: true },
  });
  useEffect(() => { if (existing) reset({ name: existing.name, active: existing.active }); }, [existing, reset]);

  if (!isNew && isPending) return <ActivityIndicator className="mt-8" />;

  const onSubmit = (values: CategoryFormValues) =>
    save.mutate({ id: isNew ? undefined : id, values }, { onSuccess: () => router.back() });

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: isNew ? 'New category' : 'Edit category' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Name</Text>
        <Controller control={control} name="name" render={({ field }) => (
          <TextInput className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
            value={field.value} onChangeText={field.onChange} />
        )} />
        {errors.name && <Text className="text-red-600">{errors.name.message}</Text>}
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

- [ ] **Step 5: `app/(app)/admin/kpi-config.tsx`**

```tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useKpiConfig, useSaveKpiConfig } from '@/lib/hooks/useCategoryAdmin';

export default function KpiConfigScreen() {
  const { data, isPending } = useKpiConfig();
  const save = useSaveKpiConfig();
  const [cutoff, setCutoff] = useState('');

  useEffect(() => { if (data) setCutoff(data.daily_cutoff_time.slice(0, 5)); }, [data]);

  if (isPending) return <ActivityIndicator className="mt-8" />;

  return (
    <View className="flex-1 gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'KPI config' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Daily cutoff time (HH:MM, project TZ Asia/Kolkata)</Text>
        <TextInput value={cutoff} onChangeText={setCutoff} placeholder="22:00"
          className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      </View>
      {save.error && <Text className="text-red-600">{(save.error as Error).message}</Text>}
      <Pressable disabled={save.isPending || !/^\d{2}:\d{2}$/.test(cutoff)} onPress={() => save.mutate(`${cutoff}:00`)}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 disabled:opacity-50 active:bg-blue-700">
        {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save</Text>}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 6: Typecheck** — `npx tsc --noEmit` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add lib/schemas/category.ts lib/hooks/useCategoryAdmin.ts "app/(app)/admin/categories" "app/(app)/admin/kpi-config.tsx"
git commit -m "feat(admin): product_categories CRUD and kpi_config cutoff editor"
```

---

## Task 17: Final verification

- [ ] **Step 1:** `npx tsc --noEmit && npx expo lint` → tsc 0; lint clean.

- [ ] **Step 2:** `npm run test:rls` → all PASS (WP1 store gates + WP2 KPI assertions), exit 0.

- [ ] **Step 3:** `npx expo export --platform web` → exit 0; routes include `/kpi`, `/kpi/new`, `/kpi/[id]`, `/kpi/pending`, `/admin/categories`, `/admin/categories/[id]`, `/admin/kpi-config`.

- [ ] **Step 4: Manual web smoke test**

`npx expo start --web --clear`, then:
1. Sign in as `udc@example.test` (password). Home shows the amber "You haven't submitted today's KPI" banner. Click → fill the form (NOB 30, Sales 6000 → ABV ₹200) → optionally pick a photo → Submit. You're redirected to the detail page; row appears in Recent. Try submitting again from `/kpi/new` → server toast "Already submitted today".
2. Sign out, sign in as `nso@example.test`. Home shows the "Pending KPI reviews" link. Open it → see the UDC's row → tap → Approve. Detail flips to `approved`. Try Reject without a comment → button disabled.
3. Sign in as `super_admin@example.test`. Open Product categories → add "Auto accessories" → it appears in `/kpi/new` category pickers. Open KPI config → change cutoff to `20:00`.

- [ ] **Step 5: Final commit if any fixups**

```bash
git add -A
git commit -m "chore(wp2): verification pass"
```

---

## WP2 acceptance summary

- `npm run test:rls` green for WP1 store gates AND WP2 KPI assertions (visibility per role, duplicate blocked, NSO approves, UDC blocked from self-approve).
- A UDC submits today's KPI end-to-end with optional photo via private bucket + signed URL.
- NSO sees the row in the pending queue and approves it.
- Super-Admin manages categories and the cutoff time.
- **No `service_role` key anywhere; signed URLs only, 5-min expiry.**
