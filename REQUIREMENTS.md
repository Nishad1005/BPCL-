Store Performance Communication System | Developer Handover

| **STORE PERFORMANCE** **COMMUNICATION SYSTEM** Developer Handover Document / BRD + FRD |
| --- |

**Purpose**

To automate store checklists, NSO store visits, daily KPI reporting, resolution tracking, VM/POP compliance, LMS training and consultant-led performance coaching between stores and management.

| **Field** | **Details** |
| --- | --- |
| Prepared for | V Mentor / MPCG Store Performance Automation |
| Prepared by | Kiran Kumar K / V Mentor Retail Performance Consulting |
| Document type | Developer-ready Product Requirement and Functional Specification |
| Version | v1.0 - Draft for build discussion |
| Date | 21 May 2026 |

| **Core product principle** If a store promotion needs to be explained separately to every customer visiting the store, the promotion has already failed. The promotion must speak visually through VM, shelf POP, offer strips, combo boards, counter display and photo-verified store execution. |
| --- |

# 1. Executive Product Brief

**This system is intended to become the single operating layer between stores, NSOs, state teams, management and consultants. **At present, many store-level activities are communicated through WhatsApp, verbal updates, Excel sheets and individual follow-ups. This creates leakage in execution, weak visibility for management and limited data for performance coaching.

Capture daily store numbers such as NOB, walk-ins, sales, ABV, promotion sales and operational remarks.

Digitise store checklists, NSO visit reports, VM/POP compliance checks and resolution sheets.

Create a structured LMS for UDCs, store staff, NSOs and dealers.

Give management a live dashboard on store performance, issue closure, training completion and execution quality.

Give consultants a data-backed coaching tool to identify weak stores, coach teams and measure improvement.

| **Business outcome expected** The system should convert communication into a discipline: every store report creates visibility, every issue creates ownership, every training gap creates a coaching action, and every improvement becomes measurable. |
| --- |

# 2. Business Problem to Solve

| **Problem Area** | **Current Challenge** |
| --- | --- |
| Scattered communication | Store issues, promotions, daily numbers and visit observations are shared across WhatsApp, calls, Excel and verbal discussions. |
| Weak promotion execution visibility | Management may launch promotions, but there is limited proof that POP material, shelf strips or offer displays are actually visible inside the store. |
| Inconsistent store visits | NSO visits may happen, but the quality, observations, action points and follow-up are not captured in one standard format. |
| Resolution tracking gap | Issues get raised but may not have clear owner, due date, ageing, closure proof or escalation route. |
| Training gap | New staff and UDCs need basic retail, VM, customer interaction, upselling and reporting training in a repeatable format. |
| Consulting impact not measured | Consultant coaching should be linked with store scores, training completion, sales movement, NOB improvement and issue closure. |

# 3. Product Vision

**Build a simple, mobile-first Store Performance Communication System that works at store level and also gives management a clean top-level view. **The platform should be practical for Indian retail operations: fast forms, low typing effort, photo proof, Hindi/English-ready labels where required, WhatsApp-style reminders where possible, and clear dashboards for managers.

| Store Team enters daily data and checklist         -> NSO reviews, validates and adds visit observations         -> Issues move into Resolution Tracker with owner and due date         -> LMS assigns training and quizzes based on gaps         -> Consultant reviews data and coaches store/NSO         -> Management sees dashboard and escalation summary |
| --- |

# 4. Core Product Rule: Promotion Must Speak Before Staff Speaks

**In a forecourt convenience store, the customer does not spend much time inside the store. The decision window is short. **If the staff has to explain every offer manually, then the promotion is not scalable. A good promotion must be visible and understood without personal explanation.

Every active promotion should have customer-facing communication at store entrance, shelf or counter level.

VM and POP execution must be photo verified, not only verbally confirmed.

Promotion compliance should be scored store-wise and NSO-wise.

Missing POP material or poor visibility should automatically create an action in the Resolution Tracker.

Consultant coaching should use promotion compliance data to train teams on visibility, cross-selling and conversion.

# 5. Target Users and Roles

