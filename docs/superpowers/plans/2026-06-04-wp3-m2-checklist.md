# WP3 M2 — Store Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the store-checklist loop end-to-end — Super Admin defines templates and items; UDC submits a scored checklist per period with DB-enforced photo proof on `Done` answers; duplicates per period are blocked at the DB.

**Architecture:** Four Postgres tables (`checklist_templates`, `checklist_items`, `store_checklist_submissions`, `checklist_answers`) with a `BEFORE INSERT` trigger that raises if a `Done` answer on a `requires_photo` item lacks `has_photo`. RLS reuses WP1's `auth_role()` and `accessible_store_ids()`. Photos route through the existing private `attachments` bucket; storage policies are *extended* by adding new permissive `checklist_submission`-branch policies (not editing WP2's policies). Score is client-computed at submit time and stored on the submission row.

**Tech Stack:** Same as WP1/WP2.

**Reference spec:** [docs/superpowers/specs/2026-06-04-wp3-m2-checklist-design.md](../specs/2026-06-04-wp3-m2-checklist-design.md)

## Security constraints (NON-NEGOTIABLE — unchanged)

- No `service_role` key in app env, no `EXPO_PUBLIC_` exposure. Test reads only `SEED_PASSWORD` from gitignored `.env.seed`.
- Private bucket + signed URLs (5-min expiry). No public reads.

## Review checkpoints (HARD STOPS)

- **Checkpoint A** — after migration SQL is written (Tasks 1–5), BEFORE `db push`. Show all SQL.
- **Checkpoint B** — after the extended RLS test runs green. Show per-assertion output.

---

## File map

**Created — database:**
- `supabase/migrations/<ts>_checklist_enums.sql`
- `supabase/migrations/<ts>_checklist_templates.sql` — templates + items
- `supabase/migrations/<ts>_checklist_submissions.sql` — submissions + answers + photo trigger
- `supabase/migrations/<ts>_checklist_rls.sql` — RLS on the 4 new tables + extended attachments policies
- `supabase/migrations/<ts>_checklist_storage_policies.sql` — extend `storage.objects` INSERT for `checklist_submission` paths

**Created — app:**
- `lib/period.ts` — `Frequency`, `periodStartFor(freq, asOf)` pure helper
- `lib/schemas/checklist.ts`
- `lib/hooks/useChecklistTemplates.ts` — active templates + items, applicable-this-period
- `lib/hooks/useChecklistAdmin.ts` — Super-Admin CRUD
- `lib/hooks/useChecklistSubmission.ts` — submit + read submission detail
- `app/(app)/checklist/_layout.tsx`
- `app/(app)/checklist/index.tsx`
- `app/(app)/checklist/new.tsx`
- `app/(app)/checklist/[submissionId].tsx`
- `app/(app)/admin/checklist-templates/_layout.tsx`
- `app/(app)/admin/checklist-templates/index.tsx`
- `app/(app)/admin/checklist-templates/[id].tsx`

**Modified — app:**
- `app/(app)/index.tsx` — UDC checklist tile, admin link to checklist templates
- `scripts/test-rls.ts` — M2 fixtures + assertions

---

## Task 1: checklist_enums migration (write only)

- [ ] **Step 1:** `npx supabase migration new checklist_enums`

- [ ] **Step 2: Write**

```sql
create type public.checklist_frequency as enum ('daily','weekly','monthly','visit_based');
create type public.checklist_answer    as enum ('done','not_done','needs_support','na');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): add checklist_frequency and checklist_answer enums"
```

---

## Task 2: checklist_templates + items migration (write only)

- [ ] **Step 1:** `npx supabase migration new checklist_templates`

- [ ] **Step 2: Write**

```sql
create table public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  frequency   public.checklist_frequency not null,
  active      boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.checklist_items (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.checklist_templates(id) on delete cascade,
  section         text,
  prompt          text not null,
  requires_photo  boolean not null default false,
  sort            integer not null default 0,
  unique (template_id, sort)
);
create index checklist_items_template_idx on public.checklist_items(template_id, sort);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): checklist_templates + checklist_items tables"
```

---

## Task 3: submissions + answers + photo trigger (write only)

- [ ] **Step 1:** `npx supabase migration new checklist_submissions`

- [ ] **Step 2: Write**

```sql
create table public.store_checklist_submissions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.checklist_templates(id) on delete restrict,
  store_id      uuid not null references public.stores(id) on delete cascade,
  period_start  date not null,
  submitted_by  uuid not null references public.users(id) on delete restrict,
  submitted_at  timestamptz not null default now(),
  score         numeric(5,2) not null default 0,
  unique (template_id, store_id, period_start)
);
create index scs_store_period_idx on public.store_checklist_submissions(store_id, period_start desc);

create table public.checklist_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.store_checklist_submissions(id) on delete cascade,
  item_id       uuid not null references public.checklist_items(id) on delete restrict,
  answer        public.checklist_answer not null,
  remarks       text,
  has_photo     boolean not null default false,
  unique (submission_id, item_id)
);
create index ca_submission_idx on public.checklist_answers(submission_id);

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

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): store_checklist_submissions + answers + photo enforcement trigger"
```

---

## Task 4: RLS for checklist tables + extended attachments policies (write only)

- [ ] **Step 1:** `npx supabase migration new checklist_rls`

- [ ] **Step 2: Write**

