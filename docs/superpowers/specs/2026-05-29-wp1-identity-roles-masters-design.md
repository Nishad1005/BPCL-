# WP1 — Identity, Roles, Masters + RLS — Design Spec

**Date:** 2026-05-29
**Work package:** WP1 (per [BUILD_PLAN.md](../../../BUILD_PLAN.md) §6)
**Depends on:** WP0 (Expo + NativeWind + Supabase client + TanStack Query + `(auth)`/`(app)` split) — complete.
**Source of truth for roles/permissions:** [REQUIREMENTS.md](../../../REQUIREMENTS.md) §5 (roles) and §10 (permission matrix).

## 1. Goal & acceptance

Build the identity and master-data foundation with database-enforced authorization, so that **each of the 9 roles logs in and sees only the stores and screens it is permitted to see**.

**Acceptance check:** an automated RLS test signs in as one seed user per role, queries `stores`, and the visible set matches the expected scope for every role. Plus: a real email-OTP login routes each role to a role-appropriate shell, and Super Admin can CRUD stores/users.

WP1 enforces **store visibility** at the DB layer. Per-module verb enforcement (view/create/edit/approve/export from §10) is layered onto operational tables as they land in WP2+, reusing the same `accessible_store_ids()` helper. WP1 still seeds the full §10 grid into `roles_permissions` to drive UI affordances now.

## 2. Roles & store scope (from REQUIREMENTS §5/§10)

| Role (`app_role`) | Store scope | Scoping mechanism |
|---|---|---|
| `super_admin` | All stores; full control + config | role check |
| `management` | All stores; view + escalate only | role check |
| `state_area_manager` | Assigned region(s) + all descendants | `user_region_assignments` + region tree |
| `nso` | Assigned stores | `user_store_assignments` (`nso`) |
| `udc` | Own store(s) | `user_store_assignments` (`udc`) |
| `dealer` | Owned store(s); view-only | `user_store_assignments` (`dealer`) |
| `marketing_vm` | All stores for promotion/VM; view elsewhere | role check |
| `training_admin` | All stores for LMS; view elsewhere | role check |
| `consultant` | All stores; view/comment + coaching | role check |

Note: §10's grid lists 8 roles (omits Dealer). Dealer is treated as view-only on owned stores per §5 + the scope confirmed by the user.

## 3. Data model (WP1 tables)

### Enums
- `app_role`: `super_admin | management | state_area_manager | nso | udc | dealer | marketing_vm | training_admin | consultant`
- `region_type`: `state | area | cluster`
- `assignment_type`: `nso | udc | dealer`
- `app_module`: `daily_kpi | nso_visit | promotion_vm | resolution | lms | coaching`

### Tables
- **`regions`** — `id uuid pk, name text, type region_type, parent_id uuid null references regions(id), created_at`. Self-referencing tree (State → Area/Cluster), flexible depth.
- **`stores`** — `id uuid pk, store_name text, dealer_name text, address text, city text, state text, region_id uuid references regions(id), latitude numeric null, longitude numeric null, active bool default true, created_at`. `region_id` points to the store's area/cluster node.
- **`users`** — `id uuid pk references auth.users(id) on delete cascade, name text, email text, mobile text null, role app_role not null, primary_store_id uuid null references stores(id), active bool default true, created_at`. Profile row mirrors the Supabase Auth user.
- **`user_store_assignments`** — `id uuid pk, user_id uuid references users(id) on delete cascade, store_id uuid references stores(id) on delete cascade, assignment_type assignment_type, unique(user_id, store_id, assignment_type)`. For NSO / UDC / Dealer.
- **`user_region_assignments`** — `id uuid pk, user_id uuid references users(id) on delete cascade, region_id uuid references regions(id) on delete cascade, unique(user_id, region_id)`. For State/Area Managers.
- **`roles_permissions`** — `id uuid pk, role app_role, module app_module, can_view bool, can_create bool, can_edit bool, can_approve bool, can_export bool, unique(role, module)`. Seeded from §10; drives UI affordances (RLS is the real guard).

### Profile creation trigger
A `handle_new_user()` trigger on `auth.users` insert creates a matching `public.users` row. Role + name default from `auth.users.raw_user_meta_data` (set when the seed/admin flow creates the user); Super Admin can edit afterward.

## 4. Authorization / RLS

### Helper functions (both `SECURITY DEFINER`, `STABLE`, locked `search_path`)
- **`auth_role() returns app_role`** — returns the role of `auth.uid()` by reading `public.users`. `SECURITY DEFINER` so policies on `users` don't recurse.
- **`accessible_store_ids() returns setof uuid`** — the store set for `auth.uid()`:
  - role in (`super_admin, management, marketing_vm, training_admin, consultant`) → all `stores.id`
  - role = `state_area_manager` → recursive CTE over `regions` from the user's `user_region_assignments` down through all descendants; return `stores.id where region_id in (subtree)`
  - role in (`nso, udc, dealer`) → `store_id from user_store_assignments where user_id = auth.uid()`