| **Role** | **Main Responsibility** |
| --- | --- |
| Super Admin | System setup, master data, role permissions, user creation, global configuration. |
| Management / Business Head | View dashboards, review escalations, track cluster-level performance, approve major actions. |
| State / Area Manager | Monitor NSOs, store performance, issue ageing, training completion and weekly review cadence. |
| NSO | Conduct store visits, validate daily reporting, create action points, coach UDC/store staff, close observations. |
| UDC / Store Manager | Submit daily store KPI, complete store checklist, upload photos, confirm issue closure, complete LMS. |
| Dealer / Owner | View store-level action points, support closure, see performance summary and pending issues. |
| Marketing / VM Manager | Create promotion checklist, define POP material requirements, audit VM compliance. |
| Training Admin | Create LMS modules, quizzes, certificates, role-wise training plans. |
| Consultant / Coach | Review store data, identify gaps, assign coaching actions, record interventions and track impact. |

# 6. Module Overview

| **Code** | **Module** | **Purpose** |
| --- | --- | --- |
| M1 | Daily Store KPI Reporting | NOB, walk-ins, sales, ABV, promotion sales, remarks, stockouts, conversion signals. |
| M2 | Store Checklist Automation | Daily/weekly checklist for cleanliness, stock, expiry, planogram, POP, counter display and compliance. |
| M3 | NSO Store Visit | Structured visit report with observations, photos, action points, dealer interaction and training done. |
| M4 | Resolution Tracker | Digital version of resolution sheet with owner, priority, due date, ageing, status and closure proof. |
| M5 | VM / POP / Promotion Compliance | Photo proof of shelf strips, offer boards, danglers, combo displays and counter communication. |
| M6 | LMS Training | Short lessons, videos, quizzes, completion tracking and retraining triggers. |
| M7 | Consultant Coaching | Performance gap diagnosis, coaching actions, intervention notes, before/after impact tracking. |
| M8 | Dashboards and Reports | Management, NSO, store, training and consultant dashboards with exportable reports. |
| M9 | Notifications and Escalations | Reminders, overdue alerts, issue escalation and training reminders. |

# 7. Detailed Functional Requirements

## 7.1 Daily Store KPI Reporting

Store should submit one daily KPI report before a defined cut-off time.

System should prevent duplicate submission for the same store and date unless edited by authorised user.

NSO should be able to review, approve, reject or comment on submitted reports.

Missed daily report should trigger reminder to UDC and visibility to NSO.

| **Field** | **Requirement** |
| --- | --- |
| Date | Auto/default current date; editable only by authorised user. |
| Store Name | Dropdown from store master. |
| UDC Name | Auto based on store, editable by role. |
| NSO Name | Auto mapped from store master. |
| NOB / Number of Bills | Numeric field. |
| Walk-ins | Numeric field; may be estimate if exact counter is not available. |
| Total Sales | Numeric amount. |
| Average Bill Value | Auto calculated = Total Sales / NOB. |
| Promotion Sales | Numeric amount or count, optional per active promotion. |
| Fuel-to-store conversion estimate | Optional percentage or count based on forecourt observation. |
| Top Selling Category | Dropdown + remarks. |
| Slow Moving Category | Dropdown + remarks. |
| Stockout Items | Multiple item entry with SKU/category/remarks. |
| Remarks / Support Needed | Free text. |
| Photo Upload | Optional for display, counter or special issue. |

## 7.2 Store Checklist Automation

The checklist should be configurable by frequency: Daily, Weekly, Monthly or Visit-based. Each checklist item should support Done / Not Done / Needs Support / Not Applicable, with optional photo proof and remarks.

| **Checklist Area** | **Examples** |
| --- | --- |
| Cleanliness and hygiene | Floor, counter, shelves, fridge, entrance, waste area. |
| Product availability | Key SKUs available, stock gaps identified. |
| Expiry and FIFO | Expiry checked, near-expiry highlighted, FIFO followed. |
| Price tag and MRP visibility | Price tags available and correct. |
| VM and POP | Shelf strips, offer boards, counter communication, combo display visible. |
| Planogram / Shelf discipline | Products arranged as per basic category logic and hero SKU visibility. |
| Counter selling | Impulse products, add-on items and promotions placed near billing area. |
| Staff grooming and interaction | Basic greeting, uniform/grooming, customer interaction readiness. |
| Compliance | Basic store operating compliance and safety checks. |

