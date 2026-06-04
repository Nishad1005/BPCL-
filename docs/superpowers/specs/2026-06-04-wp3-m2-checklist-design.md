# WP3 M2 — Store Checklist — Design Spec

**Date:** 2026-06-04
**Work package:** WP3 (M2 Checklist half — M3 NSO Visit is a separate spec/plan after this)
**Depends on:** WP1 (RLS helpers, attachments storage), WP2 (`attachments` table + private bucket + storage policy pattern).
**Source of truth:** [REQUIREMENTS.md](../../../REQUIREMENTS.md) §7.2, §16 (acceptance).

## 1. Goal & acceptance

Ship configurable store checklists end-to-end: Super Admin defines templates (with grouped items, photo requirements, frequency), UDC fills the applicable templates per period and submits with optional/required photos, the DB blocks duplicates per period and enforces photo proof on `Done` answers, and the submission is scored deterministically.

**Acceptance check:** an automated test extends `scripts/test-rls.ts` to:
1. Have a seeded template with 3 items (1 `requires_photo`).
2. As UDC, submit 3 answers (one `done` with photo, one `done` without photo on a non-required item, one `not_done`) → score = `0.67`.
3. Duplicate submission for same (`template_id`, `store_id`, `period_start`) → PG `23505`.
4. As UDC, attempt `done` on a `requires_photo` item with `has_photo = false` → DB trigger raises.
5. Per-role visibility on `store_checklist_submissions` matches `accessible_store_ids()` exactly (same shape as KPI).

Plus a manual web smoke test: Super Admin creates a template; UDC submits it; detail screen shows signed-URL photo and score badge.

## 2. Locked design decisions

- **Self-serve**, no NSO approve/reject status; NSO sees submissions on dashboards (WP6) but does not gate them.
- **Plain `section` text** on each item; no separate sections table.
- **Score = `count(done) / count(answer <> 'na')`**, rounded to 2dp, **client-computed at submit and stored** on the submission row.
- **`requires_photo` enforced** at the DB by a `BEFORE INSERT` trigger on `checklist_answers`: if `answer = 'done'` AND parent item has `requires_photo = true` AND `has_photo` is not true → raise.
- **Unique per period** at the DB: `unique(template_id, store_id, period_start)`.
- **`visit_based` frequency** is reserved in the enum; no submission UI in M2 (lands with M3).

## 3. Data model

### Enums
- `checklist_frequency`: `daily | weekly | monthly | visit_based`
- `checklist_answer`: `done | not_done | needs_support | na`

(`attachment_entity = 'checklist_submission'` already exists from WP2.)

### Tables

**`checklist_templates`**
```
id          uuid pk
name        text not null
frequency   checklist_frequency not null
active      boolean not null default true
created_by  uuid references users(id)
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()
```

**`checklist_items`**
```
id              uuid pk
template_id     uuid not null references checklist_templates on delete cascade
section         text
prompt          text not null
requires_photo  boolean not null default false
sort            integer not null default 0
unique (template_id, sort) -- nice-to-have for deterministic order; conflicts resolved by admin UI
```

**`store_checklist_submissions`**
```
id            uuid pk
template_id   uuid not null references checklist_templates(id) on delete restrict
store_id      uuid not null references stores(id) on delete cascade
period_start  date not null
submitted_by  uuid not null references users(id) on delete restrict
submitted_at  timestamptz not null default now()
score         numeric(5,2) not null default 0  -- client-computed at submit
unique (template_id, store_id, period_start)
```

**`checklist_answers`**
```
id              uuid pk
submission_id   uuid not null references store_checklist_submissions(id) on delete cascade
item_id         uuid not null references checklist_items(id) on delete restrict
answer          checklist_answer not null
remarks         text
has_photo       boolean not null default false
unique (submission_id, item_id)
```

### Triggers

```sql
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
```

No additional triggers — `score` is stored by the app at submit time; `period_start` is supplied by the app (per §4 below).

## 4. Period derivation (client)

The app computes `period_start` from `checklist_templates.frequency` at submission time:
- `daily` → `current_date`
- `weekly` → most recent Monday (ISO week start) ≤ today
- `monthly` → first of current month
- `visit_based` → not supported in M2 (form blocks submission; M3 wires it to `nso_visit_id`)

The DB doesn't compute `period_start` because that keeps the form's "you already submitted today/this week" detection identical to what the DB will enforce. A divergence here would mean dishonest UI.

## 5. Authorization (RLS)

Reuses WP1 `auth_role()` and `accessible_store_ids()`.

- **`checklist_templates`**, **`checklist_items`** — SELECT all authenticated; INSERT/UPDATE/DELETE `super_admin` only.
- **`store_checklist_submissions`**
  - SELECT: `store_id in (select accessible_store_ids())`
  - INSERT: `submitted_by = auth.uid()` AND `store_id in (select accessible_store_ids())`
  - UPDATE: `super_admin` only (no edits post-submit by design)
  - DELETE: `super_admin`
