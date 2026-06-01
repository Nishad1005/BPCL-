# Project: Store Performance Communication System

Universal Expo app (web + iOS + Android) on Supabase.
**Source of truth: BUILD_PLAN.md** — read it before doing anything.

## Stack
- TypeScript everywhere. Expo + Expo Router.
- Styling: NativeWind (Tailwind). Data: TanStack Query + Supabase client.
- Forms: react-hook-form + zod (reuse zod schemas on Edge Functions).
- Charts: victory-native. State: Zustand for light UI state only.
- i18n: i18next (English only for MVP; keep `locales/en.json` so Hindi can be added later with no refactor).

## Hard rules
- **Enforce permissions in Postgres Row Level Security, not just the UI.** Never trust the client for access control.
- All photo proof goes through the `attachments` table + **private** Supabase Storage buckets with signed URLs. No public buckets.
- A promotion can never be marked fully compliant without uploaded **and** validated photo proof.
- Build strictly in the **WP0 → WP9** order in BUILD_PLAN.md. Do one work package at a time.
- Do **not** build anything in the "Not in MVP" list (ERP/POS integration, automated sales pull, computer-vision POP validation, gamification).

## Workflow
- Every schema change is a migration in `supabase/migrations/`. Regenerate DB types after (`supabase gen types`).
- Write/seed test users for all 9 roles and verify RLS **before** building screens on top of a table.
- After each work package, run its acceptance check in BUILD_PLAN.md and stop for review before continuing.
- Multi-state from day one: build the `regions` hierarchy (state → area/cluster → store) and scope managers via `user_store_assignments`.

## Don't
- Don't hardcode secrets — read Supabase URL/keys from `.env`.
- Don't skip ahead to later work packages, even if it seems faster.
- Don't store derived values that should be computed (e.g., issue `ageing`) — compute in views/functions.