## 7.3 NSO Store Visit Report

NSO should create a visit report for every store visit.

GPS/location capture can be optional in MVP but recommended in later phase.

Visit report should allow photos before and after correction.

Action points from the visit should automatically flow to the Resolution Tracker or Coaching Tracker as required.

| **Section** | **Required Details** |
| --- | --- |
| Visit details | Date, store, NSO, UDC, dealer met, staff met, time in/time out. |
| Commercial review | Sales trend, NOB, walk-ins, ABV, promotion performance. |
| Store condition | Cleanliness, stock, expiry, display, counter, customer flow. |
| VM / POP review | Promotion visibility, shelf strips, offer boards, combo packs, photo proof. |
| Training done | Topic covered, participants, duration, feedback, LMS module assigned. |
| Issues identified | Issue category, priority, owner, due date, expected closure. |
| Coaching observation | What needs improvement in UDC/staff/NSO/store behaviour. |
| Next visit plan | Follow-up date and specific review points. |

## 7.4 Resolution Tracker

The resolution sheet should become a live digital tracker. WhatsApp can remain a discussion channel, but any issue that needs action, review, audit or escalation must be logged in the system.

| **Field** | **Requirement** |
| --- | --- |
| Issue ID | Auto generated unique number. |
| Store | Mapped to store master. |
| Raised By | UDC / NSO / Consultant / Manager. |
| Issue Category | Stock, VM, POP, fixture, IT, billing, training, dealer support, maintenance, compliance, other. |
| Description | Clear issue statement. |
| Priority | Low / Medium / High / Critical. |
| Owner Department / Person | Responsible owner mapped from issue type or manually assigned. |
| Target Date | Required for all open issues. |
| Status | Open / In Progress / Pending with Store / Pending with Dealer / Pending with Department / Resolved / Escalated / Closed. |
| Ageing | Auto calculated from created date. |
| Closure Proof | Photo/file/remarks mandatory for selected issue types. |
| Escalation Level | Auto based on ageing and priority. |

## 7.5 VM / POP / Promotion Compliance

| **Mandatory design requirement** For every active promotion, the system should ask for photo proof from the store and validate whether the promotion is visible at the customer decision point. A promotion should not be marked as executed only because the store has been verbally informed. |
| --- |

| **Function** | **Requirement** |
| --- | --- |
| Promotion setup by Marketing/VM | Promotion name, SKU/category, offer period, required POP elements, sample image, target stores. |
| Store execution by UDC | Upload photos for entrance, shelf, counter and combo display as applicable. |
| NSO validation | Approve/reject with remarks and action point. |
| Compliance scoring | Score store as Compliant / Partially Compliant / Non-Compliant; calculate percentage. |
| Auto action creation | Missing POP or rejected display should create resolution item. |
| Management dashboard | Promotion-wise store compliance, pending stores, delayed stores and photo proof access. |

## 7.6 LMS Training Module

The LMS should be simple and mobile-friendly. Training should be short, practical and linked to store execution gaps.

| **Function** | **Requirement** |
| --- | --- |
| Training Library | Create lessons with video, PDF, image, text and quiz. |
| Role-wise assignment | Assign modules to UDC, staff, NSO, dealer or management role. |
| Quiz and passing score | MCQ/true-false quiz with pass percentage. |
| Completion certificate | Optional certificate after required modules. |
| Retraining trigger | Low checklist score or failed compliance can auto-assign relevant training. |
| Training dashboard | Completion %, pending users, failed quizzes, store-wise gaps. |

### Suggested Training Modules for First Release