```sql
-- templates
alter table public.checklist_templates enable row level security;
create policy ct_read on public.checklist_templates for select to authenticated using (true);
create policy ct_admin_write on public.checklist_templates for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- items
alter table public.checklist_items enable row level security;
create policy ci_read on public.checklist_items for select to authenticated using (true);
create policy ci_admin_write on public.checklist_items for all to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- submissions
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

-- answers (inherit parent submission scope)
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

-- Extend attachments policies for the checklist_submission branch.
-- WP2 policies already cover the daily_kpi_report branch; these add the checklist branch
-- as a NEW permissive policy (Postgres OR-combines policies for the same role/action).

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
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): RLS policies for checklist tables + extended attachments policies"
```

---

## Task 5: Storage policies — checklist_submission branch (write only)

- [ ] **Step 1:** `npx supabase migration new checklist_storage_policies`

- [ ] **Step 2: Write**

```sql
-- Storage SELECT policy from WP2 already accepts any path with a matching attachments row,
-- which covers the new checklist branch automatically. Only INSERT needs an extension.

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
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(storage): RLS policy for checklist_submission object paths"
```

---

## 🛑 CHECKPOINT A — present all 5 migration files; do NOT push until approved.

- [ ] Present the contents of Tasks 1–5 to the human. Wait for explicit approval before Task 6.

---

## Task 6: Push migrations + regenerate types

- [ ] **Step 1:** `npm run db:push` (answer `y` if prompted). Expected: 5 migrations applied; ends "Finished supabase db push."

- [ ] **Step 2:** `npm run gen:types`. Verify `types/database.ts` now contains `checklist_templates`, `checklist_items`, `store_checklist_submissions`, `checklist_answers`, and the two new enums.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(db): push M2 schema and regenerate types"
```

---

## Task 7: Extend RLS test with M2 fixtures + assertions

**Files:** Modify `scripts/test-rls.ts`

The existing test already covers WP1 stores + WP2 KPI. We append M2 coverage at the bottom of `main()` and add helpers above it. Treat the existing assertions as canon — don't change them.

- [ ] **Step 1:** Open `scripts/test-rls.ts` and **add these constants near the top** (after `STORE_INDORE_1`):

```ts
const TEMPLATE_FIXTURE_NAME = 'M2_TEST_DAILY';
```

- [ ] **Step 2: Add these helpers above `main()`** (anywhere before `main`):

```ts
// ----- M2 helpers ------------------------------------------------------------
async function ensureChecklistTemplate(): Promise<{ templateId: string; items: { id: string; requires_photo: boolean }[] }> {
  const c = clientFor('super_admin'); await signIn(c, 'super_admin');

  let templateId: string;
  const { data: existingTpl } = await c.from('checklist_templates')
    .select('id').eq('name', TEMPLATE_FIXTURE_NAME).maybeSingle();
  if (existingTpl) {
    templateId = existingTpl.id;
  } else {
    const { data: tpl, error } = await c.from('checklist_templates')
      .insert({ name: TEMPLATE_FIXTURE_NAME, frequency: 'daily', active: true })
      .select('id').single();
    if (error) throw new Error(`create template: ${error.message}`);
    templateId = tpl.id;
  }

  const wantItems = [
    { section: 'Cleanliness', prompt: 'Floor clean',  requires_photo: true,  sort: 1 },
    { section: 'Stock',       prompt: 'Top shelf stocked', requires_photo: false, sort: 2 },
    { section: 'Stock',       prompt: 'Counter impulse rack', requires_photo: false, sort: 3 },
  ];
  const { data: existingItems } = await c.from('checklist_items')
    .select('id, prompt, requires_photo, sort').eq('template_id', templateId).order('sort');
  let items: { id: string; requires_photo: boolean }[];
  if ((existingItems ?? []).length === wantItems.length) {
    items = existingItems!.map((r) => ({ id: r.id, requires_photo: r.requires_photo }));
  } else {
    // Wipe and re-insert to get a known shape.
    await c.from('checklist_items').delete().eq('template_id', templateId);
    const payload = wantItems.map((w) => ({ template_id: templateId, ...w }));
    const { data: inserted, error } = await c.from('checklist_items').insert(payload).select('id, requires_photo, sort').order('sort');
    if (error) throw new Error(`insert items: ${error.message}`);
    items = inserted!.map((r) => ({ id: r.id, requires_photo: r.requires_photo }));
  }

  await c.auth.signOut();
  return { templateId, items };
}

async function purgeUdcChecklistSubmissionForToday(templateId: string) {
  const c = clientFor('super_admin'); await signIn(c, 'super_admin');
  const today = new Date().toISOString().slice(0, 10);
  await c.from('store_checklist_submissions')
    .delete()
    .eq('template_id', templateId)
    .eq('store_id', STORE_INDORE_1)
    .eq('period_start', today);
  await c.auth.signOut();
}

async function udcSubmitChecklist(
  templateId: string,
  items: { id: string; requires_photo: boolean }[],
): Promise<string> {
  const c = clientFor('udc'); await signIn(c, 'udc');
  const today = new Date().toISOString().slice(0, 10);
  const { data: me } = await c.auth.getUser();
  const { data: sub, error } = await c.from('store_checklist_submissions').insert({
    template_id: templateId, store_id: STORE_INDORE_1, period_start: today,
    submitted_by: me.user!.id, score: 0,
  }).select('id').single();
  if (error) throw new Error(`udc create submission: ${error.message}`);

  // I1=done+has_photo=true (requires_photo), I2=done+has_photo=false (no requirement), I3=not_done
  const answersPayload = [
    { submission_id: sub.id, item_id: items[0].id, answer: 'done',     has_photo: true  },
    { submission_id: sub.id, item_id: items[1].id, answer: 'done',     has_photo: false },
    { submission_id: sub.id, item_id: items[2].id, answer: 'not_done', has_photo: false },
  ];
  const { error: aErr } = await c.from('checklist_answers').insert(answersPayload);
  if (aErr) throw new Error(`udc answers: ${aErr.message}`);

  // Score: done=2; na=0; applicable=3; score = 2/3 ≈ 0.67
  const { error: uErr } = await c.from('store_checklist_submissions')
    .update({ score: 0.67 }).eq('id', sub.id);
  if (uErr) throw new Error(`udc score update: ${uErr.message}`);

  await c.auth.signOut();
  return sub.id;
}

