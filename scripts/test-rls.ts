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
  const { data, error } = await c.from('daily_kpi_reports').select('id');
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

  await expectUdcCannotApprove(kpiId);
  await expectNsoCanApprove(kpiId);

  console.log(failures === 0 ? '\nAll WP2 assertions passed.' : `\n${failures} assertion(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