| **Module** | **Target Users** | **Coverage** |
| --- | --- | --- |
| Basic Store Retail Skills | UDC, store staff | Customer greeting, billing discipline, store readiness, quick selling behaviour. |
| Visual Merchandising Basics | UDC, NSO, store staff | Shelf strips, POP placement, offer visibility, counter display, category blocking. |
| Promotion Communication | UDC, staff, NSO | How to make offers visible, how to upsell and cross-sell without overexplaining. |
| Daily Reporting Discipline | UDC, NSO | How to submit NOB, walk-ins, sales, stockout and remarks correctly. |
| Expiry and FIFO | UDC, staff | Expiry check, near-expiry handling, FIFO basics. |
| Forecourt to Store Conversion | Dealer, NSO, UDC | How forecourt DSMs can support store footfall and fuel-to-store conversion. |

## 7.7 Consultant Performance Coaching Module

This module is important because the consultant should not only give observations; the consultant should coach using real store data and show measurable improvement.

| **Feature** | **Requirement** |
| --- | --- |
| Gap Diagnosis | System highlights weak stores based on KPI trend, checklist score, VM score, issue ageing and training completion. |
| Coaching Action | Consultant can create coaching action for store, UDC, NSO, dealer or staff. |
| Coaching Session Record | Topic, date, participants, issue addressed, action agreed, next review date. |
| Before/After Tracking | Compare store metrics before and after coaching period. |
| Impact Summary | Generate monthly coaching report for management with measurable outcomes. |

### Suggested Store Performance Score

For management reporting, the system can calculate a 100-point store score. Weightage should be configurable.

| **Score Component** | **Default Weight** |
| --- | --- |
| Daily KPI Reporting Discipline | 15 |
| Sales / NOB / ABV Trend | 20 |
| Store Checklist Compliance | 20 |
| VM / POP / Promotion Compliance | 20 |
| Issue Closure Discipline | 15 |
| Training Completion | 10 |
| **Total** | **100** |

# 8. Dashboards and Reports

| **Dashboard** | **Key Information** |
| --- | --- |
| Management Dashboard | Cluster sales, NOB, walk-ins, ABV, VM compliance, training completion, issue ageing, top/bottom stores. |
| State / Area Dashboard | NSO-wise store visits, pending reports, issue closure, store score movement, delayed escalations. |
| NSO Dashboard | Assigned stores, due visits, pending validations, store-wise action points, training gaps. |
| Store Dashboard | Daily reporting status, checklist score, open issues, training pending, promotion compliance. |
| VM / Promotion Dashboard | Promotion-wise compliance, photo proof, missing POP, rejected execution, store coverage. |
| LMS Dashboard | User-wise and store-wise completion, failed quiz, overdue training, retraining required. |
| Consultant Dashboard | Weak stores, coaching queue, intervention history, before/after performance movement. |

## Export Requirements

Export daily KPI report to Excel/PDF by date range, store, NSO and cluster.

Export resolution tracker with ageing and status.

Generate monthly management summary in PDF format.

Generate NSO visit report PDF for each visit.

Export LMS completion report by user, store and module.

Export promotion compliance report with photo links.

# 9. Recommended Data Model / Main Database Tables

| **Table** | **Purpose** | **Key Fields** |
| --- | --- | --- |
| users | All users | id, name, mobile, email, role_id, store_id, nso_id, active_status |
| roles_permissions | Role and access control | role_id, module, can_view, can_create, can_edit, can_approve, can_export |
| stores | Store master | store_id, store_name, dealer_name, address, city, state, nso_id, UDC_id, active_status |
| daily_kpi_reports | Daily reporting | report_id, store_id, date, nob, walk_ins, sales, abv, promo_sales, remarks, submitted_by, status |
| checklist_templates | Checklist setup | template_id, checklist_type, frequency, questions, mandatory_photo_rules |
| store_checklist_submissions | Checklist response | submission_id, store_id, template_id, date, score, submitted_by, reviewed_by |
| nso_visit_reports | NSO visit | visit_id, store_id, nso_id, visit_date, observations, training_done, next_visit_date, score |
| issues | Resolution tracker | issue_id, store_id, category, priority, description, owner_id, due_date, status, ageing, closure_proof |
| promotions | Promotion master | promotion_id, name, start_date, end_date, required_pop, target_stores |
| promotion_compliance | VM/POP execution | id, promotion_id, store_id, photo_urls, compliance_status, validated_by, remarks |
| lms_courses | Training modules | course_id, title, role_target, lessons, quiz, passing_score |
| lms_progress | Training progress | user_id, course_id, status, score, completion_date, retake_required |
| coaching_actions | Consultant coaching | action_id, store_id, user_id, gap_area, action_plan, coach_id, due_date, outcome |
| notifications | Alerts | notification_id, user_id, type, message, related_entity, read_status, created_at |
| audit_logs | System audit | id, user_id, action, module, entity_id, timestamp, old_value, new_value |

