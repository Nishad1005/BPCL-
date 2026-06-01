# WP2 — M1 Daily KPI — Design Spec

**Date:** 2026-06-01
**Work package:** WP2 (per [BUILD_PLAN.md](../../../BUILD_PLAN.md) §6)
**Depends on:** WP1 (identity/roles/masters + RLS) — complete; reuses `accessible_store_ids()` and `auth_role()`.
**Source of truth:** [REQUIREMENTS.md](../../../REQUIREMENTS.md) §7.1 (KPI fields), §10 (permissions), §11 (missed-report rule), §16 (acceptance).

## 1. Goal & acceptance

Ship the daily KPI loop end-to-end: a UDC submits today's KPI on mobile/web in under 3 minutes; the DB blocks duplicates; NSO reviews and approves/rejects with comment; an optional photo is captured through the generic `attachments` table backed by a private Supabase Storage bucket. Per-role visibility is enforced at the DB by reusing the WP1 RLS helpers.

**Acceptance check:** the UDC seed user submits a KPI row (incl. photo); a second submit same-day is rejected with "Already submitted today"; the NSO seed user sees the row in their pending queue and approves it; an automated test extends `test-rls.ts` to assert per-role visibility on `daily_kpi_reports`, `daily_kpi_stockout_items`, `product_categories`, and `attachments` — all PASS.

## 2. Locked design decisions

- **Photos via `attachments` table + private bucket.** Generic table reused by WP3/4/5. WP2 implements the `daily_kpi_report` branch of storage RLS; later WPs add their own.
- **Stockout items in a child table**, not JSONB. Normalized for WP6 analytics.
- **`product_categories` master table**, seeded with a starter list. Super Admin maintains.
- **Soft-flag late, single project cutoff.** Submissions accepted after cutoff but `late = true`. Cutoff held in single-row `kpi_config`.
- **NSO approval UX: single Pending-review queue + detail.** Approve / Reject (with required comment) on the detail screen.
- **Excel export deferred to WP6**, cron reminders deferred to WP4 (WP2 surfaces missing-today visibility via plain queries).

## 3. Data model

### Enums

- `kpi_status`: `submitted | approved | rejected | edited`
- `attachment_entity`: `daily_kpi_report | checklist_submission | nso_visit | promotion_compliance` (forward-declared; WP3+ reuse)

### Tables

**`product_categories`**
`id uuid pk, name text not null unique, active bool default true, created_at timestamptz`
Seeded with: Snacks, Beverages, Tobacco, Auto care, FMCG, Other.

**`kpi_config`** (single row)
`id int pk check (id = 1), daily_cutoff_time time not null default '22:00', updated_at timestamptz`
A single-row pattern keeps it queryable by `select * from kpi_config where id = 1`.

**`daily_kpi_reports`**
```
id              uuid pk
store_id        uuid not null references stores
report_date     date not null
udc_id          uuid references users        -- snapshot at submit time
nso_id          uuid references users        -- snapshot at submit time
nob             integer not null check (nob >= 0)
walk_ins        integer check (walk_ins >= 0)
total_sales     numeric(12,2) not null check (total_sales >= 0)
abv             numeric(12,2) GENERATED ALWAYS AS
                  (case when nob > 0 then total_sales / nob else 0 end) STORED
promotion_sales numeric(12,2)
fuel_conversion_pct numeric(5,2)
top_category_id     uuid references product_categories
top_category_remarks text
slow_category_id    uuid references product_categories
slow_category_remarks text
support_needed  text
status          kpi_status not null default 'submitted'
late            bool not null default false
reviewed_by     uuid references users
reviewed_at     timestamptz
review_comment  text
submitted_by    uuid not null references users
submitted_at    timestamptz not null default now()
unique (store_id, report_date)                -- the one-per-day rule
```
The `unique` constraint is the canonical duplicate guard — surfaced to UI as "Already submitted today."