async function expectChecklistDuplicateBlocked(templateId: string) {
  const c = clientFor('udc'); await signIn(c, 'udc');
  const today = new Date().toISOString().slice(0, 10);
  const { data: me } = await c.auth.getUser();
  const { error } = await c.from('store_checklist_submissions').insert({
    template_id: templateId, store_id: STORE_INDORE_1, period_start: today,
    submitted_by: me.user!.id, score: 0,
  });
  await c.auth.signOut();
  check('checklist duplicate (template,store,period) blocked', error?.code === '23505', error?.message);
}

async function expectChecklistPhotoTriggerFires(templateId: string, requiresPhotoItemId: string) {
  // New disposable submission for a different period (yesterday) so it doesn't collide with today's.
  const setup = clientFor('udc'); await signIn(setup, 'udc');
  const { data: me } = await setup.auth.getUser();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Clean prior fixture if any.
  const cleanup = clientFor('super_admin'); await signIn(cleanup, 'super_admin');
  await cleanup.from('store_checklist_submissions')
    .delete().eq('template_id', templateId).eq('store_id', STORE_INDORE_1).eq('period_start', yesterday);
  await cleanup.auth.signOut();

  const { data: sub, error: sErr } = await setup.from('store_checklist_submissions').insert({
    template_id: templateId, store_id: STORE_INDORE_1, period_start: yesterday,
    submitted_by: me.user!.id, score: 0,
  }).select('id').single();
  if (sErr) throw new Error(`trigger-test submission: ${sErr.message}`);

  const { error: aErr } = await setup.from('checklist_answers').insert({
    submission_id: sub.id, item_id: requiresPhotoItemId, answer: 'done', has_photo: false,
  });
  await setup.auth.signOut();
  check('photo trigger blocks done-without-photo', aErr !== null && /photo/i.test(aErr?.message ?? ''), aErr?.message);

  // Cleanup the disposable submission so the test stays repeatable.
  const final = clientFor('super_admin'); await signIn(final, 'super_admin');
  await final.from('store_checklist_submissions').delete().eq('id', sub.id);
  await final.auth.signOut();
}

async function visibleChecklistSubmissionCount(role: string, submissionId: string): Promise<number> {
  const c = clientFor(role); await signIn(c, role);
  const { data, error } = await c.from('store_checklist_submissions').select('id').eq('id', submissionId);
  if (error) throw new Error(`select submission as ${role}: ${error.message}`);
  await c.auth.signOut();
  return data!.length;
}
```

- [ ] **Step 3: Add this block at the end of `main()`** (just before the final `console.log` summary):

```ts
  // ----- M2 checklist coverage ----------------------------------------------
  const { templateId, items } = await ensureChecklistTemplate();
  await purgeUdcChecklistSubmissionForToday(templateId);
  const subId = await udcSubmitChecklist(templateId, items);

  const expectedChecklist: Record<string, number> = {
    super_admin: 1, management: 1, state_area_manager: 1,
    nso: 1, udc: 1, dealer: 1,
    marketing_vm: 1, training_admin: 1, consultant: 1,
  };
  for (const [role, exp] of Object.entries(expectedChecklist)) {
    const got = await visibleChecklistSubmissionCount(role, subId);
    check(`checklist ${role}`, got === exp, `expected ${exp}, saw ${got}`);
  }

  await expectChecklistDuplicateBlocked(templateId);
  await expectChecklistPhotoTriggerFires(templateId, items[0].id);
```

- [ ] **Step 4:** Run `npm run test:rls`. Expected: every existing assertion still PASS, plus 11 new PASSes (9 per-role + duplicate-blocked + photo-trigger). Final line: `All WP2 assertions passed.` (we're keeping that summary line for now; the M2 results are interleaved before it).

- [ ] **Step 5: Commit**

```bash
git add scripts/test-rls.ts
git commit -m "test(m2): extend RLS test with checklist fixtures and trigger assertion"
```

- [ ] 🛑 **CHECKPOINT B — show the human the per-assertion output, wait for OK before Task 8.**

---

## Task 8: Period helper

**Files:** Create `lib/period.ts`

- [ ] **Step 1:** Write:

```ts
// lib/period.ts
// Pure date math; no TZ assumptions beyond what KPI's report_date uses
// (UTC date slice — matches WP2's report_date convention exactly).
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'visit_based';