# 10. Permission Matrix

| **Role** | **Daily KPI** | **NSO Visit** | **Promotion/VM** | **Resolution** | **LMS** | **Coaching** |
| --- | --- | --- | --- | --- | --- | --- |
| Super Admin | Full | Full | Full | Full | Full | Full |
| Management | View | View | View | View/Escalate | View | View |
| State / Area Manager | View/Approve | View/Approve | View | View/Edit/Escalate | View | View |
| NSO | View/Approve assigned stores | Create/View assigned | Validate assigned | Create/Edit assigned | View assigned | Create/View assigned |
| UDC / Store Manager | Create/View own store | Create own store | Upload own store | Create/View own issues | Complete own training | View own store |
| Marketing / VM | View | View | Create/Validate | Create VM issues | View VM training | View VM dashboard |
| Training Admin | View | View | View | View | Create/Edit/Assign | View LMS dashboard |
| Consultant | View/Comment | View/Comment | View/Comment | Create/Comment | View/Recommend | Create/Edit coaching |

# 11. Notifications and Escalations

| **Trigger** | **System Action** |
| --- | --- |
| Daily KPI not submitted by cut-off | Reminder to UDC; alert to NSO after grace period. |
| Checklist not completed | Reminder to UDC; visible on NSO dashboard. |
| NSO visit overdue | Reminder to NSO; alert to Area Manager if delayed. |
| Issue due date crossed | Escalate to owner and manager based on priority. |
| Critical issue open beyond threshold | Escalate to Business Head / Management dashboard. |
| Promotion compliance rejected | Create action point and notify UDC + NSO. |
| LMS overdue | Reminder to user; alert to NSO/Training Admin. |
| Coaching action overdue | Notify consultant and responsible user. |

# 12. MVP Scope

The first version should focus on practical field usage and management visibility. Avoid overbuilding at the start. The MVP should be mobile-first and easy for store users.

| **Priority** | **Scope** |
| --- | --- |
| Must Have | Login, role management, store master, daily KPI, checklist, NSO visit, resolution tracker, VM/POP photo proof, basic dashboards, Excel export. |
| Should Have | LMS basics, quiz, training assignment, consultant coaching actions, PDF visit report, notifications. |
| Could Have | GPS tagging, offline mode, WhatsApp alerts, QR code store login, advanced analytics, AI summary. |
| Not in MVP | Complex ERP/POS integration, automated sales pull, computer vision validation of POP photos, advanced gamification. |

# 13. Suggested Technical Approach

Build as a responsive web app / PWA first, so it works on mobile without forcing app store deployment in the initial phase.

Use a structured backend with role-based access control and audit logs from day one.

Store photo uploads in cloud storage with secure URLs mapped to the correct report or issue.

Keep all master data configurable: stores, users, roles, checklist templates, issue categories, promotions and training courses.

Design API-first so that a mobile app can be developed later without rewriting the backend.

| **Layer** | **Recommendation** |
| --- | --- |
| Frontend | Next.js / React or FlutterFlow web app; mobile-first responsive forms. |
| Backend | Supabase / Firebase / Node.js API with PostgreSQL or equivalent relational DB. |
| Authentication | Role-based login; mobile OTP can be considered for field users. |
| Storage | Cloud storage for photos, documents and training content. |
| Dashboards | In-app dashboard first; optional Looker Studio / Power BI later. |
| Exports | Excel and PDF generation for management reports and visit reports. |
| Notifications | In-app notifications in MVP; WhatsApp/SMS/email optional phase two. |

# 14. Build Phases