**`daily_kpi_stockout_items`**
`id uuid pk, kpi_report_id uuid not null references daily_kpi_reports on delete cascade, sku text, category_id uuid references product_categories, remarks text`
At least one of `sku`/`category_id` should be set; enforced softly in the form, not the DB (the data is messy from the field — we don't reject otherwise-valid rows).

**`attachments`** (generic — used by WP2 immediately, WP3/4/5 later)
```
id           uuid pk
entity_type  attachment_entity not null
entity_id    uuid not null
storage_path text not null      -- object path within the 'attachments' bucket
uploaded_by  uuid not null references users
created_at   timestamptz default now()
```
Indexed on `(entity_type, entity_id)`.

### Triggers

- **`set_late_flag()`** — BEFORE INSERT/UPDATE on `daily_kpi_reports`: sets `late = (submitted_at::time > (select daily_cutoff_time from kpi_config where id = 1))`. Single project TZ assumed (`Asia/Kolkata`); documented in the migration comment.
- No audit triggers in WP2; those land with WP4.

## 4. Storage layer

**Bucket:** `attachments`, **private** (no public read). Created via migration.

**Path convention:** `<entity_type>/<entity_id>/<uuid>.<ext>` — e.g. `daily_kpi_report/8af.../9f1...jpg`. Keeps each entity's objects co-located, simplifies cleanup later.

**Storage RLS policy** (on `storage.objects` for bucket `attachments`):
- A user may SELECT/INSERT/DELETE an object iff a matching `attachments` row exists whose `(entity_type, entity_id)` resolves into the caller's scope. For WP2's only branch (`daily_kpi_report`), "resolves into scope" means the parent KPI row's `store_id` is in `accessible_store_ids()`. WP3+ add the other branches.

**Signed URLs** generated client-side at display time (5-minute expiry). No URL is ever stored in app state long enough to outlive the expiry.

## 5. Authorization (RLS) summary

All policies reuse WP1 helpers. Per-role gating is by *table*, not module verbs — the §10 verb grid keeps driving UI affordances via the WP1 `can()` helper.

- **`daily_kpi_reports`**
  - SELECT: `store_id in (select accessible_store_ids())`
  - INSERT: caller is authenticated AND target `store_id in (select accessible_store_ids())` AND `submitted_by = auth.uid()`. (Per-role create rights from §10: UDC/Super Admin/NSO create; others blocked at INSERT by the `can_create` UI gating plus DB scope.)
  - UPDATE — split:
    - `submitted_by = auth.uid()` AND `status in ('submitted','rejected')` → submitter edits (sets `status` to `edited` on substantive change via trigger).
    - `auth_role() in ('nso','state_area_manager','super_admin')` AND `store_id in (select accessible_store_ids())` → reviewers may set `status` to `approved`/`rejected`, plus `reviewed_by`, `reviewed_at`, `review_comment`.
  - DELETE: super_admin only.
- **`daily_kpi_stockout_items`** — same scope as parent via EXISTS subquery on the parent row.
- **`product_categories`** — SELECT all authenticated; INSERT/UPDATE super_admin.
- **`kpi_config`** — SELECT all authenticated; UPDATE super_admin.
- **`attachments`** — SELECT/INSERT/DELETE when the related entity row is in the caller's scope, per entity_type. WP2 implements the `daily_kpi_report` branch; storage object policy mirrors it.

## 6. App surface

### Routes (Expo Router, inside `(app)`)

- `kpi/index.tsx` — today's status tile for the user's primary store (or store picker if multi-store) + recent-history list.
- `kpi/new.tsx` — submission form.
- `kpi/[id].tsx` — read-only detail; NSO/manager/super_admin sees Approve / Reject actions here.
- `kpi/pending.tsx` — NSO pending queue across assigned stores.
- `admin/categories/index.tsx`, `admin/categories/[id].tsx` — list + add/edit.
- `admin/kpi-config.tsx` — cutoff time editor.

### Form details (`kpi/new`)

react-hook-form + zod. Sections:
1. **Header** — store (auto for single-store UDC; picker for multi-store), date (today, read-only), UDC name + NSO name (auto, read-only).
2. **Commercial** — NOB, Walk-ins, Total Sales, live ABV (display only, derived client-side; canonical is the DB generated column).
3. **Promotion / conversion** — Promotion sales (optional), Fuel conversion % (optional).
4. **Categories** — Top category picker + remarks; Slow category picker + remarks.
5. **Stockouts** — dynamic list of `{sku, category_id, remarks}` rows; add/remove buttons.
6. **Support needed** — free text.
7. **Photo** — optional single image via `expo-image-picker`; uploaded to Storage on submit; row written in `attachments` post-insert.
8. **Submit** — disabled while submitting; duplicate-day server error surfaced as toast.

### Home additions

- UDC home: "You haven't submitted today's KPI" banner when `select 1 from daily_kpi_reports where store_id = primary_store_id and report_date = current_date` returns nothing.
- NSO home: "Stores missing today's report (N)" tile listing gap stores from `accessible_store_ids()`.

## 7. Migration plan

Forward-only SQL, applied via `npx supabase db push` (same flow as WP1). Files:

1. `<ts>_kpi_enums.sql` — `kpi_status`, `attachment_entity`.
2. `<ts>_product_categories.sql` — table + seed.
3. `<ts>_kpi_config.sql` — single-row config + seed default.
4. `<ts>_attachments.sql` — table + indexes.
5. `<ts>_daily_kpi.sql` — `daily_kpi_reports` (with generated `abv`), `daily_kpi_stockout_items`, `set_late_flag()` trigger.
6. `<ts>_attachments_storage_bucket.sql` — create private `attachments` bucket via `storage.buckets` insert.
7. `<ts>_kpi_rls.sql` — RLS enable + policies on all 5 tables.
8. `<ts>_attachments_storage_policies.sql` — `storage.objects` policy for the `daily_kpi_report` branch.

**Checkpoint A (same as WP1):** all SQL shown to the human before push. **Checkpoint B (same as WP1):** the extended `test-rls.ts` results shown before app code begins.

## 8. Test plan extensions (`test-rls.ts`)

Add a fixture step: as `udc@example.test`, insert a KPI row for `Indore Forecourt 1` and one stockout child. Then assert visibility counts:

| Role | `daily_kpi_reports` rows visible |
|---|---|
| super_admin | 1 |
| management | 1 |
| state_area_manager | 1 (MP subtree includes the store) |
| nso | 1 (assigned to the store) |
| udc | 1 (own store) |
| dealer | 1 (owned store, view-only) |
| marketing_vm | 1 (all stores) |
| training_admin | 1 (all stores) |
| consultant | 1 (all stores) |

Also assert: a second insert with the same `(store_id, report_date)` fails with PG `23505`; NSO can `update` status to `approved`; UDC cannot.

## 9. Out of scope for WP2

- Cron + Edge Function reminders (WP4 framework reuses WP2's missing-today query).
- Excel/PDF export (WP6 unified exporter).
- `audit_logs` (WP4).
- Store-score component for KPI discipline (WP6).
- `attachments` storage policies for non-KPI entity types (added per-WP as those screens land).
- Per-store cutoff times (single project cutoff is enough for MVP).

## 10. Risks / notes

- **Generated `abv` column** requires Postgres 12+ (Supabase is on 15+, safe). Eliminates a class of stale-cached-derived-value bugs.
- **Single project TZ for the cutoff trigger.** If multi-state TZ becomes necessary, the trigger swaps for one that reads a per-region TZ — a contained change.
- **Bucket creation in a migration** uses `insert into storage.buckets`. Idempotent (`on conflict do nothing`); if the bucket exists already it's a no-op.
- **`attachments` written client-side after the photo upload succeeds**, in the same transaction-less flow as the KPI insert. Race: if the row insert succeeds but the attachment insert fails, the KPI shows no photo until manually retried — acceptable for an MVP, and detail screen tolerates missing attachments.
