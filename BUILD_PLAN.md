# Store Performance Communication System — Build Plan & Architecture

**Source:** Developer Handover (BRD + FRD) v1.0, 21 May 2026 — V Mentor / MPCG Store Performance Automation
**This document:** Engineering blueprint for building the system as one codebase that ships as a **web app now** and to **Google Play + Apple App Store** later.
**Intended use:** Keep this in the repo root and feed it to Claude Code as the source of truth. Build module by module against the "Build Sequence" section.

---

## 0. Guiding decisions (read first)

1. **One codebase for web + iOS + Android.** Rather than building a web app now and a separate mobile app later (the handover's fallback plan), we build a *universal* app from day one. This honors the handover's "API-first, mobile-first" intent while avoiding a second build.
2. **The promotion-compliance / photo-proof loop is the product's spine.** Camera capture, secure photo storage, and "cannot mark compliant without validated proof" are core, not optional polish.
3. **Permissions are data, not code.** The 9-role permission matrix is enforced at the database layer (Row Level Security) so every client — web, iOS, Android, and any future integration — is automatically safe.
4. **Build the MVP cut from the handover, in order.** Must-Have first, then Should-Have, then Could-Have. Do not build "Not in MVP" items.

---

## 1. Recommended tech stack

| Layer | Choice | Why it fits this project |
|---|---|---|
| **App (all platforms)** | **Expo + Expo Router + React Native + TypeScript** | Single codebase compiles to **web, iOS, and Android**. Directly satisfies "web now, app stores later" with no rewrite. First-class camera, push notifications, and secure storage. |
| **Styling/UI** | **NativeWind (Tailwind for RN)** + a small primitives layer (`react-native-paper` or `gluestack-ui`) | Tailwind syntax is fast to iterate and well-understood by Claude Code; works identically on web + native. |
| **Backend / DB** | **Supabase** (managed Postgres) | The handover's data model is relational with foreign keys, ageing calcs, and scoring — a perfect Postgres fit (far better than a document store). |
| **Auth** | Supabase Auth — **email + phone OTP** | Handover explicitly wants mobile OTP for field users. |
| **Authorization** | **Postgres Row Level Security (RLS)** | The permission matrix becomes enforced policies; impossible for a client to bypass. |
| **File storage** | Supabase Storage (private buckets + signed URLs) | Photo proof for KPI, checklists, visits, and promotion compliance. |
| **Server logic** | Supabase **Edge Functions** (Deno/TS) + **pg_cron** | Score computation, escalation/overdue jobs, notification dispatch, export generation. |
| **Data fetching/cache** | **TanStack Query** + Supabase client; **Zustand** for light UI state | Offline-friendly caching, optimistic updates for fast form submits. |
| **Forms/validation** | **react-hook-form + zod** | Shared validation schemas reused on client and Edge Functions. |
| **Charts (dashboards)** | **victory-native** (renders on web + native) | One charting layer everywhere. |
| **Exports** | Excel via **SheetJS**; PDF via Edge Function (templated) | Handover requires Excel + PDF (visit reports, monthly summary, compliance with photo links). |
| **App-store delivery** | **EAS Build + EAS Submit**; web via Expo web export to Vercel/Cloudflare | Cleanest path from an Expo codebase to both stores. |
| **i18n** | `i18next` / `expo-localization` (English + Hindi labels) | Handover wants Hindi/English-ready labels. |

**Why Supabase over Firebase here:** relational joins, ageing/score SQL, a complex role matrix, and exportable tabular reports all favor Postgres + RLS over Firestore's document model.

**Scale-out option (not now):** if management dashboards later need very heavy tables/BI, add a dedicated **Next.js admin** that talks to the *same* Supabase backend. No rewrite — the app is already API/DB-first. Keep this in your back pocket; don't build it for MVP.

---

## 2. Project structure (single repo)

```
store-performance/
├── CLAUDE.md                  # short standing instructions for Claude Code (see §8)
├── BUILD_PLAN.md              # this file
├── app/                       # Expo Router routes (file-based)
│   ├── (auth)/                # login, OTP
│   ├── (app)/                 # authenticated shell
│   │   ├── dashboard/         # role-routed home dashboards
│   │   ├── kpi/               # M1 daily KPI
│   │   ├── checklist/         # M2
│   │   ├── visits/            # M3 NSO visits
│   │   ├── issues/            # M4 resolution tracker
│   │   ├── promotions/        # M5 VM/POP compliance
│   │   ├── lms/               # M6
│   │   ├── coaching/          # M7
│   │   └── admin/             # masters: stores, users, roles, templates
│   └── _layout.tsx
├── components/                # shared UI (Form fields, PhotoUpload, StatusPill, DataTable, Chart)
├── lib/
│   ├── supabase.ts            # client
│   ├── auth.ts                # session + role context
│   ├── hooks/                 # useKpi, useIssues, useStoreScore ...
│   └── schemas/               # zod schemas (shared with edge functions)
├── supabase/
│   ├── migrations/            # SQL — schema, enums, RLS policies, cron
│   ├── functions/             # edge functions: scoring, escalations, exports, notify
│   └── seed.sql               # demo masters for local dev
├── locales/                   # en.json, hi.json
└── types/                     # generated DB types (supabase gen types)
```

---

## 3. Data model (refined from handover §9)

Keep the handover's 15 tables; the refinements below make RLS, hierarchy, and scoring clean. Use **enums** for all status/priority/role fields.

### Hierarchy & identity
- `regions` (state/area) — `id, name, type` (state | area | cluster)
- `stores` — handover fields **+** `region_id`, `cluster_id`, `latitude`, `longitude` (for future GPS)
- `users` — handover fields; `role` as enum; `primary_store_id`
- `user_store_assignments` — **(new)** many-to-many `user_id, store_id, assignment_type` (covers NSO→stores, manager→region, multi-store dealers). RLS reads from here.
- `roles_permissions` — module-level grid as in handover (drives UI affordances; RLS is the real guard)

### Operational tables (as handover, with notes)
- `daily_kpi_reports` — add unique constraint `(store_id, report_date)`; `abv` is generated/derived; `status` enum (submitted | approved | rejected | edited)
- `checklist_templates` + `checklist_items` — **split** items out of the template; item supports `Done | Not Done | Needs Support | N/A`, `requires_photo`
- `store_checklist_submissions` + `checklist_answers` — answers per item; `score` computed
- `nso_visit_reports` — sections per handover §7.3; `time_in/time_out`; links to issues/coaching
- `issues` — resolution tracker; enums for `category`, `priority`, `status`; `ageing` computed in views, not stored; `escalation_level` derived
- `promotions` + `promotion_pop_elements` — **(new)** required POP elements per promotion (entrance/shelf/counter/combo)
- `promotion_compliance` — per store; `compliance_status` enum (Compliant | Partial | Non-Compliant) + percentage; blocks "Compliant" until validated proof exists
- `lms_courses`, `lms_lessons`, `lms_quizzes`, `lms_progress`
- `coaching_actions` + `coaching_sessions` — **split** the recurring session record from the action
- `store_scores` — **(new)** periodic snapshot of the 100-point score with component breakdown (for trend/before-after)
- `attachments` — **(new)** generic table: `id, entity_type, entity_id, storage_path, uploaded_by` (one place for all photo proof)
- `notifications`, `audit_logs` — as handover; write `audit_logs` via DB triggers so nothing is missed

### Store score (handover §7.7) — configurable weights
KPI discipline 15 · Sales/NOB/ABV 20 · Checklist 20 · VM/POP 20 · Issue closure 15 · Training 10 → store weights in a `score_config` row so management can tune without a deploy. Compute in an Edge Function on a schedule, write to `store_scores`.

---

## 4. Authorization model (the permission matrix → RLS)

Translate handover §10 into policies. The core idea: **what stores can this user touch?**

- A SQL helper `accessible_store_ids(user)` returns store IDs from `user_store_assignments` (+ region expansion for managers; all stores for Super Admin/Management/Consultant per their matrix row).
- Every operational table's RLS policy = `store_id IN (accessible_store_ids)` **AND** the per-module verb (view/create/edit/approve/export) allowed for that role.
- Verbs map directly to the matrix cells (e.g., NSO: `create/edit` issues on assigned stores, `validate` promotions on assigned stores; UDC: `create/view` own store only; Management: `view` + escalate).

Build and **test RLS with seed users for all 9 roles** before building screens on top.

---

## 5. MVP scope (locked from handover §12)

- **Must (build first):** login + OTP, role management, store master, **M1 daily KPI**, **M2 checklist**, **M3 NSO visit**, **M4 resolution tracker**, **M5 VM/POP photo proof**, basic role dashboards, Excel export.
- **Should (next):** LMS basics + quiz + assignment, consultant coaching actions, PDF visit report, in-app notifications.
- **Could (later):** GPS tagging, offline mode, WhatsApp/SMS alerts, QR store login, advanced analytics, AI summary.
- **Not in MVP (do not build):** ERP/POS integration, automated sales pull, computer-vision POP validation, gamification.

---

## 6. Build sequence (Claude-Code work packages)

Each package is a self-contained unit: ship it, verify the acceptance check, then move on. This reorders the handover's 6 phases into demoable increments.

**WP0 — Foundation**
- Create Expo (TypeScript, Expo Router) app; add NativeWind, TanStack Query, react-hook-form/zod.
- Create Supabase project; wire client + env; generate DB types.
- *Acceptance:* app runs on web + Expo Go; can read a test row from Supabase.

**WP1 — Identity, roles, masters**
- Migrations: regions, stores, users, user_store_assignments, roles_permissions, enums.
- Auth (email + phone OTP); role context; protected routing; Admin screens for store/user CRUD.
- RLS policies + seed users for all 9 roles; RLS test script.
- *Acceptance:* each role logs in and sees only permitted stores/screens.

**WP2 — M1 Daily KPI** (Phase 1)
- KPI form (auto ABV, store/UDC/NSO auto-fill, stockout multi-entry, optional photo), one-per-store-per-day rule, NSO review/approve/reject, missed-report reminder, store dashboard tile, Excel export.
- *Acceptance:* store user submits KPI on mobile in **under 3 minutes**; duplicate blocked; NSO approves.

**WP3 — M2 Checklist + M3 NSO Visit** (Phase 2)
- Configurable checklist templates/items with status + photo; submission + scoring.
- NSO visit report (all §7.3 sections) with before/after photos; action points flow to tracker.
- *Acceptance:* NSO creates a visit with photos and action points from mobile.

**WP4 — M4 Resolution Tracker** (Phase 3)
- Issue CRUD, owner/priority/due-date, status workflow, computed ageing, closure proof, escalation levels; list with filters.
- pg_cron + Edge Function for overdue escalation + notifications.
- *Acceptance:* any action point becomes an issue with owner/priority/due-date; overdue auto-escalates.

**WP5 — M5 VM/POP/Promotion Compliance** (Phase 4)
- Promotion master + required POP elements; store photo upload per element; NSO validate; scoring; auto-create resolution item on missing/rejected; promotion dashboard.
- *Acceptance:* a promotion **cannot** be marked fully compliant without uploaded + validated photo proof.

**WP6 — Dashboards + Store Score + Exports** (spans M8)
- Role dashboards (handover §8); store score Edge Function → `store_scores`; Excel everywhere + PDF visit report + monthly management PDF.
- *Acceptance:* management sees store/NSO/cluster dashboards without asking for Excel.

**WP7 — M6 LMS** (Phase 5, Should-Have)
- Course/lesson/quiz, role-wise assignment, completion + pass score, retraining trigger from low checklist/compliance, LMS dashboard.

**WP8 — M7 Consultant Coaching + Analytics** (Phase 6, Should-Have)
- Gap diagnosis from KPI/checklist/VM/ageing/training; coaching actions + sessions; before/after tracking; monthly impact PDF.

**WP9 — App-store hardening** (Could-Have + release)
- Push notifications (expo-notifications), app icons/splash, i18n pass (en/hi), EAS Build configs, store listings; submit via EAS Submit.

---

## 7. App-store readiness checklist (do early, finish at WP9)

- **Apple Developer Program** account (~$99/yr) and **Google Play Console** (one-time $25) — register early; approval/verification can take days.
- Bundle IDs / package names reserved (e.g., `com.vmentor.storeperf`).
- App icons, splash, screenshots, privacy policy URL, data-safety form (you collect photos, location, contact — disclose accurately).
- Push notification certs/keys configured in EAS.
- Because the app has real native functionality (camera, push, OTP) it is **not** a thin webview wrapper — this keeps you clear of Apple's "minimum functionality" rejection risk.

---

## 8. Suggested `CLAUDE.md` (put in repo root)

```
# Project: Store Performance Communication System
Universal Expo app (web + iOS + Android) on Supabase. Source of truth: BUILD_PLAN.md.

Rules:
- TypeScript everywhere. Styling: NativeWind. Data: TanStack Query + Supabase.
  Forms: react-hook-form + zod. Charts: victory-native.
- Enforce permissions in Postgres RLS, not just UI. Never trust the client for access.
- All photo proof goes through the `attachments` table + private Storage buckets with signed URLs.
- Build strictly in the WP0..WP9 order in BUILD_PLAN.md. Don't build "Not in MVP" items.
- Every schema change is a migration in supabase/migrations. Regenerate types after.
- After each work package, run the acceptance check before moving on.
```

---

## 9. Locked decisions

| Decision | Choice | Build impact |
|---|---|---|
| **Stack** | **Expo universal (web + iOS + Android) + Supabase** | One codebase; RLS-enforced permissions; native camera/push for field users. |
| **Languages** | **English only for MVP** | Still wire `i18next` + `locales/en.json` so Hindi can be added later by dropping in `hi.json` — no refactor. Don't translate yet. |
| **Rollout** | **Multi-state from day one** | Build the `regions` hierarchy (state → area/cluster → store) and multi-state filters/dashboards from the start; seed several states. RLS must scope managers to their region(s) via `user_store_assignments`. |

### Still open (not blocking — defaults below until you say otherwise)
- **Branding:** start with a clean neutral theme; swap in logo/brand colors at WP9.
- **Offline:** treated as Could-Have (post-MVP). Architecture stays offline-ready (TanStack Query cache now; `expo-sqlite` later).

WP0 can start immediately.