| **Phase** | **Deliverables** |
| --- | --- |
| Phase 1: Foundation | User roles, store master, login, daily KPI report, basic dashboard, Excel export. |
| Phase 2: Store Execution | Store checklist, NSO visit report, photo uploads, action points. |
| Phase 3: Resolution Discipline | Resolution tracker, due dates, ageing, status, escalations, closure proof. |
| Phase 4: VM and Promotion Compliance | Promotion master, required POP checklist, photo validation, compliance scoring. |
| Phase 5: LMS | Training library, assignment, quizzes, completion tracking, retraining triggers. |
| Phase 6: Coaching and Analytics | Consultant coaching module, before/after tracking, store score, management PDF summary. |

# 15. Sample Screens Required

| **Screen** | **Main Requirements** |
| --- | --- |
| Login | Mobile number/email login, role-based routing. |
| Home Dashboard | Different dashboard by role: store, NSO, manager, consultant. |
| Daily KPI Form | Fast numeric entry with auto ABV calculation. |
| Store Checklist Form | Question list with status, remarks and photo upload. |
| NSO Visit Form | Visit observations, training done, photos, actions and next visit. |
| Resolution Tracker | List, filter, create, assign, update and close issues. |
| Promotion Compliance | Active promotions, required POP checklist, upload and validation. |
| LMS Library | Course list, lesson view, quiz, completion status. |
| Coaching Tracker | Gap diagnosis, action plan, review date, outcome. |
| Management Reports | Filters, charts, top/bottom stores, export options. |

# 16. Acceptance Criteria for Developer

A store user can submit daily KPI and checklist from mobile in less than 3 minutes.

An NSO can create a store visit report with photos and action points from mobile.

Any action point can be converted into a resolution item with owner, priority and due date.

Management can see store-wise, NSO-wise and cluster-wise dashboards without asking for Excel separately.

A promotion cannot be marked fully compliant unless required POP/photo proof is uploaded and validated.

LMS can assign training by role and track completion, quiz score and pending training.

Consultant can record coaching actions and compare performance before and after intervention.

Every important change must have audit log: who changed, what changed and when.

Reports must be exportable to Excel and PDF.

The system must support future expansion to multiple clusters/states without redesign.

# 17. Appendix A: Sample Daily Store KPI Form

| **Field** | **Type** |
| --- | --- |
| Store | Dropdown |
| Date | Auto |
| UDC | Auto |
| NSO | Auto |
| NOB | Numeric |
| Walk-ins | Numeric |
| Sales | Numeric |
| ABV | Auto calculated |
| Promotion Sales | Numeric / optional |
| Top Category | Dropdown |
| Slow Category | Dropdown |
| Stockout Items | Multi-entry |
| Support Needed | Text |
| Photo | Optional upload |
| Submit | Button |

# 18. Appendix B: Sample NSO Visit Checklist

| **Checklist Item** | **Input Required** |
| --- | --- |
| Dealer met? | Yes/No + remarks |
| UDC/store staff trained? | Yes/No + topic + participants |
| Store cleanliness checked? | Score + photo optional |
| Stock availability checked? | Remarks + issue creation if needed |
| Expiry/FIFO checked? | Yes/No + remarks |
| POP and VM checked? | Mandatory photo for active promotion |
| Counter display checked? | Yes/No + photo |
| Promotion understood by staff? | Yes/No + coaching note |
| Customer conversion opportunity observed? | Remarks |
| Action points created? | Auto linked to resolution tracker |
| Next review date | Date |

# 19. Final Note for Developer

**This product should not be treated as only a form-filling application. **It is a communication and performance coaching system. The user experience must be simple enough for store teams, strict enough for NSOs, useful enough for management, and analytical enough for consultants. The first build should remain simple, but the data structure should be strong enough to support future dashboards, benchmarking, coaching analytics and multi-cluster rollout.

| **Final guiding thought** More store visits alone will not solve the problem. A structured system is required so that every store visit, every issue, every promotion, every daily number and every training gap is captured, reviewed, coached and closed. |
| --- |

Confidential - Draft for discussion | Prepared for V Mentor / MPCG Store Performance Automation