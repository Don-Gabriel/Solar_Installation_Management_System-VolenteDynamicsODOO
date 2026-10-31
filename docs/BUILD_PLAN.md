# Build plan

Revision 7 · 31 October 2026 · Solo developer · User extended the deadline; finish as soon as possible.

## Current implementation status

The operational revision adds the service coordinator role, 15-person dispatch roster, installation and visit crews, working-day/skill/leave checks, a shared calendar, conflict-safe booking and rescheduling, component diagnosis, separate parts/labour coverage, approval, repair photos, returns quarantine and itemized service documents. Staff access can be edited with audit history; individual installation crew time and payouts are recorded separately. Follow-up faults link back to the original request.

The existing responsive React/TypeScript/Vite, Fastify and local PostgreSQL stack remains in use. There is no customer login. Support can record calls and new installation enquiries. The optional anonymous enquiry form remains. React Native Android and Windows builds are still a separate, unimplemented delivery track.

Preserved demo data contains 40 customer projects, 34 staff accounts across eight roles and 198 serialized devices. Fifteen technicians are eligible for new dispatch; four historical technician identities retain their existing work. This is distinct from the standalone 27-person F15 planning fixture.

Release gates: focused retest of all six initial failures; backend and browser regressions; scenario-specific execution register for all 200 entries; backup/restore and measured load checks; usable local app and updated instructions. PASS, FAIL and BLOCKED remain distinct. A blocked scenario is not a pass or a completed feature. See [scenarios/EXECUTION.md](scenarios/EXECUTION.md) for the current exact result.

The original milestone schedule below is historical. The user explicitly extended the later 14:45 target. Refunds/credit notes, change orders, supplier claims, physical-device checks and native installers must not be claimed from a web/API test pass.