export function periodStartFor(freq: Frequency, asOf: Date): string {
  if (freq === 'visit_based') {
    throw new Error('visit_based has no calendar period (set via nso_visit_id, lands with M3)');
  }
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  if (freq === 'daily') return d.toISOString().slice(0, 10);
  if (freq === 'monthly') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }
  // weekly → ISO Monday (UTC)
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/period.ts
git commit -m "feat(checklist): pure periodStartFor() helper"
```

---

## Task 9: Schemas + hooks

**Files:**
- Create: `lib/schemas/checklist.ts`, `lib/hooks/useChecklistTemplates.ts`, `lib/hooks/useChecklistAdmin.ts`, `lib/hooks/useChecklistSubmission.ts`

- [ ] **Step 1: `lib/schemas/checklist.ts`**

```ts
import { z } from 'zod';

export const checklistFrequency = z.enum(['daily', 'weekly', 'monthly', 'visit_based']);
export const checklistAnswer = z.enum(['done', 'not_done', 'needs_support', 'na']);

export const templateSchema = z.object({
  name: z.string().min(1, 'Required'),
  frequency: checklistFrequency,
  active: z.boolean(),
});
export type TemplateFormValues = z.infer<typeof templateSchema>;

export const itemSchema = z.object({
  section: z.string().optional().or(z.literal('')),
  prompt: z.string().min(1, 'Required'),
  requires_photo: z.boolean(),
  sort: z.coerce.number().int().nonnegative(),
});
export type ItemFormValues = z.infer<typeof itemSchema>;

// Submission form: a map of itemId -> { answer, remarks, photoBlob? }
export type StagedAnswer = {
  itemId: string;
  answer: 'done' | 'not_done' | 'needs_support' | 'na' | null;
  remarks: string;
  photo?: { blob: Blob; ext: string } | null;
};
```

- [ ] **Step 2: `lib/hooks/useChecklistTemplates.ts`** (read-side for UDC)

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { periodStartFor, type Frequency } from '@/lib/period';

export function useActiveTemplatesWithItems() {
  return useQuery({
    queryKey: ['checklist', 'active_templates'],
    queryFn: async () => {
      const { data: tpls, error } = await supabase.from('checklist_templates')
        .select('id, name, frequency, active').eq('active', true).order('name');
      if (error) throw error;
      const { data: items, error: iErr } = await supabase.from('checklist_items')
        .select('id, template_id, section, prompt, requires_photo, sort').order('sort');
      if (iErr) throw iErr;
      const byTpl = new Map<string, typeof items>();
      for (const it of items ?? []) {
        const arr = byTpl.get(it.template_id) ?? [];
        arr.push(it);
        byTpl.set(it.template_id, arr);
      }
      return (tpls ?? []).map((t) => ({ ...t, items: byTpl.get(t.id) ?? [] }));
    },
  });
}

export function useTodaysSubmissions(storeId: string | undefined) {
  return useQuery({
    queryKey: ['checklist', 'todays_submissions', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('store_checklist_submissions')
        .select('id, template_id, period_start, score')
        .eq('store_id', storeId!);
      if (error) throw error;
      return data;
    },
  });
}

export function isTemplateApplicable(
  freq: Frequency,
  asOf = new Date(),
): { periodStart: string } | null {
  if (freq === 'visit_based') return null;
  return { periodStart: periodStartFor(freq, asOf) };
}
```

- [ ] **Step 3: `lib/hooks/useChecklistAdmin.ts`** (Super-Admin CRUD)

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TemplateFormValues, ItemFormValues } from '@/lib/schemas/checklist';

export function useAllTemplates() {
  return useQuery({
    queryKey: ['checklist', 'all_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('checklist_templates').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist', 'template', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data: tpl, error } = await supabase.from('checklist_templates').select('*').eq('id', id!).single();
      if (error) throw error;
      const { data: items } = await supabase.from('checklist_items')
        .select('*').eq('template_id', id!).order('sort');
      return { ...tpl, items: items ?? [] };
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: TemplateFormValues }) => {
      if (id && id !== 'new') {
        const { error } = await supabase.from('checklist_templates').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from('checklist_templates').insert(values).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}

export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, templateId, values }: { id?: string; templateId: string; values: ItemFormValues }) => {
      const payload = { ...values, template_id: templateId, section: values.section || null };
      if (id) {
        const { error } = await supabase.from('checklist_items').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('checklist_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}
```

- [ ] **Step 4: `lib/hooks/useChecklistSubmission.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadAttachmentObject } from '@/lib/storage';
import { periodStartFor, type Frequency } from '@/lib/period';
import type { StagedAnswer } from '@/lib/schemas/checklist';

export function useChecklistSubmission(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist', 'submission', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: sub, error } = await supabase
        .from('store_checklist_submissions')
        .select('*, checklist_templates(name, frequency), stores(store_name), checklist_answers(*)')
        .eq('id', id!).single();
      if (error) throw error;
      const { data: atts } = await supabase.from('attachments').select('*')
        .eq('entity_type', 'checklist_submission').eq('entity_id', id!);
      // Resolve item rows for the answers in one round-trip.
      const itemIds = (sub.checklist_answers ?? []).map((a: { item_id: string }) => a.item_id);
      const { data: items } = itemIds.length
        ? await supabase.from('checklist_items').select('id, section, prompt, requires_photo, sort').in('id', itemIds)
        : { data: [] };
      return { ...sub, attachments: atts ?? [], items: items ?? [] };
    },
  });
}

