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
const TEMPLATE_FIXTURE_NAME = 'M2_TEST_DAILY';

function clientFor(_role: string) {
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
  // Count only the fixture-store + today rows so the assertion is stable across days
  // (yesterday's fixtures stay in the table; we don't want them to inflate the count).
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await c.from('daily_kpi_reports').select('id')
    .eq('store_id', STORE_INDORE_1).eq('report_date', today);
  if (error) throw new Error(`select kpi as ${role}: ${error.message}`);
  await c.auth.signOut();
  return data!.length;
}

async function ensureUdcKpiForToday(): Promise<string> {
  const c = clientFor('udc'); await signIn(c, 'udc');
  const today = new Date().toISOString().slice(0, 10);
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

// Reset the row to 'submitted' as NSO so the approve assertions test the real path
// regardless of state left over from a prior run.
async function resetToSubmitted(kpiId: string) {
  const c = clientFor('nso'); await signIn(c, 'nso');
  const { error } = await c.from('daily_kpi_reports')
    .update({ status: 'submitted', reviewed_by: null, reviewed_at: null, review_comment: null })
    .eq('id', kpiId);
  await c.auth.signOut();
  if (error) throw new Error(`reset to submitted: ${error.message}`);
}

async function expectUdcCannotApprove(kpiId: string) {
  const c = clientFor('udc'); await signIn(c, 'udc');
  const { error } = await c.from('daily_kpi_reports')
    .update({ status: 'approved' }).eq('id', kpiId);
  await c.auth.signOut();
  // The protect_status trigger raises "Submitter cannot change KPI status".
  // If the policy USING clause filters the row out first (silent no-op), the row stays 'submitted' —
  // we accept either as PASS, since both mean UDC cannot self-approve.
  if (error && /status/i.test(error.message)) {
    check('udc cannot self-approve', true, error.message);
    return;
  }
  // Verify row was not actually approved.
  const verify = clientFor('nso'); await signIn(verify, 'nso');
  const { data } = await verify.from('daily_kpi_reports').select('status').eq('id', kpiId).single();
  await verify.auth.signOut();
  check('udc cannot self-approve', data?.status === 'submitted', `status now: ${data?.status}`);
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

  const answersPayload = [
    { submission_id: sub.id, item_id: items[0].id, answer: 'done',     has_photo: true  },
    { submission_id: sub.id, item_id: items[1].id, answer: 'done',     has_photo: false },
    { submission_id: sub.id, item_id: items[2].id, answer: 'not_done', has_photo: false },
  ];
  const { error: aErr } = await c.from('checklist_answers').insert(answersPayload);
  if (aErr) throw new Error(`udc answers: ${aErr.message}`);

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
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const cleanup = clientFor('super_admin'); await signIn(cleanup, 'super_admin');
  await cleanup.from('store_checklist_submissions')
    .delete().eq('template_id', templateId).eq('store_id', STORE_INDORE_1).eq('period_start', yesterday);
  await cleanup.auth.signOut();

  const setup = clientFor('udc'); await signIn(setup, 'udc');
  const { data: me } = await setup.auth.getUser();
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

async function main() {
  const expectedStores: Record<string, number> = {
    super_admin: 5, management: 5, state_area_manager: 3,
    nso: 2, udc: 1, dealer: 1,
    marketing_vm: 5, training_admin: 5, consultant: 5,
  };
  for (const [role, exp] of Object.entries(expectedStores)) {
    const got = await visibleStoreCount(role);
    check(`stores ${role}`, got === exp, `expected ${exp}, saw ${got}`);
  }

  const kpiId = await ensureUdcKpiForToday();

  await expectDuplicateBlocked();

  const expectedKpi: Record<string, number> = {
    super_admin: 1, management: 1, state_area_manager: 1,
    nso: 1, udc: 1, dealer: 1,
    marketing_vm: 1, training_admin: 1, consultant: 1,
  };
  for (const [role, exp] of Object.entries(expectedKpi)) {
    const got = await visibleKpiCount(role);
    check(`kpi ${role}`, got === exp, `expected ${exp}, saw ${got}`);
  }

  await resetToSubmitted(kpiId);
  await expectUdcCannotApprove(kpiId);
  await expectNsoCanApprove(kpiId);

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

  console.log(failures === 0 ? '\nAll WP1+WP2+M2 assertions passed.' : `\n${failures} assertion(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