Canonical repository: [Solar_Installation_Management_System-VolenteDynamicsODOO](https://github.com/Don-Gabriel/Solar_Installation_Management_System-VolenteDynamicsODOO).

## Outcome

Deliver a usable desktop/mobile application that takes a customer from enquiry through service and proves where each serialized device went and whether each installation made money. The complete workflow, persisted data, clear database design and understandable implementation take priority.

The supplied problem statement covers about 40 projects per month, a crew of 15 technicians, 1–5 kW On-Grid and Off-Grid packages, installation service and long-term support. The supplied organizer transcript emphasizes local relational databases, backend APIs, real data, validation, modularity, security and usability. These are source requirements; added policies below are marked as proposed choices.

## What changed in revision 2

- Use the owner's GitHub repository; it was empty at inspection.
- Select React/Vite + Fastify + PostgreSQL, as specified in [TECH_STACK.md](TECH_STACK.md).
- Make desktop and mobile acceptance criteria part of every milestone, starting with enquiry and technician forms.
- Target a lightweight PWA shell; full native apps, offline transaction synchronization and push notifications are out of scope.
- Use installed, pinned skills for schema/API/auth/UI/test work, with one documented workflow shared by Codex and Claude.
- Preserve the final three hours before the deadline for regression, rehearsal and submission.

## Planned source structure

```text
apps/
  web/src/
    app/                 routing, session, layout
    components/          reusable UI and field controls
    features/            crm, sales, inventory, jobs, service, finance
  api/src/
    plugins/             database, session, permissions, files
    modules/             crm, catalogue, sales, inventory, field, service, finance
    app.ts               server factory for runtime and tests
packages/
  contracts/             shared TypeBox request/response schemas and types
db/
  migrations/            ordered SQL plus migration ledger
  seeds/                 explicit synthetic demo fixtures
tests/
  integration/           real PostgreSQL invariants
  e2e/                   desktop/mobile browser journeys
docs/
compose.yaml
.env.example
package.json
package-lock.json
```

This layout is implemented. SQL and business operations are grouped in domain modules for this bounded release; routes handle contracts, permissions and transactions. Database code is not shared with the client.

## Implementation milestones

Targets below are planning checkpoints, not completed work or guaranteed effort estimates. All times are IST.

| Target | Deliverable | Completion gate |
| --- | --- | --- |
| 31 Oct 12:00 | Workspace, database/migrations, login/roles, seed catalogue, responsive layout, API contract | Clean startup; valid/invalid API request; data persists after restart; enquiry screen usable at 390px and desktop |
| 15:00 | Enquiry, qualification, survey approval, template quotation, accepted order and advance record | One customer completes the flow; direct API attempt to quote before approval fails |
| 18:00 | Receipt/cost capture, reservations, packing, barcode input, dispatch, delivery and warranties | Wrong/duplicate serial blocked; concurrent allocation test passes; warranty begins on delivery exactly once |
| 21:00 | Technician assignments, times/checklist, photos/signature, support ticket, warranty billing | Phone-width completion works; evidence survives refresh; covered/expired repair outcomes are correct |
| 23:00 | Invoices/payment allocation, subsidy checklist, technician payable summary, director report | Database-derived totals reconcile; reports/prints expose source records and distinguish cash from margin |
| 1 Nov 02:00 | UI refinement, PWA shell if feasible, cross-browser integration | Keyboard, responsive layouts, errors and retry states work; no core workflow is a static mock |
| 06:00 | Feature freeze, recovery buffer, setup docs, schema explanation and demo fixtures | A clean start reproduces the demo; known limitations are written; optional features stop |
| 06:00–08:00 | Full regression, restart check, rehearsal/recording, deliverable packaging | All critical gates pass or failures are explicitly resolved/declared |
| 08:00–08:30 | Submit through the event's actual required channel | Verify receipt and links; keep contingency before 09:00 |

If a checkpoint slips, reduce optional presentation features immediately. Never compensate by removing server validation, permissions, stock integrity, delivery-triggered warranties or the regression window. Recalculate remaining work against the fixed deadline rather than pretending missed checkpoints are still future targets.

## Functional slices

### 1. CRM and survey

- Public enquiry form: name, phone, address/site, requested capacity/type, subsidy interest and notes.
- Staff manual entry for phone/WhatsApp enquiries, source and follow-up owner. External messaging integration is not required.
- Qualification: usable roof area, electricity bill and grid suitability.
- Survey: direction, tilt, cable distance, notes, technician and approval decision.
- Show incomplete/blocked reasons and preserve entered values after errors.
- Gate quote issuance on an approved survey in the API; resurvey/rejection history is retained.

### 2. Catalogue, quotation and order

- Products distinguish quantity-tracked consumables, serialized hardware and services.
- Versioned package recipes cover Panel Set, On-Grid/Off-Grid capacities 1–5 kW and installation.
- Generate quote lines automatically, including stands, wiring/switches and safety parts. Display any manual adjustments.
- Freeze accepted prices, quantities and terms; catalogue edits do not rewrite historic orders.
- Record payment amount, method, reference and allocation; no payment gateway is required.
- Confirming an order creates packing work and an unassigned installation job visible to the appropriate staff.
- Proposed policy: configurable minimum advance before work, with an explicit authorized override if needed. The narrative does not define a universal amount.

### 3. Stock, serials, delivery and warranty

- Receive purchases with quantities, serials where required and acquisition cost.
- Reserve stock; show shortages and replenishment needs without allowing negative availability.
- Scan inverters, batteries and charge controllers before dispatch. Model panel coverage consistently with the brief's asset/warranty requirements.
- Validate scanned product, location and availability; preserve movement and customer linkage.
- Use transactions and uniqueness/conditional updates to prevent double allocation and duplicate dispatch.
- Delivery, not dispatch or installation, starts each asset's warranty from a product-policy snapshot.
- Repeated delivery requests must not reset dates or create duplicate warranties.
- Proposed demo policies: 24 months for inverter/battery, 240 months for panels; controller terms and replacement coverage remain configurable and visibly documented.

### 4. Field installation

- Assign technicians/time windows; show unassigned work and scheduling conflicts.
- Technician mobile view prioritizes today's assigned jobs and one primary action per screen.
- Record start/finish, capacity, checklist and generation test result.
- Upload real test photos; capture a touch/mouse signature with signer name and acceptance time.
- Persist evidence privately and enforce download access. Failed uploads leave the job recoverable.
- Completion requires the defined evidence; a local preview is not proof of a saved file.
- Camera permissions/HTTPS and an actual-phone test are early technical checks, not last-minute polish.

### 5. Service

- Lookup by customer/contact or exact serial; open the asset passport.
- Record fault code, complaint, assignee and progress events.
- Evaluate coverage against stored delivery/policy and the relevant service event date; retain decision and reason.
- Covered repair/replacement: customer charge zero, internal parts/labour cost retained.
- Expired coverage: create an itemized parts/labour charge and invoice through the finance model.
- Replacement links old/new serials without erasing the original history.
- Separate technician resolution from customer confirmation; the ticket remains tracked until confirmation.

### 6. Director, finance and paperwork

- Views for today/week/month, incomplete projects, open repairs, collections and job contribution.
- Separate quoted value, invoiced value, payments, outstanding balance and direct costs.
- Consume material at a documented acquisition-cost allocation and retain the snapshot; do not expense every warehouse purchase against one job.
- Record technician time with the rate applicable to that work and paid/unpaid pay entries. Full statutory payroll is not included.
- Subsidy case: document checklist, reference, owner, status and next action. Do not invent government eligibility or tax rules.
- Printable invoice/report and safe CSV export with source drilldowns.

## Data model and business invariants

| Area | Entity groups | Invariant |
| --- | --- | --- |
| Access/CRM | users, roles, sessions; customers, sites, enquiries, qualifications, surveys | One customer may own multiple sites. Role/record checks run on the server. |
| Sales | products, package versions/BOM lines, quote versions/lines, orders/lines | Historic accepted terms are immutable snapshots. |
| Inventory | receipts/lines, stock movements, reservations, assets, dispatches/lines, deliveries | A physical serial cannot be allocated twice; quantity and serial counts reconcile. |
| Field | jobs, assignments, time logs, checklist results, file metadata, acceptance | Finish follows start; completion references saved evidence. |
| Service | warranty snapshots, tickets/events, repairs/parts/labour, replacement links | Coverage is reproducible and billable amounts are traceable. |
| Finance | invoices/lines, payments/allocations, credit adjustments, job costs, technician pay, subsidy cases/docs | Cash, revenue basis, tax and costs are distinct; no duplicate allocation. |
| Audit | action events and idempotency records | Critical retries do not duplicate business effects. |

Use foreign keys, NOT NULL/CHECK constraints and appropriate unique keys. Decide manufacturer/serial uniqueness explicitly and use an immutable internal asset ID. Use NUMERIC or integer minor units with an explicit rounding rule for money, and timezone-aware event timestamps. UI uses Indian number formatting and clear local dates.

Transactions must keep one acquired database client throughout BEGIN/COMMIT/ROLLBACK. Use row locks or atomic conditional changes for contested assets. A failure midway through confirmation or delivery rolls back all related business changes.

For the demo, label job contribution using a documented net-revenue basis minus consumed materials, technician labour and allocated direct expenses. Show estimated margin/work in progress separately; do not call an advance payment profit.

## UX and responsive acceptance

- Desktop gets a compact sidebar, searchable worktables and contextual details.
- Mobile gets readable cards/essential columns, single-column forms, a short navigation path and touch-sized actions.
- One coherent token system: light surfaces, deep blue text/navigation, amber attention, distinct success/error semantics. Confirm contrast rather than relying on color names.
- Test at 360/390/430px phones, 768px tablet and 1280/1440px desktop; no document-level horizontal overflow.
- Forms have labels, inline errors, pending states and recoverable retries. Show why a gated action is unavailable.
- Support keyboard-only use, visible focus, 200% zoom and reduced motion.
- Signature/file/photo flows must work with touch and mouse. Streaming camera use requires HTTPS; provide file-picker/manual fallback.
- Do not cache authenticated API data or private evidence in the PWA service worker. Full offline synchronization is outside the first-release scope.

## Critical test gates

1. Valid records persist after page reload and app/database restart; invalid input returns useful field errors.
2. Direct API quote issuance before survey approval is rejected.
3. Package updates do not rewrite an accepted quote/order.
4. Repeated confirmation/payment requests do not duplicate jobs, reservations or financial entries.
5. Two concurrent requests cannot allocate one inverter to different orders.
6. Wrong, unknown, duplicate or previously shipped serial scans fail clearly.
7. Dispatch creates no running warranty; delivery creates coverage once; expiry boundary tests pass.
8. Missing/failed uploads cannot produce a falsely completed job; private evidence requires authorization.
9. Technician and warehouse accounts cannot perform owner-only approvals or access unrelated financial records.
10. Covered repair has zero customer charge with internal cost recorded; expired repair produces correct itemization.
11. Ticket closure requires customer confirmation according to the documented workflow.
12. Invoice/payment/balance/contribution totals reconcile against a hand-calculated fixture.
13. The complete journey works at desktop and phone widths, with browser-console failures checked.
14. Camera/signature/file-picker behavior is checked on a real phone if available; emulation-only coverage is labelled honestly.

These gates are proposed, not passed. Application implementation and tests follow this planning commit.

## Demonstration

Seed explicitly synthetic data into PostgreSQL: 15 technician profiles, package variants, high-value serials, a stock shortage, unfinished surveys, a profitable job, a loss-making job, an 18-month-old covered asset and an expired asset.

Create a new enquiry live. Demonstrate a blocked quotation, then approval, itemized quote, advance, packing, duplicate-scan rejection, delivery warranty, mobile installation proof and director drilldown. Use the clearly labelled historic service fixtures to demonstrate time-dependent warranty outcomes; do not change the machine clock or pretend a fresh installation is 18 months old.

Prepare a short schema diagram and explain transactions, snapshots, access checks, delivery-based coverage and cash versus contribution. Keep authentic solo Git history and be able to explain the generated code.

## Scope cuts and unresolved rules

Cut first: AI chat, 3D roof modelling, marketing pages, live WhatsApp/email integrations, payment gateways, government APIs, advanced calendar dragging, complex charts and automated offline sync.

Do not cut: any required lifecycle stage, validation, database persistence, serial integrity, mobile completion, warranty timing or verification time.

Current event URL/rules, AI-use restrictions, submission format and repository visibility requirements were not supplied. Confirm those against the event's actual instructions before submission. The product needs configurable warranty/tax/subsidy/advance policies because the narrative does not establish their full real-world rules. Record demo assumptions visibly rather than presenting them as legal or engineering facts.