export function useSubmitChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      templateId: string;
      frequency: Frequency;
      storeId: string;
      answers: StagedAnswer[];
    }) => {
      const { templateId, frequency, storeId, answers } = args;
      if (frequency === 'visit_based') {
        throw new Error('Visit-based templates submit via NSO visit (M3).');
      }
      const periodStart = periodStartFor(frequency, new Date());

      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error('Not signed in');

      // 1. Insert submission first (so we have an ID for storage paths).
      const { data: sub, error } = await supabase.from('store_checklist_submissions').insert({
        template_id: templateId, store_id: storeId, period_start: periodStart,
        submitted_by: me.user.id, score: 0,
      }).select('id').single();
      if (error) {
        if (error.code === '23505') throw new Error('Already submitted for this period');
        throw error;
      }

      // 2. Upload any staged photos.
      const uploaded: Record<string, string> = {};
      for (const a of answers) {
        if (!a.photo) continue;
        const path = await uploadAttachmentObject({
          entityType: 'checklist_submission', entityId: sub.id, file: a.photo.blob, ext: a.photo.ext,
        });
        uploaded[a.itemId] = path;
      }

      // 3. Insert answers (trigger validates photo requirement).
      const answersPayload = answers
        .filter((a) => a.answer != null)
        .map((a) => ({
          submission_id: sub.id,
          item_id: a.itemId,
          answer: a.answer!,
          remarks: a.remarks || null,
          has_photo: !!uploaded[a.itemId],
        }));
      const { error: aErr } = await supabase.from('checklist_answers').insert(answersPayload);
      if (aErr) {
        // Rollback the submission so the user can retry cleanly.
        await supabase.from('store_checklist_submissions').delete().eq('id', sub.id);
        throw aErr;
      }

      // 4. Insert attachment rows for uploaded photos.
      const attRows = Object.entries(uploaded).map(([_itemId, path]) => ({
        entity_type: 'checklist_submission' as const,
        entity_id: sub.id,
        storage_path: path,
        uploaded_by: me.user!.id,
      }));
      if (attRows.length > 0) {
        const { error: attErr } = await supabase.from('attachments').insert(attRows);
        if (attErr) throw attErr;
      }

      // 5. Compute + persist score.
      const applicable = answersPayload.filter((a) => a.answer !== 'na').length;
      const done = answersPayload.filter((a) => a.answer === 'done').length;
      const score = applicable > 0 ? Math.round((done / applicable) * 100) / 100 : 0;
      const { error: sErr } = await supabase
        .from('store_checklist_submissions').update({ score }).eq('id', sub.id);
      if (sErr) throw sErr;

      return { id: sub.id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}
```

- [ ] **Step 5:** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas/checklist.ts lib/hooks/useChecklistTemplates.ts lib/hooks/useChecklistAdmin.ts lib/hooks/useChecklistSubmission.ts
git commit -m "feat(checklist): schemas + hooks (templates, admin, submission)"
```

---

## Task 10: UDC checklist screens

**Files:** Create `app/(app)/checklist/_layout.tsx`, `app/(app)/checklist/index.tsx`, `app/(app)/checklist/new.tsx`, `app/(app)/checklist/[submissionId].tsx`

- [ ] **Step 1: `app/(app)/checklist/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
export default function ChecklistLayout() {
  return <Stack screenOptions={{ headerShown: true }} />;
}
```

- [ ] **Step 2: `app/(app)/checklist/index.tsx`** (UDC's view)

```tsx
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { isTemplateApplicable, useActiveTemplatesWithItems, useTodaysSubmissions } from '@/lib/hooks/useChecklistTemplates';

export default function ChecklistIndex() {
  const { profile } = useAuth();
  const storeId = profile?.primary_store_id ?? undefined;
  const tpls = useActiveTemplatesWithItems();
  const subs = useTodaysSubmissions(storeId);

  if (!storeId) {
    return (
      <View className="flex-1 gap-3 bg-white p-6 dark:bg-neutral-950">
        <Stack.Screen options={{ title: 'Checklists' }} />
        <Text className="text-base text-neutral-700 dark:text-neutral-300">This account isn&apos;t assigned to a primary store.</Text>
        <Text className="text-neutral-500">Checklists are for store users. Admins manage templates in Admin → Checklist templates.</Text>
      </View>
    );
  }

  const submittedMap = new Map<string, { id: string; period_start: string; score: number }>();
  for (const s of subs.data ?? []) submittedMap.set(`${s.template_id}:${s.period_start}`, s);

  const applicableRows = (tpls.data ?? []).flatMap((t) => {
    const win = isTemplateApplicable(t.frequency);
    if (!win) return [];
    const key = `${t.id}:${win.periodStart}`;
    const sub = submittedMap.get(key);
    return [{ template: t, periodStart: win.periodStart, submission: sub }];
  });

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Checklists' }} />
      {(tpls.isPending || subs.isPending) && <ActivityIndicator className="mt-8" />}
      <FlatList
        data={applicableRows}
        keyExtractor={(r) => `${r.template.id}:${r.periodStart}`}
        contentContainerClassName="p-4 gap-2"
        ListEmptyComponent={!tpls.isPending ? <Text className="p-4 text-neutral-500">No active checklist templates.</Text> : null}
        renderItem={({ item }) => (
          item.submission
            ? <Link href={`/checklist/${item.submission.id}` as any} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <View>
                  <Text className="font-semibold text-neutral-900 dark:text-white">{item.template.name}</Text>
                  <Text className="text-neutral-500">{item.periodStart} • Score {Math.round(item.submission.score * 100)}%</Text>
                </View>
              </Link>
            : <Link href={`/checklist/new?templateId=${item.template.id}` as any} className="rounded-xl border border-amber-400 bg-amber-50 p-3 dark:bg-amber-950">
                <View>
                  <Text className="font-semibold text-amber-900 dark:text-amber-200">{item.template.name}</Text>
                  <Text className="text-amber-800 dark:text-amber-300">Pending • {item.template.frequency}</Text>
                </View>
              </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 3: `app/(app)/checklist/new.tsx`** (submission form)

```tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useActiveTemplatesWithItems } from '@/lib/hooks/useChecklistTemplates';
import { useSubmitChecklist } from '@/lib/hooks/useChecklistSubmission';
import type { StagedAnswer } from '@/lib/schemas/checklist';

const ANSWERS = ['done', 'not_done', 'needs_support', 'na'] as const;
const LABEL: Record<typeof ANSWERS[number], string> = {
  done: 'Done', not_done: 'Not Done', needs_support: 'Needs Support', na: 'N/A',
};

export default function NewChecklistScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const tpls = useActiveTemplatesWithItems();
  const submit = useSubmitChecklist();

  const template = tpls.data?.find((t) => t.id === templateId);
  const [answers, setAnswers] = useState<Record<string, StagedAnswer>>({});

  const update = (itemId: string, patch: Partial<StagedAnswer>) =>
    setAnswers((prev) => ({ ...prev, [itemId]: { itemId, answer: null, remarks: '', ...(prev[itemId] ?? {}), ...patch } }));

  const pickPhotoFor = async (itemId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const blob = await (await fetch(asset.uri)).blob();
    update(itemId, { photo: { blob, ext: 'jpg' } });
  };

  const grouped = useMemo(() => {
    if (!template) return [] as { section: string | null; items: typeof template.items }[];
    const map = new Map<string | null, typeof template.items>();
    for (const it of template.items) {
      const key = it.section ?? null;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
  }, [template]);

  if (tpls.isPending) return <ActivityIndicator className="mt-8" />;
  if (!template) return <Text className="p-6 text-red-600">Template not found.</Text>;
  if (template.frequency === 'visit_based') {
    return (
      <View className="p-6">
        <Stack.Screen options={{ title: 'Checklist' }} />
        <Text className="text-neutral-700 dark:text-neutral-300">
          This template is visit-based — it&apos;s submitted as part of an NSO visit (M3, not yet built).
        </Text>
      </View>
    );
  }

  const photoMissing = template.items.some((it) => it.requires_photo
    && answers[it.id]?.answer === 'done'
    && !answers[it.id]?.photo);

  const allAnswered = template.items.every((it) => answers[it.id]?.answer != null);

  const storeId = profile?.primary_store_id;
  const canSubmit = !!storeId && allAnswered && !photoMissing && !submit.isPending;

  const onSubmit = () => {
    if (!storeId) return;
    submit.mutate(
      { templateId: template.id, frequency: template.frequency, storeId, answers: Object.values(answers) },
      { onSuccess: ({ id }) => router.replace(`/checklist/${id}` as any) },
    );
  };

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: template.name }} />

      {grouped.map(({ section, items }) => (
        <View key={section ?? '__unsectioned__'} className="gap-3">
          {section && <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{section}</Text>}
          {items.map((it) => (
            <View key={it.id} className="gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <Text className="text-neutral-900 dark:text-white">{it.prompt}</Text>
              <View className="flex-row flex-wrap gap-2">
                {ANSWERS.map((a) => (
                  <Pressable key={a} onPress={() => update(it.id, { answer: a })}
                    className={`rounded-full border px-3 py-1 ${answers[it.id]?.answer === a ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                    <Text className={answers[it.id]?.answer === a ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{LABEL[a]}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput placeholder="Remarks (optional)"
                value={answers[it.id]?.remarks ?? ''}
                onChangeText={(v) => update(it.id, { remarks: v })}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
              {it.requires_photo && (
                <View className="gap-2">
                  {answers[it.id]?.photo && <Text className="text-green-700 dark:text-green-400">Photo staged ✓</Text>}
                  <Pressable onPress={() => pickPhotoFor(it.id)}
                    className="items-center rounded-xl border border-neutral-300 p-2 dark:border-neutral-700">
                    <Text className="text-neutral-700 dark:text-neutral-300">{answers[it.id]?.photo ? 'Replace photo' : 'Add required photo'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      ))}

      {submit.error && <Text className="text-red-600">{(submit.error as Error).message}</Text>}
      {photoMissing && <Text className="text-amber-700">Some Done answers require a photo.</Text>}
      <Pressable disabled={!canSubmit} onPress={onSubmit}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 disabled:opacity-50 active:bg-blue-700">
        {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Submit checklist</Text>}
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 4: `app/(app)/checklist/[submissionId].tsx`** (read-only detail)

```tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { useChecklistSubmission } from '@/lib/hooks/useChecklistSubmission';
import { signedUrlFor } from '@/lib/storage';

export default function ChecklistDetail() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  const { data, isPending, error } = useChecklistSubmission(submissionId);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.attachments) return;
    (async () => {
      const urls = await Promise.all(
        (data.attachments as { storage_path: string }[]).map((a) => signedUrlFor(a.storage_path))
      );
      setPhotoUrls(urls);
    })();
  }, [data]);

  if (isPending) return <ActivityIndicator className="mt-8" />;
  if (error) return <Text className="p-6 text-red-600">{(error as Error).message}</Text>;
  if (!data) return null;

  const itemsById = new Map((data.items ?? []).map((it: any) => [it.id, it]));
  const grouped = new Map<string, any[]>();
  for (const a of data.checklist_answers ?? []) {
    const item = itemsById.get(a.item_id);
    if (!item) continue;
    const section = item.section ?? '—';
    const arr = grouped.get(section) ?? [];
    arr.push({ a, item });
    grouped.set(section, arr);
  }

  return (
    <ScrollView contentContainerClassName="gap-3 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: (data as any).checklist_templates?.name ?? 'Checklist' }} />
      <Text className="text-sm text-neutral-500">{data.period_start} • Score {Math.round(((data.score ?? 0) as number) * 100)}%</Text>
      {Array.from(grouped.entries()).map(([section, rows]) => (
        <View key={section} className="gap-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{section}</Text>
          {rows.map(({ a, item }) => (
            <View key={a.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <Text className="text-neutral-900 dark:text-white">{item.prompt}</Text>
              <Text className="text-neutral-500">{a.answer}{a.has_photo ? ' • photo' : ''}</Text>
              {a.remarks && <Text className="text-neutral-600 dark:text-neutral-300">{a.remarks}</Text>}
            </View>
          ))}
        </View>
      ))}
      {photoUrls.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 200, height: 200, borderRadius: 12 }} />)}
    </ScrollView>
  );
}
```

- [ ] **Step 5:** `npx tsc --noEmit` → 0 errors (use `as any` on dynamic `<Link href>` if typed routes complain about new routes).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/checklist"
git commit -m "feat(checklist): UDC index, submission form, read-only detail"
```

---

## Task 11: Admin checklist template CRUD

**Files:** Create `app/(app)/admin/checklist-templates/_layout.tsx`, `index.tsx`, `[id].tsx`

- [ ] **Step 1: `_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
export default function L() { return <Stack screenOptions={{ headerShown: true }} />; }
```

- [ ] **Step 2: `index.tsx`**

```tsx
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAllTemplates } from '@/lib/hooks/useChecklistAdmin';

export default function TemplatesList() {
  const { data, isPending, error } = useAllTemplates();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Checklist templates' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={<Link href={'/admin/checklist-templates/new' as any} className="mb-2 text-blue-600 dark:text-blue-400">+ New template</Link>}
        renderItem={({ item }) => (
          <Link href={`/admin/checklist-templates/${item.id}` as any} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.name}</Text>
              <Text className="text-neutral-500">{item.frequency}{item.active ? '' : ' • inactive'}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 3: `[id].tsx`** (metadata form + inline items editor)

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { templateSchema, type TemplateFormValues, type ItemFormValues } from '@/lib/schemas/checklist';
import { useDeleteItem, useSaveItem, useSaveTemplate, useTemplate } from '@/lib/hooks/useChecklistAdmin';

const FREQS = ['daily', 'weekly', 'monthly', 'visit_based'] as const;

export default function TemplateForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: existing, isPending } = useTemplate(id);
  const saveTpl = useSaveTemplate();
  const saveItem = useSaveItem();
  const deleteItem = useDeleteItem();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema) as any,
    defaultValues: { name: '', frequency: 'daily', active: true },
  });

  useEffect(() => {
    if (existing) reset({ name: existing.name, frequency: existing.frequency, active: existing.active });
  }, [existing, reset]);

  const onSubmitTpl = (values: TemplateFormValues) =>
    saveTpl.mutate({ id: isNew ? undefined : id, values }, {
      onSuccess: (newId) => { if (isNew) router.replace(`/admin/checklist-templates/${newId}` as any); },
    });

  if (!isNew && isPending) return <ActivityIndicator className="mt-8" />;

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: isNew ? 'New template' : 'Edit template' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Name</Text>
        <Controller control={control} name="name" render={({ field }) => (
          <TextInput value={field.value} onChangeText={field.onChange}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white" />
        )} />
        {errors.name && <Text className="text-red-600">{errors.name.message}</Text>}
      </View>
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Frequency</Text>
        <Controller control={control} name="frequency" render={({ field }) => (
          <View className="flex-row flex-wrap gap-2">
            {FREQS.map((f) => (
              <Pressable key={f} onPress={() => field.onChange(f)}
                className={`rounded-full border px-3 py-1 ${field.value === f ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                <Text className={field.value === f ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{f}</Text>
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
      {saveTpl.error && <Text className="text-red-600">{(saveTpl.error as Error).message}</Text>}
      <Pressable disabled={saveTpl.isPending} onPress={handleSubmit(onSubmitTpl)}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {saveTpl.isPending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save template</Text>}
      </Pressable>

      {!isNew && (
        <View className="gap-3">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Items</Text>
          {(existing?.items ?? []).map((it: any) => (
            <ItemRow key={it.id} item={it} templateId={id!}
              onSave={(values) => saveItem.mutate({ id: it.id, templateId: id!, values })}
              onDelete={() => deleteItem.mutate(it.id)} />
          ))}
          <NewItemRow templateId={id!} onSave={(values) => saveItem.mutate({ templateId: id!, values })} />
        </View>
      )}
    </ScrollView>
  );
}

function ItemRow({ item, templateId, onSave, onDelete }: {
  item: { id: string; section: string | null; prompt: string; requires_photo: boolean; sort: number };
  templateId: string;
  onSave: (v: ItemFormValues) => void;
  onDelete: () => void;
}) {
  const [section, setSection] = useState(item.section ?? '');
  const [prompt, setPrompt] = useState(item.prompt);
  const [requiresPhoto, setRequiresPhoto] = useState(item.requires_photo);
  const [sort, setSort] = useState(String(item.sort));
  return (
    <View className="gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <TextInput value={section} onChangeText={setSection} placeholder="Section"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Prompt"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 dark:text-white">Requires photo</Text>
        <Switch value={requiresPhoto} onValueChange={setRequiresPhoto} />
      </View>
      <TextInput value={sort} onChangeText={setSort} keyboardType="numeric" placeholder="Sort"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <View className="flex-row gap-2">
        <Pressable onPress={() => onSave({ section, prompt, requires_photo: requiresPhoto, sort: Number(sort) || 0 })}
          className="flex-1 items-center rounded-xl bg-blue-600 py-2 active:bg-blue-700">
          <Text className="font-semibold text-white">Save</Text>
        </Pressable>
        <Pressable onPress={onDelete} className="items-center rounded-xl border border-red-500 px-3 py-2">
          <Text className="text-red-600">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NewItemRow({ templateId, onSave }: { templateId: string; onSave: (v: ItemFormValues) => void }) {
  const [section, setSection] = useState('');
  const [prompt, setPrompt] = useState('');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [sort, setSort] = useState('0');
  return (
    <View className="gap-2 rounded-xl border border-dashed border-neutral-400 p-3">
      <Text className="text-sm font-semibold text-neutral-500">+ New item</Text>
      <TextInput value={section} onChangeText={setSection} placeholder="Section"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Prompt"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 dark:text-white">Requires photo</Text>
        <Switch value={requiresPhoto} onValueChange={setRequiresPhoto} />
      </View>
      <TextInput value={sort} onChangeText={setSort} keyboardType="numeric" placeholder="Sort"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <Pressable disabled={!prompt}
        onPress={() => { onSave({ section, prompt, requires_photo: requiresPhoto, sort: Number(sort) || 0 }); setSection(''); setPrompt(''); setRequiresPhoto(false); setSort('0'); }}
        className="items-center rounded-xl bg-blue-600 py-2 active:bg-blue-700 disabled:opacity-50">
        <Text className="font-semibold text-white">Add item</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4:** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/admin/checklist-templates"
git commit -m "feat(admin): checklist templates CRUD with inline items editor"
```

---

## Task 12: Home additions

**Files:** Modify `app/(app)/index.tsx`

Add a UDC tile linking to `/checklist` and an admin link for Checklist templates. Keep all existing WP2 tiles intact.

- [ ] **Step 1:** Replace `app/(app)/index.tsx` with:

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
        <Link href={'/kpi/new' as any} className="rounded-xl border border-amber-400 bg-amber-50 p-4 dark:bg-amber-950">
          <Text className="font-semibold text-amber-900 dark:text-amber-200">You haven&apos;t submitted today&apos;s KPI</Text>
          <Text className="text-amber-800 dark:text-amber-300">Tap to submit now</Text>
        </Link>
      )}

      <Link href={'/kpi' as any} className="text-blue-600 dark:text-blue-400">Open Daily KPI</Link>
      <Link href={'/checklist' as any} className="text-blue-600 dark:text-blue-400">Open Checklists</Link>

      {isReviewer && (
        <View className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Reviews</Text>
          <Link href={'/kpi/pending' as any} className="text-blue-600 dark:text-blue-400">Pending KPI reviews</Link>
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
          <Link href={'/admin/stores' as any} className="text-blue-600 dark:text-blue-400">Manage stores</Link>
          <Link href={'/admin/users' as any} className="text-blue-600 dark:text-blue-400">Manage users</Link>
          <Link href={'/admin/categories' as any} className="text-blue-600 dark:text-blue-400">Product categories</Link>
          <Link href={'/admin/kpi-config' as any} className="text-blue-600 dark:text-blue-400">KPI config</Link>
          <Link href={'/admin/checklist-templates' as any} className="text-blue-600 dark:text-blue-400">Checklist templates</Link>
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

- [ ] **Step 2:** `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/index.tsx"
git commit -m "feat(home): add Open Checklists link and admin entry for templates"
```

---

## Task 13: Final verification + smoke test

- [ ] **Step 1:** `npx tsc --noEmit && npx expo lint` → tsc 0; lint clean.

- [ ] **Step 2:** `npm run test:rls` → every existing PASS plus the 11 M2 PASSes, exit 0.

- [ ] **Step 3:** `npx expo export --platform web` → exit 0; routes include `/checklist`, `/checklist/new`, `/checklist/[submissionId]`, `/admin/checklist-templates`, `/admin/checklist-templates/[id]`.

- [ ] **Step 4: Manual web smoke**

`npx expo start --web --clear`, then:
1. Sign in as `super_admin@example.test`. Open **Checklist templates** → **+ New template** (name "Daily Open", frequency `daily`, active). Save. On the detail screen, add 3 items (one with `requires_photo`).
2. Sign out → `udc@example.test`. Open **Open Checklists**. The "Daily Open" template appears as an amber Pending tile. Tap it → fill all items (mark Done on the requires_photo item and add a photo) → Submit. You land on the detail showing the score badge + grouped answers + photo.
3. Try opening `/checklist/new?templateId=…` again for the same template — submit blocked with "Already submitted for this period".

- [ ] **Step 5: Commit if any fixups**

```bash
git add -A
git commit -m "chore(m2): verification pass"
```

---

## M2 acceptance summary

- `npm run test:rls` green: WP1 store scoping + WP2 KPI + 9 per-role checklist visibility + duplicate blocked + photo trigger.
- UDC end-to-end checklist submit (with photo, signed-URL render) works in the browser.
- Super-Admin templates + items CRUD works.
- **No `service_role`; signed URLs only.**
