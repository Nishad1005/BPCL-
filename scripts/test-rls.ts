// scripts/test-rls.ts — run with: npm run test:rls
// Signs in as each seed user (anon client) and asserts how many stores RLS exposes.
import { config } from 'dotenv';
config();                      // .env  -> EXPO_PUBLIC_SUPABASE_URL / ANON_KEY
config({ path: '.env.seed' }); // .env.seed -> SEED_PASSWORD

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const password = process.env.SEED_PASSWORD!;
if (!url || !anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!password) throw new Error('Missing SEED_PASSWORD (create .env.seed)');

// Expected visible store COUNT per role (5 stores: 3 in MP, 2 in CG).
const expected: Record<string, number> = {
  super_admin: 5,
  management: 5,
  state_area_manager: 3, // MP subtree (Indore 2 + Bhopal 1)
  nso: 2,
  udc: 1,
  dealer: 1,
  marketing_vm: 5,
  training_admin: 5,
  consultant: 5,
};

async function visibleStoreCount(role: string): Promise<number> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email: `${role}@example.test`, password });
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