### Policies (RLS enabled on every table)
- **`stores`** — SELECT: `id in (select accessible_store_ids())`. INSERT/UPDATE/DELETE: `auth_role() = 'super_admin'`.
- **`users`** — SELECT: own row (`id = auth.uid()`) OR `auth_role() = 'super_admin'` OR (`auth_role() in ('management','state_area_manager')` AND the user is assigned to a store/region within the caller's accessible scope). INSERT/UPDATE/DELETE: `super_admin` (self-row UPDATE for own profile basics allowed).
- **`regions`**, **`roles_permissions`** — SELECT: any authenticated user. Writes: `super_admin`.
- **`user_store_assignments`**, **`user_region_assignments`** — SELECT: own rows OR `super_admin`. Writes: `super_admin`.

## 5. Auth + role context (replaces WP0 stub)

- Login flow: **email magic-link / OTP** via `supabase.auth.signInWithOtp`. (Phone OTP via Twilio is later, not built now.)
- `lib/auth.tsx` becomes a real provider backed by the Supabase session:
  - exposes `session`, `profile` (role + name + primary store), `permissions` (the user's `roles_permissions` rows), `can(module, verb)`, `signInWithOtp(email)`, `verifyOtp(...)`, `signOut()`.
  - loads profile + permissions after session establishes; subscribes to `onAuthStateChange`.
- `app/_layout.tsx` keeps `Stack.Protected`, now keyed off `session != null`.
- `(app)` shows role-appropriate navigation; **admin routes gated to `super_admin`** (others get redirected/hidden).
- The WP0 `health_check` test screen is removed (its job is done); the `(app)` landing becomes a minimal role-aware home placeholder until WP2 dashboards.

## 6. Admin screens (Super Admin only, lean)

react-hook-form + zod, NativeWind styling.
- **Stores**: list + create/edit (store_name, dealer_name, city, state, region picker, active toggle).
- **Users**: list + create/edit (name, email, role, primary store, store assignments w/ type, region assignments). Creating a user provisions an auth user via an admin path (see §8).

No other module screens in WP1.

## 7. Seed data + RLS test (acceptance proof)

### Seed (`supabase/seed/seed.ts`, run with `service_role`)
- **2 states**: Madhya Pradesh, Chhattisgarh. Each → 1–2 areas → stores. ~5 stores total.
- **9 users**, one per role, emails like `superadmin@example.test`, with known passwords + `email_confirm: true` (via `auth.admin.createUser`), role set in user metadata so the trigger populates the profile.
- Assignments: State/Area Manager → an MP area; NSO → 2 specific stores; UDC → 1 store; Dealer → 1 store.

### Test (`scripts/test-rls.ts`)
Signs in (password) as each of the 9, queries `stores`, asserts the visible count/set:

| Role | Expected visible stores |
|---|---|
| super_admin | all (5) |
| management | all (5) |
| state_area_manager | only MP-area stores |
| nso | 2 assigned |
| udc | 1 own |
| dealer | 1 owned |
| marketing_vm | all (5) |
| training_admin | all (5) |
| consultant | all (5) |

Prints PASS/FAIL per role; non-zero exit on any failure. This is the WP1 acceptance gate.

## 8. Migration & tooling workflow (no Docker / cloud-only)

- `supabase init` scaffolds `supabase/` config.
- **User-run, one-time:** `supabase login` then `supabase link --project-ref coangflvkvaggztuvmue` (needs DB password — secret, user handles).
- Migrations authored as timestamped SQL files in `supabase/migrations/`; applied with `npx supabase db push` (straight to the linked cloud project — no local emulator, no `db reset`).
- Types regenerated: `supabase gen types typescript --project-id coangflvkvaggztuvmue > types/database.ts`.
- Seed/test scripts read `SUPABASE_SERVICE_ROLE_KEY` + URL from the untracked `.env` (already gitignored). The `service_role` key must **never** reach the client bundle — it is used only in Node scripts, never imported by app code.

## 9. Out of scope for WP1

- Operational tables (KPI, checklist, visits, issues, promotions, LMS, coaching) and their per-module verb policies — WP2+.
- Phone/SMS OTP (Twilio) — later.
- Dashboards, charts, exports — WP6.
- `audit_logs` triggers — introduced alongside the first mutable operational tables (WP2).

## 10. Risks / notes

- **RLS recursion:** mitigated by `SECURITY DEFINER` helpers (`auth_role`, `accessible_store_ids`) with locked `search_path`.
- **`service_role` leakage:** confined to Node scripts; never in `app/` or any `EXPO_PUBLIC_` var.
- **`db push` is non-reversible against cloud:** migrations are forward-only here; review SQL before pushing. No destructive resets.