- **`checklist_answers`** — inherit parent scope via EXISTS on `store_checklist_submissions`; INSERT additionally requires the parent submission is the caller's (`submitted_by = auth.uid()`).
- **`attachments`** — extend the existing SELECT/INSERT policies to also resolve the `checklist_submission` branch (`entity_type = 'checklist_submission'` resolves into `store_checklist_submissions.store_id`).
- **`storage.objects`** — extend the existing INSERT policy: also accept paths under `checklist_submission/<submission_id>/…` where that submission row is in scope.

## 6. Storage

Bucket: existing private `attachments`.
Path: `checklist_submission/<submission_id>/<uuid>.<ext>`.
Signed URL render: 5-min expiry via existing `signedUrlFor()` helper.

## 7. App surface

### Routes (Expo Router, inside `(app)`)

- `checklist/index.tsx` — for users with a `primary_store_id`: lists *applicable templates this period* with status Submitted / Pending. For non-store users: friendly message + link to recent submissions.
- `checklist/new.tsx?templateId=…` — submission form. Items grouped by `section`. Per-item: 4-state segmented control (Done / Not Done / Needs Support / N/A), remarks, photo picker shown only if `requires_photo`. Live submission-progress count. Submit button blocked until each `requires_photo` item answered Done has a staged photo.
- `checklist/[submissionId].tsx` — read-only detail: header (template name, period, score badge, submitter), grouped answers, photo thumbs (signed URL).
- `admin/checklist-templates/index.tsx` — list + new.
- `admin/checklist-templates/[id].tsx` — template metadata + inline items editor (add/remove/reorder rows, set section/prompt/requires_photo/sort, active toggle).

### Home additions
- UDC tile: "Checklists pending today/this week (N)" linking to `/checklist`.
- Admin card: link to "Checklist templates".
- (NSO/reviewer dashboard for store checklist scores lives in WP6.)

## 8. Hooks + helpers

- `lib/schemas/checklist.ts` — zod for template, item, submission/answer payload.
- `lib/hooks/useChecklistTemplates.ts` — list active templates + items.
- `lib/hooks/useChecklistAdmin.ts` — CRUD for templates and items (super_admin).
- `lib/hooks/useChecklistSubmission.ts` — `useSubmission(id)`, `useSubmitChecklist()`, `useApplicableTemplates(storeId, today)`.
- `lib/period.ts` — pure `periodStartFor(frequency: ChecklistFrequency, asOf: Date)` returning a yyyy-mm-dd string; reused in the form, the index screen, and (eventually) the test fixture.

## 9. Test plan extensions (`scripts/test-rls.ts`)

Setup (run from a privileged role — the test signs in as `super_admin@example.test`):
1. Insert template `M2_TEST_DAILY` (frequency `daily`, active true).
2. Insert 3 items: I1 (section "Cleanliness", `requires_photo=true`), I2 (section "Stock", `requires_photo=false`), I3 (section "Stock", `requires_photo=false`).

Assertions:
- Sign in `udc`; INSERT a submission for `STORE_INDORE_1` with today's `period_start`; INSERT three answers `(I1=done, has_photo=true)`, `(I2=done, has_photo=false)`, `(I3=not_done)`. Update submission `score = 0.67`.
- Per-role visibility of that submission row (same matrix as KPI: 9 PASS / 1 each).
- As UDC, attempt second submission for same (template, store, today) → `23505`.
- As UDC, attempt INSERT into a fresh test submission with answer `(I1=done, has_photo=false)` → trigger error.

## 10. Out of scope for M2

- `visit_based` submission flow → M3 NSO Visit.
- NSO/manager review/comment workflow → not in M2 by decision.
- Critical-item / weighted scoring → deferred.
- Retraining trigger from low score → WP7 LMS.
- Checklist-driven `store_scores` component → WP6 dashboards.
- Bulk export → WP6.

## 11. Risks / notes

- **`score` drift if items are edited or deleted after submissions exist.** Mitigated: `checklist_items` has `on delete restrict` from answers; admins can mark templates inactive instead. Editing item prompt text doesn't break score; changing `requires_photo` retroactively affects only new submissions.
- **`has_photo` race.** The app sets `has_photo = true` then uploads + inserts the attachment row in the same flow. If the attachment write fails, the submission already counts the photo. Mitigation: insert the attachment row before the answer row, and have the storage upload precede both. Spec-level acceptable for MVP; a future hardening step is a deferred-constraint trigger that verifies attachment existence at commit.
- **`visit_based`** templates are creatable but unsubmittable in M2. The form refuses with a clear error. Documented in the admin template form's helper text.
