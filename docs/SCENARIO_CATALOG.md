# SunPower real world scenarios and acceptance plan

Prepared 31 October 2026 for the user's revised working deadline of **1 November 2026 at 07:00 IST**. There is no confirmed official event deadline. The aim is a working, demonstrable operational system, not a large checklist with invented passes.

## Purpose and scope

This document defines 200 distinct scenarios across 20 areas. Each has a stable ID, starting conditions, an action, an observable expected result, priority and a source-based assessment of the existing build. The catalogue is a bounded first acceptance specification, not every possible event in the real world. New defects, policy changes and reviewer questions should add cases rather than silently change expected results to make tests pass.

The source baseline is repository commit `d0d1038`. The original problem statement describes approximately 40 installations per month, 15 technicians, calls and web enquiries, component traceability, delivery-based warranties, onsite evidence, service until customer confirmation, and separate financial views. The user's review adds support-led intake, capacity-aware repair scheduling, crews, technician diagnosis, repair photos and mixed-coverage service bills. These new requirements supersede the earlier limited release scope.

The company still needs **customer and site records**, even without customer accounts. Support can take calls and enter requests. Customer logins are not required. The original brief explicitly includes a web enquiry form, so phone-led intake should not silently erase that requirement: retain optional anonymous web intake unless the owner chooses to disable it. Do not confuse a customer record, an enquiry form and a customer portal.

## Reading the assessments

- **Present in source** means matching code was found. It is not a new test pass.
- **Partial** means related behavior exists but the complete scenario is not supported or not proved.
- **Missing workflow** means the reviewed build lacks the required model, action or screen. Mark execution blocked until implementation; never count it as passed.
- **Needs verification** means a focused runtime, device, concurrency or recovery test is still required.
- **Policy decision** means the expected behavior depends on a recorded business choice. This is not permission to invent real warranty or tax rules.
- **P0** means a core workflow, money, evidence, access or integrity risk. **P1** means an important operational exception. **P2** means a lower-priority expansion. P0 does not mean the work is already implemented.

Every execution result must separately be PASS, FAIL, BLOCKED or NOT RUN. Keep observed behavior, date, commit, environment, test evidence and defect link. A broad test-suite pass cannot automatically pass every scenario in the same category. A source review is not an execution. Retesting must use the same required result unless the owner explicitly changes the requirement.

## What the current application actually supports

The current build has seven staff roles, 32 seeded staff accounts and 19 installer accounts. Each installation has a single assigned technician. That is different from having only one installer account. There are no crew membership records, shared installation-and-repair visit calendar, leave calendar, skill-based availability search or repair-specific evidence records.

Installation assignment rejects overlapping installation jobs. It does not yet solve the user's days 3 to 5 repair availability search. Repair tickets currently require one warranty record before diagnosis, have one covered flag, and can be resolved by administrator/support. Assigned repair technicians cannot currently use a complete repair-work flow. Project access for technicians follows the installation assignment, not a later repair assignment.

Covered repairs currently have zero customer charge but no zero-value invoice is created. Chargeable repairs create generic parts and labour lines. Replacement cost is derived from acquisition cost. These facts do not satisfy itemized mixed coverage, approved selling prices, technician diagnosis or after-repair photographs. The existing initial installation invoice must remain separate and immutable when service billing is added.

## Roles and realistic staffing

Recommended target: **eight permission roles and 27 distinct demo employees**, including exactly **15 field technicians**. These are proposed fixture sizes for a 40-installations-per-month company, not a proven optimal hiring plan. Actual staffing depends on geography, average job duration and repair volume. Do not expand every role to 50 people.

| Permission role | People | Why this size | Main powers | Boundary |
| --- | ---: | --- | --- | --- |
| Administrator and owner | 1 | One accountable owner in this demo | Staff access, policy approval, business oversight and reviewed exceptions | Sensitive overrides require reasons and audit history |
| Sales | 2 | Parallel quotes and customer follow-up | Quotes, acceptance, approved commercial follow-up | Cannot approve technical diagnosis or stock returns |
| Site surveyor | 2 | Concurrent surveys while others are installing | Site measurements, suitability checks and survey decisions | No service billing or staff payout authority |
| Customer support | 2 | Two simultaneous calls and absence cover | Find customers, new installation requests, repair intake, contact history and confirmation | Cannot silently change coverage, stock or approved prices |
| Service coordinator | 2 | One primary dispatcher and one supervisor or backup | Shared visit calendar, availability, skills, crews, reassignment, overdue work and repair review | No staff payout or unrestricted invoice override |
| Stock and delivery team | 2 | One warehouse operator and one stock or delivery backup | Receipts, reservations, serial issue, delivery and quarantine receipt | Cannot approve their own supplier payment |
| Field technician | 15 | Matches the problem statement and reviewer example | Assigned visits, diagnosis, component selection, evidence and actual work time | Cannot access unrelated customers or approve their own charge exceptions |
| Accounts | 1 | Modest initial invoice volume with owner backup | Payment verification, approved service bills, credits and cost reporting | Cannot mark physical work complete or fabricate evidence |

The **new missing permission role is Service coordinator**. Dispatching and service supervision are responsibilities inside this role; they do not need two separate permission roles yet. Lead installer, assistant, driver and purchasing clerk are job responsibilities or qualifications, not automatically separate login roles. Record each person's identity; never share a team password.

The target has one owner and one accountant, with explicit backup arrangements rather than duplicate daily roles. Sales, surveys, support, coordination and stock are each two-person teams. Technicians are the large team. A possible skills fixture is four lead-capable technicians, nine qualified general technicians and two supervised assistants. Skills and crew membership must constrain assignments; a free assistant cannot become an independent electrical lead simply because the calendar is empty. Qualifications here are synthetic test attributes, not real-world certifications.

One employee may cover several duties in a small business, but the current database has one role per user. Define the combined capabilities and conflicts before adding multi-role support. A coordinator may also handle calls through explicitly granted intake permission. Financial override, payment approval and technical completion should remain independently attributable. A reporting-only owner delegate may be added later if actually needed; no separate customer, supplier, HR or driver login is required for this demo.

Do not delete the existing 32 demo users to reach 27. Add a separate F15 acceptance fixture, retaining historical references. After implementation, select the coherent 27-person fixture for demonstrations; archiving old accounts requires a reviewed migration and reassignment of future work.

## Appointment and work model

Use distinct records for customer, site, installation project, service ticket, visit, visit crew, diagnosis line, parts issue or return, service estimate, service statement or invoice, evidence and payment. A service ticket is the customer's problem. A visit is one appointment; a ticket can need diagnosis, repair and follow-up visits. A crew can contain multiple named workers. A worker can have many non-overlapping visits.

Proposed repair progression: New request > Triaged > Appointment proposed > Confirmed > In progress > Diagnosed > Awaiting approval or parts when needed > Repair completed > Awaiting customer confirmation > Closed. Cancelled, no access, disputed and reopened are explicit outcomes with history. Do not require every ticket to traverse a parts or paid-estimate state if no such work is needed.

Assignment filtering should check active account, qualification, working hours, leave, time overlap, travel buffer, crew requirements, customer availability and parts readiness. Use a common schedule for survey, installation and service so a repair does not overlap an installation. Rank eligible candidates by requested window, urgency, suitable skills, travel and balanced workload, then apply a stable tie-break. Show the reasons. Confirmation must recheck constraints inside a transaction; search results are not reservations.

## Worked example F15

Freeze test time at **2 November 2026, 09:00 IST**. This is a synthetic business date, not the project deadline. For the default fixture, routine search means calendar days 3 through 5, office hours 09:00 to 17:00, with a configurable 30-minute travel buffer. Holiday and working-day alternatives have separate cases. The three-to-five-day window is a proposed company target from the user, not a guaranteed industry standard. Urgent hazards require escalation rather than this routine queue.

At the chosen two-hour interval on days 3 through 5, technicians T01 through T13 are occupied, while qualified technicians T14 and T15 are free. Searching should return eligible times for T14 and T15 only. Occupied means their intervals overlap, not merely that they have one task somewhere on the same date. If T14 is on leave or lacks the required skill, only T15 remains. If both are ineligible, show no suitable slot, the next available time and an escalation task.

Now two coordinators select T14 for two requests in the same interval. Exactly one confirmation may succeed. The loser must receive a conflict and refreshed alternatives, potentially T15. If the job requires two people, both T14 and T15 must be reserved together or neither is reserved. Inject a failure after reserving one worker to prove rollback. Run this both for two repairs and for a repair competing with an installation.

## Warranty rules and the mixed bill

Warranty belongs to the installed component or quantity-tracked order line, not to the customer globally. Copy installed equipment and historical policy terms into the repair context. The technician identifies faults; the server calculates preliminary coverage and an authorized reviewer handles exclusions or exceptions. The initial invoice type alone cannot decide coverage. Evaluate complaint time, original delivery, expiry, component identity, policy scope, cause and approved exceptions.

Retain the existing demo rule that ordinary covered faults cost the customer nothing, including their covered repair labour. Record actual internal parts and labour cost even when the customer pays zero. Manufacturer reimbursement is a separate receivable, not a reason to rewrite the customer's entitlement. Default replacement coverage inherits original dates; any different manufacturer policy must be recorded and tested explicitly.

For mixed repair **MIX1**, use the following proposed, explicitly approved line allocation. The chargeable connector work is outside cover, and its labour and travel are specifically accepted by the customer. Do not charge the covered inverter's labour under an unrelated line.

| Work line | Quantity | Agreed value | Warranty credit | Customer pays |
| --- | ---: | ---: | ---: | ---: |
| Replacement inverter with old and new serials | 1 | INR 18000 | INR 18000 | INR 0 |
| Uncovered connectors | 2 | INR 900 total | INR 0 | INR 900 |
| Labour for uncovered connector work | 1 | INR 600 | INR 0 | INR 600 |
| Approved callout allocation for uncovered work | 1 | INR 200 | INR 0 | INR 200 |
| Total | | INR 19700 | INR 18000 | INR 1700 |

The covered inverter must still appear on the document. Its selling value and warranty credit explain zero payable. Save original and replacement identities, coverage reason, estimate approval and internal cost separately. If travel policy is not agreed, hold that line for review rather than auto-charge it. This example is a product acceptance rule, not tax advice or a claim of legally compliant invoice treatment. Tax configuration remains a separately blocked release item.

If every line is covered, issue a zero-payable service statement or the configured zero-value invoice document; never pretend that no work occurred. If some lines are charged, issue one linked service document showing all work and the exact payable total. Do not modify the original installation invoice. Repeated resolution must not issue stock or bill twice. Printed invoices and signatures must reference a frozen version; corrections need a linked correction or credit workflow.

## Mobile and Windows decision

React Native is a feasible mobile client direction, and React Native Windows is Microsoft's Windows implementation. They can share TypeScript business contracts and API access, but the existing DOM-based React and Base UI screens are not drop-in native screens. Camera, barcode scanning, signatures, secure session storage, printing, background behavior and installation packages require platform-specific checks. An Android build is not proof of iPhone or Windows behavior.

Keep Fastify and PostgreSQL as the shared authoritative backend. Build a small native proof first: sign in, assigned visits, installed-component list, photo upload and completion, plus a Windows staff view. Pin a compatible React Native and React Native Windows version pair after checking their current compatibility. Do not upgrade the web app blindly to match a native runtime. Local iOS development requires its Apple toolchain; device testing and distribution are separate release gates. No native binary exists in the reviewed build.

Recommended order under the 07:00 target: implement and test the shared scheduling, repair and billing rules first; prove the native path with a narrow client; then package only platforms whose build and device gates actually pass. Keep the browser client available for rehearsal. Installing a web app is not the same as shipping a React Native app.

## Test data and evidence

- F15: the 27-person fixture above with exactly 15 active field technicians, skills, leave, working hours, travel buffers, 13 occupied and two qualified free during the target intervals.
- MIX1: one covered inverter, two uncovered connectors, approved uncovered labour and travel; customer payable INR 1700 and independently recorded internal costs.
- COV1: active, expired, exact-expiry, pre-delivery, unknown-policy, excluded-cause, goodwill and replacement-inheritance cases with a frozen clock.
- CREW1: lead and assistant, two independent leads, missing qualification, one crew member absent, different time entries and supervisor sign-off.
- CALL1: two support employees, 20 simultaneous callers, repeated callers, shared phone numbers, two sites per customer and duplicate symptoms.
- STOCK1: available, reserved, dispatched, delivered, replaced and proposed quarantined devices; only one final compatible unit for race tests.
- LOAD1: 1000 projects and 200 open service requests in an isolated schema. Proposed local acceptance targets are p95 under 2 seconds for search and under 3 seconds for availability with 10 concurrent office users. Record machine and dataset; these are targets, not measured results.
- DEVICE1: supported desktop browsers, Android physical device, Windows native install and iOS only if built. Test camera denial, file selection, keyboard, scanner, printing and session expiry on actual target hardware.

Run each automated case in a resettable isolated database schema with synthetic files and a controlled clock. Never replay destructive scenarios against the user's active demo. Test at the API and database layer for permissions, money, ownership, rollback and concurrency; use browser or native tests for interaction, displayed values and evidence capture. Backup and device scenarios need their own environment and evidence. Keep test screenshots, logs and outputs private locally unless explicitly part of the repository's safe fixture material.

## Implementation sequence and release gate

1. Establish support intake permissions, distinct service requests and the eight-role target. Keep customer identity and site history coherent.
2. Add shared visits, crew membership, skills, working calendars, leave and atomic availability confirmation. Demonstrate F15 and competing requests.
3. Add assigned-repair access, installed-component selection, diagnosis, before/after photos, return visits and return custody.
4. Add line-specific coverage, approved estimates, separate selling prices and internal costs, zero-payable lines, immutable service documents and retry-safe billing.
5. Add realistic fixture people and competing workloads; then the narrow native client proof, only after shared API behavior is stable.
6. Execute the entire catalogue, resolve defects, rerun failures and affected regressions, then rehearse the review examples with actual saved data.

Aim to freeze new scope by 05:00 IST and reserve 05:00 to 07:00 for regression, artifact generation and rehearsal. This is a planning target, not a promise that 200 scenarios or every native platform can be completed in that time. If the deadline becomes incompatible with required work, report the exact unfinished cases rather than hiding them or marking them passed.

A release may be called verified for this catalogue only when every required case has a recorded executed result, no unresolved required failures, and no required blocked cases. Any deferred P1/P2 scenario must be listed and accepted as a limitation; it must not be relabelled PASS. Security, monetary and stock integrity failures prevent a clean-release claim. Physical-device and restore gates cannot be replaced by source inspection. An explicit owner-approved scope change is required to remove a requirement.

## Source map and references

The original user-supplied Solar Installation Management System PDF was read on 31 October 2026. It is kept outside Git. The user's review messages and staffing clarification are primary requirements; the calendar window and target staffing numbers are labelled proposals.

Repository evidence: `apps/api/src/routes.ts` for role boundaries; `modules/field.ts` for single-worker scheduling and installation checks; `modules/service.ts` for one-warranty repair and billing; `modules/queries.ts` for technician project access and financial views; `plugins/files.ts` for installation evidence; `packages/contracts/src/index.ts` for accepted payloads; `db/migrations/001_core.sql` for current entities; `tests/integration/lifecycle.test.ts` and `tests/e2e` for existing checks.

- React Native platform-specific code: https://reactnative.dev/docs/platform-specific-code
- React Native environment setup: https://reactnative.dev/docs/set-up-your-environment
- Microsoft React Native Windows setup: https://microsoft.github.io/react-native-windows/docs/getting-started/
- Odoo field-service reference: https://www.odoo.com/documentation/20.0/applications/services/field_service/product_management.html

The Odoo reference supports separating field work, materials, customer reports and billing. Its documented whole-shift warranty behavior is not evidence that our component-by-component requirement is already implemented. The proposed design is our inference from the user's requirements and reviewed source. No dependency on Odoo hosting is introduced.


## Catalogue status summary

Source review is separate from execution. Counts below are generated from the 200 named cases.

- Missing workflow: 103
- Partial: 28
- Needs verification: 24
- Present in source: 43
- Policy decision: 2

Execution: FAIL: 6, NOT RUN: 189, PASS: 5.


## INT Calls and installation requests

### INT-01 Support records a new installation call
P0 | Source: Missing workflow | Execution: FAIL

**Given:** A new caller has a site and preferred visit date

**When:** Support records the enquiry

**Expected:** One numbered request records the caller, site, phone source and support actor

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Support installation intake returned HTTP 403; required success with an audited support actor.

### INT-02 Caller does not know system size
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Caller wants advice but cannot choose capacity

**When:** Support saves a request awaiting survey

**Expected:** Unknown capacity is explicit and no package is silently promised

**Evidence:** No scenario-specific execution recorded.

### INT-03 Repeated call for the same request
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** An open installation request exists

**When:** Support searches phone and updates the contact log

**Expected:** The existing request is offered and a second project is not silently created

**Evidence:** No scenario-specific execution recorded.

### INT-04 Two unrelated requests from one household
P1 | Source: Partial | Execution: NOT RUN

**Given:** A caller wants installation at two addresses

**When:** Support creates two site requests

**Expected:** Separate sites and appointment histories stay linked to the right customer

**Evidence:** No scenario-specific execution recorded.

### INT-05 Customer wants a specific appointment
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Customer can attend only Friday afternoon

**When:** Support records the preference

**Expected:** Preference is stored separately from a confirmed appointment

**Evidence:** No scenario-specific execution recorded.

### INT-06 Caller reports an electrical hazard
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Caller reports smoke or exposed live wiring

**When:** Support marks the request urgent and escalates

**Expected:** An urgent queue and human escalation appear without applying the routine 3 to 5 day promise

**Evidence:** No scenario-specific execution recorded.

### INT-07 Wrong phone number entered
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** Support enters a malformed phone number

**When:** Save is attempted

**Expected:** Validation explains the error and no incomplete customer is committed

**Evidence:** No scenario-specific execution recorded.

### INT-08 Customer changes their mind before survey
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** An enquiry has no accepted order

**When:** Support cancels with a reason

**Expected:** Request history is retained and any future appointment is released

**Evidence:** No scenario-specific execution recorded.

### INT-09 Call interrupted during entry
P1 | Source: Partial | Execution: NOT RUN

**Given:** Support has entered customer details

**When:** The app loses connection before save

**Expected:** Unsaved information remains recoverable and no success message is shown

**Evidence:** No scenario-specific execution recorded.

### INT-10 Public intake disabled for staff operation
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** The business chooses phone-led intake only

**When:** An anonymous visitor opens the enquiry URL

**Expected:** Public creation is disabled by an explicit setting while staff intake remains available

**Evidence:** No scenario-specific execution recorded.


## CRM Customers sites and contact history

### CRM-01 Search a returning customer by phone
P0 | Source: Partial | Execution: NOT RUN

**Given:** A customer already has installed equipment

**When:** Support searches the full phone number

**Expected:** Matching customers and sites are shown without exposing unrelated private evidence

**Evidence:** No scenario-specific execution recorded.

### CRM-02 Shared family phone number
P1 | Source: Partial | Execution: NOT RUN

**Given:** Two distinct customers use the same phone

**When:** Support searches and chooses the correct person

**Expected:** Records remain distinguishable by name and site rather than forcibly merging

**Evidence:** No scenario-specific execution recorded.

### CRM-03 Multiple systems at one address
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** One site has an older and newer installation

**When:** Support opens a repair request

**Expected:** The affected installation must be selected and both histories remain visible

**Evidence:** No scenario-specific execution recorded.

### CRM-04 Correct a customer spelling
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** An installed project exists with a name typo

**When:** Authorized staff corrects the name

**Expected:** Current contact data changes with an audit record while issued document snapshots stay unchanged

**Evidence:** No scenario-specific execution recorded.

### CRM-05 Change customer contact number
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A customer reports a replacement phone number

**When:** Support verifies and updates the number

**Expected:** The old value remains in restricted history and future contact uses the new number

**Evidence:** No scenario-specific execution recorded.

### CRM-06 Record access instructions
P1 | Source: Partial | Execution: NOT RUN

**Given:** A roof is accessible only through a locked gate

**When:** Support adds access notes

**Expected:** Assigned workers see the notes before departure

**Evidence:** No scenario-specific execution recorded.

### CRM-07 Customer address differs from billing address
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A company pays for a remote installation

**When:** Staff records the two addresses

**Expected:** Work goes to the service address and the invoice uses the agreed billing address

**Evidence:** No scenario-specific execution recorded.

### CRM-08 Duplicate records discovered
P2 | Source: Missing workflow | Execution: NOT RUN

**Given:** Two records represent the same person and site

**When:** An administrator reviews a merge

**Expected:** No invoices, warranties or evidence are lost and identifiers remain traceable

**Evidence:** No scenario-specific execution recorded.

### CRM-09 Wrong customer selected for a complaint
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Support has selected a different household

**When:** Support changes the selection before submission

**Expected:** Selected devices and proposed visit reset to the correct customer

**Evidence:** No scenario-specific execution recorded.

### CRM-10 Customer calls while another employee edits
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Two support employees open the same contact record

**When:** Both submit conflicting changes

**Expected:** The later save detects a conflict rather than silently losing the earlier change

**Evidence:** No scenario-specific execution recorded.


## SUR Survey and suitability

### SUR-01 Quote without a survey
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A new enquiry has no approved survey

**When:** Sales issues a quote

**Expected:** The server refuses and explains that survey approval is required

**Evidence:** No scenario-specific execution recorded.

### SUR-02 Insufficient roof area
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A 3 kW request has less than the configured roof requirement

**When:** Surveyor tries approval

**Expected:** Approval is refused with the actual measured requirement

**Evidence:** No scenario-specific execution recorded.

### SUR-03 Unsuitable on-grid connection
P0 | Source: Present in source | Execution: NOT RUN

**Given:** The grid-suitability check is false

**When:** Surveyor approves an on-grid request

**Expected:** Approval is refused and the survey remains reviewable

**Evidence:** No scenario-specific execution recorded.

### SUR-04 Approve a suitable site
P0 | Source: Present in source | Execution: NOT RUN

**Given:** Measurements satisfy the configured package rules

**When:** Surveyor records and approves the survey

**Expected:** Sales can quote the approved package with the survey reference

**Evidence:** No scenario-specific execution recorded.

### SUR-05 New measurements after quote issuance
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** An unaccepted quote exists and roof measurements change

**When:** Surveyor records a new survey

**Expected:** Old approval cannot authorize a quote based on the new unreviewed measurements

**Evidence:** No scenario-specific execution recorded.

### SUR-06 Negative or impossible readings
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** A measurement is negative or outside configured bounds

**When:** Surveyor saves

**Expected:** The server rejects invalid values without partially storing the survey

**Evidence:** No scenario-specific execution recorded.

### SUR-07 Customer absent for survey
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A survey visit was confirmed

**When:** Surveyor records no access

**Expected:** The visit is not marked completed and a reschedule task is created

**Evidence:** No scenario-specific execution recorded.

### SUR-08 Survey needs two workers
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Access requires an assistant under company policy

**When:** Coordinator schedules the survey

**Expected:** Both people must be available and the visit records the crew

**Evidence:** No scenario-specific execution recorded.

### SUR-09 Rain prevents roof inspection
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A scheduled survey cannot safely proceed

**When:** Coordinator postpones with a reason

**Expected:** The original slot, reason and revised appointment remain in history

**Evidence:** No scenario-specific execution recorded.

### SUR-10 Accepted system requested to change
P0 | Source: Partial | Execution: NOT RUN

**Given:** An accepted order already exists

**When:** Staff tries to replace its survey or capacity

**Expected:** The original commercial record is protected and a change-order path is required

**Evidence:** No scenario-specific execution recorded.


## QUO Quotations acceptance and commercial changes

### QUO-01 Generate a package quote
P0 | Source: Present in source | Execution: NOT RUN

**Given:** An approved survey selects a configured capacity and type

**When:** Sales issues a quote

**Expected:** Quantities, prices, warranty periods and total match the selected package version

**Evidence:** No scenario-specific execution recorded.

### QUO-02 Price changes after acceptance
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A customer has accepted a quote

**When:** The product list price changes

**Expected:** Accepted quote, order and invoice amounts remain unchanged

**Evidence:** No scenario-specific execution recorded.

### QUO-03 Customer accepts twice
P0 | Source: Present in source | Execution: NOT RUN

**Given:** One quote is accepted successfully

**When:** The acceptance is retried

**Expected:** Only one order, installation invoice and job exist

**Evidence:** No scenario-specific execution recorded.

### QUO-04 Two staff accept simultaneously
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** Sales and administrator accept the same quote at once

**When:** Both requests reach the server

**Expected:** One commercial acceptance is committed without duplicate orders

**Evidence:** No scenario-specific execution recorded.

### QUO-05 Customer requests a discount
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** An unaccepted quote exists

**When:** Sales requests a discount beyond their limit

**Expected:** An authorized approver and reason are required; original prices remain traceable

**Evidence:** No scenario-specific execution recorded.

### QUO-06 Customer accepts an older quote
P0 | Source: Partial | Execution: NOT RUN

**Given:** A newer quote version has been issued

**When:** Acceptance references the older version

**Expected:** The selected version is explicit and stale acceptance is rejected or reviewed

**Evidence:** No scenario-specific execution recorded.

### QUO-07 Quote expires before acceptance
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** The quoted validity date has passed

**When:** Sales records acceptance

**Expected:** The quote must be renewed or an authorized exception recorded

**Evidence:** No scenario-specific execution recorded.

### QUO-08 Customer cancels after paying advance
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** An order exists with money received

**When:** Staff initiates cancellation

**Expected:** A cancellation and refund workflow preserves the original invoice and releases eligible reservations

**Evidence:** No scenario-specific execution recorded.

### QUO-09 Customer adds a battery after order acceptance
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** The original package is frozen

**When:** Sales prepares a change order

**Expected:** Only the approved additional work is billed; the original invoice is not overwritten

**Evidence:** No scenario-specific execution recorded.

### QUO-10 Package unavailable for requested system
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** The chosen capacity and type have no active package

**When:** Sales issues a quote

**Expected:** A clear configuration error appears and no empty quote or order is created

**Evidence:** No scenario-specific execution recorded.


## PAY Initial invoices and payments

### PAY-01 Initial installation invoice
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A customer accepts a component-and-installation quote

**When:** The system creates the invoice

**Expected:** Components and installation appear as distinct lines on one initial invoice

**Evidence:** No scenario-specific execution recorded.

### PAY-02 Advance below threshold
P0 | Source: Present in source | Execution: NOT RUN

**Given:** An invoice has less than the configured advance received

**When:** Stock reservation is requested

**Expected:** Reservation is refused and the shortfall is clear

**Evidence:** No scenario-specific execution recorded.

### PAY-03 Advance exactly at threshold
P0 | Source: Present in source | Execution: NOT RUN

**Given:** Payment reaches the exact required advance

**When:** Stock reservation is requested

**Expected:** Reservation is allowed if stock is sufficient

**Evidence:** No scenario-specific execution recorded.

### PAY-04 Payment submitted twice
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A receipt has already been recorded

**When:** The same payment is retried

**Expected:** No duplicate collection is created

**Evidence:** No scenario-specific execution recorded.

### PAY-05 Payment exceeds outstanding amount
P0 | Source: Present in source | Execution: NOT RUN

**Given:** Only INR 1000 is due

**When:** Staff tries to record INR 1001

**Expected:** The payment is rejected and the balance remains unchanged

**Evidence:** No scenario-specific execution recorded.

### PAY-06 Two payments race for final balance
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** Two cashiers submit payments against the same balance

**When:** Requests overlap

**Expected:** The committed sum never exceeds the permitted outstanding amount

**Evidence:** No scenario-specific execution recorded.

### PAY-07 UPI payment not actually settled
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A customer shows an unverified payment screenshot

**When:** Staff records payment status

**Expected:** A pending payment does not count as cleared advance until verified

**Evidence:** No scenario-specific execution recorded.

### PAY-08 Part payment against service bill
P0 | Source: Partial | Execution: NOT RUN

**Given:** An issued service invoice has a balance

**When:** Accounts records part payment

**Expected:** Only that invoice balance falls and installation payment history remains intact

**Evidence:** No scenario-specific execution recorded.

### PAY-09 Incorrect payment needs reversal
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A confirmed receipt was entered by mistake

**When:** Accounts requests reversal

**Expected:** A traceable reversal is created without deleting historical receipts

**Evidence:** No scenario-specific execution recorded.

### PAY-10 Two customers use the same reference text
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** Different invoices have independently valid receipts

**When:** Accounts records both

**Expected:** Uniqueness follows the documented receipt scope and does not merge customers

**Evidence:** No scenario-specific execution recorded.


## STK Stock receipt and reservation

### STK-01 Receive serialized equipment
P0 | Source: Present in source | Execution: NOT RUN

**Given:** Warehouse receives three new inverters with distinct serials

**When:** Staff saves the receipt

**Expected:** Three assets and the correct quantity and value are added atomically

**Evidence:** No scenario-specific execution recorded.

### STK-02 Duplicate serial in a receipt
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A batch contains a serial already in stock

**When:** Staff saves the batch

**Expected:** The whole invalid receipt rolls back without inflating stock

**Evidence:** No scenario-specific execution recorded.

### STK-03 Insufficient stock for full package
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** At least one required product is short

**When:** Warehouse reserves the order

**Expected:** No partial hidden reservation is left and shortages identify product and quantity

**Evidence:** No scenario-specific execution recorded.

### STK-04 Two orders compete for the last device
P0 | Source: Present in source | Execution: NOT RUN

**Given:** One unreserved compatible serial remains

**When:** Both orders allocate it concurrently

**Expected:** At most one order owns the serial and the other receives a clear conflict

**Evidence:** No scenario-specific execution recorded.

### STK-05 Wrong product scanned
P0 | Source: Present in source | Execution: NOT RUN

**Given:** An inverter is required but a battery serial is scanned

**When:** Warehouse adds the serial

**Expected:** The scan is rejected without altering reservations or ownership

**Evidence:** No scenario-specific execution recorded.

### STK-06 Unknown barcode scanned
P0 | Source: Present in source | Execution: NOT RUN

**Given:** The serial has never been received

**When:** Warehouse scans it into packing

**Expected:** The app refuses the unknown identity rather than inventing stock

**Evidence:** No scenario-specific execution recorded.

### STK-07 Duplicate scan on one order
P0 | Source: Present in source | Execution: NOT RUN

**Given:** The device is already allocated to that order

**When:** It is scanned again

**Expected:** Required quantity and stock are not counted twice

**Evidence:** No scenario-specific execution recorded.

### STK-08 Stock found damaged before dispatch
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A reserved device fails inspection

**When:** Warehouse marks it unusable

**Expected:** It is quarantined and a compatible substitute is allocated without double counting

**Evidence:** No scenario-specific execution recorded.

### STK-09 Serial pasted with spaces and case changes
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** A saved serial is pasted with surrounding spaces or lower case

**When:** Warehouse submits the scan

**Expected:** Documented normalization locates the same device without creating a second identity

**Evidence:** No scenario-specific execution recorded.

### STK-10 Stock correction after physical count
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A count differs from recorded quantity

**When:** Warehouse proposes adjustment

**Expected:** An authorized adjustment records reason, quantity and value without editing history

**Evidence:** No scenario-specific execution recorded.


## DLV Packing delivery and warranty start

### DLV-01 Dispatch before every required scan
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A reserved order is missing one serialized device

**When:** Warehouse dispatches

**Expected:** Dispatch is refused with the missing item count

**Evidence:** No scenario-specific execution recorded.

### DLV-02 Dispatch a complete packing list
P0 | Source: Present in source | Execution: NOT RUN

**Given:** All required quantities and scans are present

**When:** Warehouse confirms dispatch

**Expected:** Equipment ownership and dispatch status change once with an audit record

**Evidence:** No scenario-specific execution recorded.

### DLV-03 Dispatch does not start warranty
P0 | Source: Present in source | Execution: NOT RUN

**Given:** An order has left the warehouse but is undelivered

**When:** Support checks warranty dates

**Expected:** No delivery-based warranty has started yet

**Evidence:** No scenario-specific execution recorded.

### DLV-04 Delivery starts each line warranty
P0 | Source: Present in source | Execution: NOT RUN

**Given:** The customer has received all equipment

**When:** Warehouse confirms delivery

**Expected:** Each covered component receives its own policy period from delivery time

**Evidence:** No scenario-specific execution recorded.

### DLV-05 Delivery is retried
P0 | Source: Present in source | Execution: NOT RUN

**Given:** Delivery was recorded successfully

**When:** The same action is repeated

**Expected:** No extra warranty is created and original dates remain unchanged

**Evidence:** No scenario-specific execution recorded.

### DLV-06 Partial delivery
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Only inverter and some panels arrive

**When:** Staff records quantities received

**Expected:** Undelivered lines remain pending and warranty start follows the agreed per-line rule

**Evidence:** No scenario-specific execution recorded.

### DLV-07 Wrong customer receives equipment
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Driver discovers the wrong destination

**When:** Staff records a failed delivery

**Expected:** The intended customer is not marked delivered and custody is traceable

**Evidence:** No scenario-specific execution recorded.

### DLV-08 Transit damage
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A serial is damaged before customer acceptance

**When:** Warehouse records the incident

**Expected:** The damaged device is not commissioned and replacement delivery is tracked

**Evidence:** No scenario-specific execution recorded.

### DLV-09 Customer refuses delivery
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** The customer does not accept the shipment

**When:** Warehouse records refusal

**Expected:** No false handover or warranty start occurs; a return task is opened

**Evidence:** No scenario-specific execution recorded.

### DLV-10 Delivery time entered in another timezone
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** The office and device show different timezones

**When:** Delivery is viewed on both devices

**Expected:** One saved instant produces consistent policy start and expiry boundaries

**Evidence:** No scenario-specific execution recorded.


## SCH Availability search and workload

### SCH-01 Thirteen busy and two free
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Fixture F15 has 15 active technicians and 13 busy during the requested visit interval

**When:** Coordinator searches days 3 to 5

**Expected:** Only the two qualified available technicians are offered with actual times and reasons

**Evidence:** No scenario-specific execution recorded.

### SCH-02 No worker free within target window
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** All qualified workers are occupied on days 3 to 5

**When:** Coordinator searches

**Expected:** An unassigned escalation and earliest feasible alternative appear without a false promise

**Evidence:** No scenario-specific execution recorded.

### SCH-03 Free worker lacks required skill
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** One available worker lacks inverter skills

**When:** Coordinator searches for inverter repair

**Expected:** That worker is excluded or shown as ineligible with a reason

**Evidence:** No scenario-specific execution recorded.

### SCH-04 Leave overrides an empty calendar
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A worker has approved leave but no job that day

**When:** Availability is searched

**Expected:** The worker is not offered during leave

**Evidence:** No scenario-specific execution recorded.

### SCH-05 Travel consumes the apparent gap
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A worker has a one-hour calendar gap between distant sites

**When:** A one-hour visit is proposed

**Expected:** Travel buffers prevent an impossible booking

**Evidence:** No scenario-specific execution recorded.

### SCH-06 Two jobs have overlapping times
P0 | Source: Present in source | Execution: PASS

**Given:** A technician has an existing installation

**When:** Another overlapping installation is assigned

**Expected:** The server refuses the overlap even if the UI submits it

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Overlapping installation assignment returned HTTP 409; does not test shared repair scheduling.

### SCH-07 Adjacent visits at the same site
P1 | Source: Partial | Execution: NOT RUN

**Given:** One visit ends exactly when the next begins

**When:** Coordinator books the second

**Expected:** Half-open intervals allow adjacency only when travel and handover buffers permit

**Evidence:** No scenario-specific execution recorded.

### SCH-08 Customer available outside business hours
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Customer asks for a late-night routine visit

**When:** Coordinator searches

**Expected:** Out-of-hours handling follows a documented policy and does not silently book normal staff

**Evidence:** No scenario-specific execution recorded.

### SCH-09 Routine window crosses a holiday
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Day 3 is a configured nonworking day

**When:** Coordinator searches a routine visit

**Expected:** Working-day or calendar-day policy is explicit and eligible dates are shown

**Evidence:** No scenario-specific execution recorded.

### SCH-10 Two coordinators choose the same free slot
P0 | Source: Partial | Execution: NOT RUN

**Given:** Two requests target one technician at the same time

**When:** Both coordinators confirm

**Expected:** One booking succeeds and the other refreshes availability after an atomic conflict

**Evidence:** No scenario-specific execution recorded.


## DSP Assignment changes and competing requests

### DSP-01 Twenty simultaneous customer calls
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Twenty independent requests arrive for the same 15-person team

**When:** Support saves them and coordinator opens the queue

**Expected:** All requests are uniquely recorded and none disappear because capacity is full

**Evidence:** No scenario-specific execution recorded.

### DSP-02 One slot remains and two requests compete
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Two equally eligible jobs need the same worker

**When:** Coordinator applies ranking

**Expected:** Priority, target date, travel and stable tie-break reasons are visible; no silent starvation occurs

**Evidence:** No scenario-specific execution recorded.

### DSP-03 Urgent repair interrupts routine planning
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A hazardous fault arrives after routine appointments are confirmed

**When:** Coordinator reviews escalation

**Expected:** Urgent work is escalated and displaced customers require explicit rescheduling

**Evidence:** No scenario-specific execution recorded.

### DSP-04 Technician becomes sick after assignment
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Tomorrow's worker becomes unavailable

**When:** Coordinator reassigns the visit

**Expected:** Replacement eligibility is checked and both assignment history and customer contact task are retained

**Evidence:** No scenario-specific execution recorded.

### DSP-05 Customer requests another date
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A confirmed repair appointment exists

**When:** Support records a reschedule request

**Expected:** Old capacity is released only when the replacement arrangement is safely committed

**Evidence:** No scenario-specific execution recorded.

### DSP-06 Job overruns planned duration
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A technician remains at the current site

**When:** Coordinator extends the visit

**Expected:** Affected later appointments are flagged instead of silently overlapping

**Evidence:** No scenario-specific execution recorded.

### DSP-07 Technician declines an unsuitable job
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A worker has been assigned outside capability

**When:** Worker declines with reason

**Expected:** The task returns to the coordinator queue and is not marked completed

**Evidence:** No scenario-specific execution recorded.

### DSP-08 Technician cannot be contacted
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A confirmed worker has not acknowledged the visit

**When:** The acknowledgement deadline passes

**Expected:** The coordinator receives an actionable exception without auto-closing the request

**Evidence:** No scenario-specific execution recorded.

### DSP-09 Assignment retry after network timeout
P0 | Source: Partial | Execution: NOT RUN

**Given:** Booking committed but the response was lost

**When:** Coordinator repeats the command

**Expected:** One assignment exists and capacity is not held twice

**Evidence:** No scenario-specific execution recorded.

### DSP-10 Search result becomes stale
P0 | Source: Partial | Execution: NOT RUN

**Given:** Availability was viewed before a new booking or leave record

**When:** Coordinator confirms the old suggestion

**Expected:** The server rechecks all constraints at confirmation time

**Evidence:** No scenario-specific execution recorded.


## INS Installation crews and field work

### INS-01 Only assigned installer sees work
P0 | Source: Present in source | Execution: NOT RUN

**Given:** Two technicians own different installations

**When:** One opens the other's project or evidence URL

**Expected:** The server denies access and the user's own list stays usable

**Evidence:** No scenario-specific execution recorded.

### INS-02 Start before delivery
P0 | Source: Present in source | Execution: NOT RUN

**Given:** An installation is scheduled but equipment is undelivered

**When:** Installer starts work

**Expected:** The server blocks starting and identifies the missing delivery

**Evidence:** No scenario-specific execution recorded.

### INS-03 Two-person installation crew
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A roof job requires a lead and an assistant

**When:** Coordinator assigns the crew

**Expected:** Both memberships and time reservations are stored and both see the assigned work

**Evidence:** No scenario-specific execution recorded.

### INS-04 Lead and assistant have different powers
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A two-person crew is assigned

**When:** Assistant tries final sign-off

**Expected:** Only a qualified lead or authorized supervisor can approve the handover

**Evidence:** No scenario-specific execution recorded.

### INS-05 Safety checklist incomplete
P0 | Source: Present in source | Execution: NOT RUN

**Given:** One required commissioning check is false

**When:** Installer completes the job

**Expected:** Completion is blocked without falsely marking the project installed

**Evidence:** No scenario-specific execution recorded.

### INS-06 Missing installation evidence
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A started job has no saved photo or signature

**When:** Installer completes

**Expected:** Completion is blocked until required evidence has been saved

**Evidence:** No scenario-specific execution recorded.

### INS-07 Actual hours differ from scheduled hours
P0 | Source: Partial | Execution: NOT RUN

**Given:** A four-hour appointment takes six hours

**When:** Lead submits actual time

**Expected:** Actual labour cost uses saved rates and actual time; schedule and billable time are distinguished

**Evidence:** No scenario-specific execution recorded.

### INS-08 Multiple crew members record time
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Two workers spend different hours at the site

**When:** The crew submits work

**Expected:** Costs and payables are calculated per worker without double counting

**Evidence:** No scenario-specific execution recorded.

### INS-09 Customer refuses installation sign-off
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Checks pass but customer disputes the work

**When:** Lead records the disagreement

**Expected:** Work awaits review and a fabricated signature or automatic closure is forbidden

**Evidence:** No scenario-specific execution recorded.

### INS-10 Installed system differs from accepted capacity
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** The measured or installed capacity differs materially

**When:** Installer submits handover

**Expected:** A discrepancy is flagged for authorized review before final acceptance

**Evidence:** No scenario-specific execution recorded.


## SRV Repair calls and service visits

### SRV-01 Complaint before faulty part is known
P0 | Source: Missing workflow | Execution: FAIL

**Given:** A customer reports low output but cannot name a component

**When:** Support creates a repair request

**Expected:** A customer-and-site ticket can be saved without guessing a warranty or faulty asset

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Complaint without a preselected warranty returned HTTP 400; current contract requires warranty_id before diagnosis.

### SRV-02 Assigned repair worker gets full installed list
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A coordinator assigns a repair visit

**When:** The technician opens it

**Expected:** Installed quantities, serials, locations, delivery dates, warranty terms and repair history load for that site

**Evidence:** No scenario-specific execution recorded.

### SRV-03 Technician changes between original install and repair
P0 | Source: Missing workflow | Execution: FAIL

**Given:** A different qualified worker receives the repair visit

**When:** They open the customer project

**Expected:** Repair assignment grants necessary site access without exposing every customer

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** A different technician assigned to this repair received HTTP 403 when opening the site project.

### SRV-04 Two open faults at one customer
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** An inverter warning and damaged cable are separately reported

**When:** Support reviews open requests

**Expected:** Distinct faults can coexist and duplicate detection suggests linking related work

**Evidence:** No scenario-specific execution recorded.

### SRV-05 Repeated call about same unresolved fault
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** An existing open complaint matches the site and symptom

**When:** Support records the call

**Expected:** It appends contact history or links the duplicate without losing either caller report

**Evidence:** No scenario-specific execution recorded.

### SRV-06 Remote fix avoids a visit
P1 | Source: Policy decision | Execution: NOT RUN

**Given:** A permitted nonhazardous issue is resolved by guided support

**When:** Support documents resolution and customer confirmation

**Expected:** The case records remote resolution and no fake onsite photos or visit hours are created

**Evidence:** No scenario-specific execution recorded.

### SRV-07 Repair cancelled before attendance
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Customer withdraws the request

**When:** Support cancels

**Expected:** The visit slot and reserved parts are released with a reason and history

**Evidence:** No scenario-specific execution recorded.

### SRV-08 First visit diagnoses but cannot fix
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A specialist part is required

**When:** Technician completes diagnosis only

**Expected:** The case stays open with a separate return visit and parts task

**Evidence:** No scenario-specific execution recorded.

### SRV-09 Customer unavailable at repair visit
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Technician arrives but cannot access the property

**When:** Technician records failed attendance

**Expected:** The ticket stays unresolved and rescheduling or a reviewed callout charge follows policy

**Evidence:** No scenario-specific execution recorded.

### SRV-10 Customer calls after alleged repair failed
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A closed issue recurs

**When:** Support opens a linked follow-up

**Expected:** Original evidence and charges remain immutable and repeat-fault history is visible

**Evidence:** No scenario-specific execution recorded.


## DIA Diagnosis and component selection

### DIA-01 Select multiple faulty installed components
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** The asset list includes an inverter and a controller

**When:** Technician marks both faulty

**Expected:** Separate diagnosis lines retain component identity, quantity and coverage decision

**Evidence:** No scenario-specific execution recorded.

### DIA-02 Select another customer's serial
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A serial belongs to another installation

**When:** Technician tries adding it to diagnosis

**Expected:** The server rejects the cross-customer component

**Evidence:** No scenario-specific execution recorded.

### DIA-03 Diagnose a quantity-tracked panel
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Panels were tracked by quantity rather than unique serial

**When:** Technician selects one faulty panel

**Expected:** Affected quantity is bounded by installed quantity and references the original order line

**Evidence:** No scenario-specific execution recorded.

### DIA-04 Part not supplied by this company
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A third-party component caused the symptom

**When:** Technician records the external part

**Expected:** It is clearly marked external and is not automatically covered by an unrelated company warranty

**Evidence:** No scenario-specific execution recorded.

### DIA-05 No fault found
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Diagnostics pass and no component is marked faulty

**When:** Technician records observations

**Expected:** The visit can close under a reviewed no-fault policy without fabricating a replacement

**Evidence:** No scenario-specific execution recorded.

### DIA-06 Diagnosis changes before approval
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A previously selected component is found healthy

**When:** Technician revises the draft diagnosis

**Expected:** Draft bill and parts reservation refresh while the revision history is retained

**Evidence:** No scenario-specific execution recorded.

### DIA-07 Diagnosis changes after billing
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A service invoice is already issued

**When:** Staff tries editing the fault selection

**Expected:** Issued lines remain frozen; correction uses a reviewed revision or credit workflow

**Evidence:** No scenario-specific execution recorded.

### DIA-08 Customer disputes diagnosis
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Customer declines the proposed replacement

**When:** Support records disagreement

**Expected:** No chargeable work starts without the required approval and the dispute remains visible

**Evidence:** No scenario-specific execution recorded.

### DIA-09 One of many panels is replaced repeatedly
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A quantity-tracked line has several panels

**When:** Technician records successive replacements

**Expected:** Cumulative replacement quantities do not exceed identifiable entitlement without review

**Evidence:** No scenario-specific execution recorded.

### DIA-10 Retired serial selected again
P0 | Source: Present in source | Execution: NOT RUN

**Given:** An old device is marked replaced

**When:** Support opens a new fault against it

**Expected:** The app directs staff to the current replacement identity and retains old history

**Evidence:** No scenario-specific execution recorded.


## WAR Coverage decisions per component

### WAR-01 Covered component at ticket opening
P0 | Source: Present in source | Execution: PASS

**Given:** A delivered device is within its warranty period

**When:** Support opens the corresponding ticket

**Expected:** Coverage decision and reason use saved delivery and expiry dates

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Active device ticket saved covered=true with delivery-based reason.

### WAR-02 Expired component at ticket opening
P0 | Source: Present in source | Execution: PASS

**Given:** The device warranty expired before the complaint

**When:** Support opens the ticket

**Expected:** It is not treated as covered solely because other system parts remain covered

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Expired device ticket saved covered=false.

### WAR-03 Different cover within the same system
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Panel warranty is active but inverter warranty expired

**When:** Technician selects both faulty components

**Expected:** Each line gets an independent decision and the whole ticket is not globally free or charged

**Evidence:** No scenario-specific execution recorded.

### WAR-04 Exact expiry boundary
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** The complaint arrives exactly at expiry

**When:** Coverage is evaluated

**Expected:** The agreed exclusive expiry rule is consistently applied in the server and shown to staff

**Evidence:** No scenario-specific execution recorded.

### WAR-05 Warranty expires before the booked visit
P0 | Source: Partial | Execution: NOT RUN

**Given:** Complaint was recorded while cover was active

**When:** Technician visits five days later

**Expected:** Coverage follows the documented complaint-date rule unless a reviewed exclusion applies

**Evidence:** No scenario-specific execution recorded.

### WAR-06 Excluded accidental damage
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A device is within time cover but diagnosis shows an excluded cause

**When:** Authorized reviewer considers evidence

**Expected:** Coverage is not auto-approved by date alone; reason, reviewer and evidence are saved

**Evidence:** No scenario-specific execution recorded.

### WAR-07 Unknown or missing policy
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Imported equipment has no reliable policy dates

**When:** Staff attempts automatic billing

**Expected:** The line is pending review rather than silently free or chargeable

**Evidence:** No scenario-specific execution recorded.

### WAR-08 Parts covered but labour excluded
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** The policy covers an inverter but not callout labour

**When:** The repair is priced

**Expected:** Part charge is zero while approved labour is billed separately

**Evidence:** No scenario-specific execution recorded.

### WAR-09 Manufacturer reimbursement differs from customer cover
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Company promises cover while supplier claim is disputed

**When:** Accounts reviews the repair

**Expected:** Customer entitlement remains independent of the supplier recovery balance

**Evidence:** No scenario-specific execution recorded.

### WAR-10 Warranty override
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** An authorized manager grants goodwill or corrects a coverage decision

**When:** The override is saved

**Expected:** Original decision, new decision, reason and actor are retained; technician cannot self-approve

**Evidence:** No scenario-specific execution recorded.


## RMA Replacement returns and supplier handling

### RMA-01 Compatible replacement in stock
P0 | Source: Partial | Execution: NOT RUN

**Given:** A diagnosed serial has a matching available replacement

**When:** Authorized staff confirms replacement

**Expected:** Old and new identities link, stock reduces once and inherited warranty remains traceable

**Evidence:** No scenario-specific execution recorded.

### RMA-02 Replacement uses an allocated serial
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A candidate replacement is reserved for another order

**When:** Staff tries the substitution

**Expected:** The server refuses without stealing stock from the other customer

**Evidence:** No scenario-specific execution recorded.

### RMA-03 Replacement is a different product
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A wrong inverter model is scanned

**When:** Replacement is submitted

**Expected:** The server rejects incompatible substitution without changing either device

**Evidence:** No scenario-specific execution recorded.

### RMA-04 Different compatible model approved
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Original model is discontinued

**When:** Manager approves an engineering-compatible substitute

**Expected:** Compatibility, customer agreement and any price adjustment are explicit and auditable

**Evidence:** No scenario-specific execution recorded.

### RMA-05 Faulty part returned to warehouse
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Technician removes a failed device onsite

**When:** Warehouse receives its return

**Expected:** Custody changes to quarantine, never saleable Available stock

**Evidence:** No scenario-specific execution recorded.

### RMA-06 Faulty part not yet returned
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A new part was issued but old part is still onsite

**When:** Coordinator reviews pending returns

**Expected:** An outstanding-return task remains visible without falsifying receipt

**Evidence:** No scenario-specific execution recorded.

### RMA-07 No replacement stock available
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Diagnosis needs an unavailable part

**When:** Staff schedules follow-up

**Expected:** The case shows waiting for parts and does not promise a completion date as confirmed

**Evidence:** No scenario-specific execution recorded.

### RMA-08 Replacement fails immediately
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A newly fitted replacement does not work

**When:** Technician records another failure

**Expected:** Both serials and failure events remain visible without losing original warranty lineage

**Evidence:** No scenario-specific execution recorded.

### RMA-09 Supplier accepts or rejects claim
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A quarantined device was sent to supplier

**When:** Warehouse records supplier decision

**Expected:** Supplier credit or returned stock follows its own record and does not rewrite the customer's invoice

**Evidence:** No scenario-specific execution recorded.

### RMA-10 Replacement retains original coverage
P0 | Source: Present in source | Execution: PASS

**Given:** A covered device is replaced near expiry

**When:** Support checks the new serial

**Expected:** The documented inherited-date policy applies rather than silently granting a new full term

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Replacement warranty dates compared directly with the original saved dates.


## BIL Repair estimates and service invoices

### BIL-01 Covered replacement shown at zero
P0 | Source: Missing workflow | Execution: FAIL

**Given:** A covered inverter is replaced

**When:** A service document is issued

**Expected:** The replacement name, quantity and serials appear with INR 0 customer charge and a coverage reason

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Covered replacement created 0 service documents; required a visible zero-payable replacement line.

### BIL-02 Mixed coverage service bill
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** One covered inverter and two chargeable connectors are replaced

**When:** The approved repair is invoiced

**Expected:** All lines are visible and only uncovered items plus approved labour and travel are payable

**Evidence:** No scenario-specific execution recorded.

### BIL-03 Separate service invoice from original sale
P0 | Source: Partial | Execution: PASS

**Given:** An installation invoice already exists

**When:** A later paid repair is resolved

**Expected:** A separately numbered linked service invoice is created; initial lines remain unchanged

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Compared complete original invoice and lines before/after repair; checked a separate linked service invoice exists.

### BIL-04 All repair lines covered
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Every part and labour line is covered

**When:** Service is completed

**Expected:** A zero-payable service statement records the work; no payment is demanded

**Evidence:** No scenario-specific execution recorded.

### BIL-05 Internal cost differs from selling price
P0 | Source: Missing workflow | Execution: FAIL

**Given:** A replacement cost the company INR 14000 but agreed retail is INR 18000

**When:** An uncovered repair is invoiced

**Expected:** Customer charge uses approved selling price; internal cost remains separately reportable

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Replacement customer charge was INR 14000; approved-price fixture is INR 18000 and acquisition cost INR 14000.

### BIL-06 Customer rejects paid estimate
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** An uncovered repair estimate awaits consent

**When:** Customer declines

**Expected:** No chargeable replacement is executed or invoiced as accepted work

**Evidence:** No scenario-specific execution recorded.

### BIL-07 Resolution retried after timeout
P0 | Source: Partial | Execution: NOT RUN

**Given:** Repair and invoice committed but response was lost

**When:** The request is retried

**Expected:** No second replacement, stock movement or service invoice is created

**Evidence:** No scenario-specific execution recorded.

### BIL-08 Invoice correction after issue
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A service bill has an incorrect approved line

**When:** Accounts corrects it

**Expected:** An authorized credit or revised document links back without overwriting issued history

**Evidence:** No scenario-specific execution recorded.

### BIL-09 Financial totals for mixed repair
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Worked fixture MIX1 totals INR 1700 customer payable

**When:** Accounts views invoice and report

**Expected:** Invoice lines total 1700; covered costs remain company costs and are not recorded as zero cost

**Evidence:** No scenario-specific execution recorded.

### BIL-10 Tax and warranty document treatment unconfigured
P1 | Source: Policy decision | Execution: NOT RUN

**Given:** The app has no verified tax configuration

**When:** Staff prints a service bill

**Expected:** It is labelled as a demo service statement and does not claim legally compliant tax invoicing

**Evidence:** No scenario-specific execution recorded.


## EVD Repair photos completion and confirmation

### EVD-01 After-repair photo required
P0 | Source: Missing workflow | Execution: FAIL

**Given:** An onsite repair has no saved completion photo

**When:** Technician marks the visit complete

**Expected:** Completion is blocked until a valid visit-linked photo is saved

**Evidence:** scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json

**Observed:** Repair resolution without any repair photo returned HTTP 200; required completion rejection.

### EVD-02 Diagnosis photo linked to faulty item
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Several components were inspected

**When:** Technician attaches a fault photo

**Expected:** The photo links to the correct visit and component rather than a generic customer album

**Evidence:** No scenario-specific execution recorded.

### EVD-03 Wrong file masquerades as photo
P0 | Source: Partial | Execution: NOT RUN

**Given:** An executable is renamed to JPG

**When:** Technician uploads evidence

**Expected:** Content validation rejects it and no downloadable unsafe file is stored

**Evidence:** No scenario-specific execution recorded.

### EVD-04 Upload loses connection midway
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A repair photo upload is interrupted

**When:** Technician retries

**Expected:** No partial image is treated as evidence; retry creates one usable record

**Evidence:** No scenario-specific execution recorded.

### EVD-05 Device permission denied
P1 | Source: Partial | Execution: NOT RUN

**Given:** Technician denies camera permission

**When:** They need to attach completion evidence

**Expected:** A clear explanation and permitted file-picker alternative are offered

**Evidence:** No scenario-specific execution recorded.

### EVD-06 Customer signs before final changes
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A signed service report is later changed

**When:** Staff edits charge or replaced component

**Expected:** Signature is invalidated for the changed version and fresh confirmation is requested

**Evidence:** No scenario-specific execution recorded.

### EVD-07 Customer confirms by phone
P1 | Source: Partial | Execution: NOT RUN

**Given:** Customer cannot sign onsite but accepts the result by phone

**When:** Support records confirmation

**Expected:** Method, actor, time and stated confirmer are saved without pretending a handwritten signature exists

**Evidence:** No scenario-specific execution recorded.

### EVD-08 Customer disputes closure
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Technician marks work done but customer reports failure

**When:** Support records the dispute

**Expected:** Case remains awaiting review and is not silently counted as customer-confirmed

**Evidence:** No scenario-specific execution recorded.

### EVD-09 Technician attempts to erase evidence
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A photo belongs to an issued report

**When:** Worker tries replacing or deleting it

**Expected:** Issued evidence history remains protected and any correction is versioned

**Evidence:** No scenario-specific execution recorded.

### EVD-10 Unauthenticated person opens a photo URL
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A private image URL is copied outside the staff session

**When:** Visitor requests the image

**Expected:** The server denies private evidence access

**Evidence:** No scenario-specific execution recorded.


## SEC Roles staffing and access boundaries

### SEC-01 Support creates installation request
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Support has a verified customer call

**When:** They open New enquiry and submit

**Expected:** Support can create intake without gaining price, stock or payout authority

**Evidence:** No scenario-specific execution recorded.

### SEC-02 Coordinator manages visits
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** A service coordinator has no finance role

**When:** They search and assign workers

**Expected:** Scheduling is allowed while invoice edits and staff payouts remain denied

**Evidence:** No scenario-specific execution recorded.

### SEC-03 Technician sees assigned repair only
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Two workers have different repair visits

**When:** One requests the other visit ID

**Expected:** Server rejects unrelated details and photos even through direct URLs

**Evidence:** No scenario-specific execution recorded.

### SEC-04 Warehouse cannot approve customer discount
P0 | Source: Partial | Execution: NOT RUN

**Given:** Warehouse has stock permissions

**When:** They call a quote or discount approval action

**Expected:** The server denies the action regardless of hidden UI controls

**Evidence:** No scenario-specific execution recorded.

### SEC-05 Accounts cannot fake technical completion
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Accounts can invoice but is not the assigned worker

**When:** They call repair completion

**Expected:** Technical completion is denied while authorized payment work stays available

**Evidence:** No scenario-specific execution recorded.

### SEC-06 One employee covers two duties
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A small company has a coordinator who also answers calls

**When:** Administrator grants defined capabilities

**Expected:** Permissions are explicit and audited without sharing another person's password

**Evidence:** No scenario-specific execution recorded.

### SEC-07 Employee leaves the company
P0 | Source: Partial | Execution: NOT RUN

**Given:** A staff account has active sessions and future visits

**When:** Administrator deactivates the person

**Expected:** Sessions become unusable and affected appointments enter reassignment review

**Evidence:** No scenario-specific execution recorded.

### SEC-08 Two support agents work concurrently
P0 | Source: Partial | Execution: NOT RUN

**Given:** Support team contains two named users

**When:** Both record different callers

**Expected:** Separate actor identities are retained; no shared login is required

**Evidence:** No scenario-specific execution recorded.

### SEC-09 Only administrator sees staff directory
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A nonadmin staff member opens Team or its API

**When:** The request is made directly

**Expected:** The server refuses access to the administrative directory

**Evidence:** No scenario-specific execution recorded.

### SEC-10 Permission changed while screen is open
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** A user loses a permission after loading a form

**When:** They submit the old form

**Expected:** Current server permissions win and the operation is denied

**Evidence:** No scenario-specific execution recorded.


## CON Concurrency retry and integrity

### CON-01 Same idempotency key same request
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A command completed and its response was lost

**When:** Client repeats identical data and key

**Expected:** The saved result returns without repeating business effects

**Evidence:** No scenario-specific execution recorded.

### CON-02 Same idempotency key changed request
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A key was used for one command body

**When:** Client submits changed data with that key

**Expected:** The server rejects the conflicting retry

**Evidence:** No scenario-specific execution recorded.

### CON-03 Two workers diagnose same service visit
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Both opened the same draft revision

**When:** They submit different component findings

**Expected:** A version conflict is shown instead of losing either diagnosis silently

**Evidence:** No scenario-specific execution recorded.

### CON-04 Two repair tickets replace the same original
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** Two open tickets reference one delivered serial

**When:** Both try a replacement concurrently

**Expected:** Only one replacement succeeds and the other detects the changed original state

**Evidence:** No scenario-specific execution recorded.

### CON-05 Reservation races with service replacement
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** One unreserved serial is needed by both workflows

**When:** Both commands execute together

**Expected:** Stock, reservation and replacement ownership remain consistent

**Evidence:** No scenario-specific execution recorded.

### CON-06 Failure after stock update before invoice
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** A database error occurs during repair resolution

**When:** The transaction aborts

**Expected:** Stock, old serial, warranty, ticket and invoice all roll back together

**Evidence:** No scenario-specific execution recorded.

### CON-07 Two coordinators reschedule the same visit
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Both opened the same appointment revision

**When:** They confirm different times

**Expected:** One coherent appointment remains and the stale change is rejected

**Evidence:** No scenario-specific execution recorded.

### CON-08 Payment response lost after commit
P0 | Source: Present in source | Execution: NOT RUN

**Given:** The payment was saved but client times out

**When:** Staff uses retry with the original key

**Expected:** One receipt remains and the UI recovers the committed outcome

**Evidence:** No scenario-specific execution recorded.

### CON-09 Double tap completion
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** A technician taps Complete twice rapidly

**When:** Both requests reach the server

**Expected:** One handover and one payable cost record exist

**Evidence:** No scenario-specific execution recorded.

### CON-10 Database rejects a foreign identifier
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** An action references a deleted or nonexistent record

**When:** The request is submitted

**Expected:** A controlled error is returned and no orphan business records appear

**Evidence:** No scenario-specific execution recorded.


## OPS Reliability reporting and recovery

### OPS-01 Server restarts after saved action
P0 | Source: Present in source | Execution: NOT RUN

**Given:** A committed project and session exist

**When:** The API process restarts

**Expected:** Saved work remains and valid session behavior follows configured persistence

**Evidence:** No scenario-specific execution recorded.

### OPS-02 Database connection fails during save
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** The database becomes unreachable

**When:** Staff submits a command

**Expected:** No success is shown and retry cannot duplicate a partially committed action

**Evidence:** No scenario-specific execution recorded.

### OPS-03 Evidence disk is full
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** Metadata storage works but file storage cannot write

**When:** Technician uploads

**Expected:** The app reports failure and does not record nonexistent evidence as saved

**Evidence:** No scenario-specific execution recorded.

### OPS-04 Restore a backup
P0 | Source: Needs verification | Execution: NOT RUN

**Given:** A backup includes database and private files

**When:** The application is restored to a separate environment

**Expected:** Records and evidence links reconcile and restored totals match the backup checkpoint

**Evidence:** No scenario-specific execution recorded.

### OPS-05 Dashboard distinguishes backlog from active work
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** Many requests are waiting for parts or appointments

**When:** Coordinator opens Home

**Expected:** Counts separate unassigned, scheduled, blocked, in-progress and overdue visits

**Evidence:** No scenario-specific execution recorded.

### OPS-06 Report distinguishes cash and profit
P0 | Source: Present in source | Execution: NOT RUN

**Given:** An invoice is unpaid or only partly paid

**When:** Accounts opens reports

**Expected:** Cash collected, outstanding and completed contribution are separate figures

**Evidence:** No scenario-specific execution recorded.

### OPS-07 Covered repair still costs money
P0 | Source: Present in source | Execution: NOT RUN

**Given:** Customer pays zero but the company uses parts and labour

**When:** Accounts views project contribution

**Expected:** Internal repair costs reduce contribution even with no customer charge

**Evidence:** No scenario-specific execution recorded.

### OPS-08 Search handles growing workload
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** Fixture LOAD1 has 1000 projects and 200 open service requests

**When:** Staff searches and pages through records

**Expected:** Pagination preserves all results and agreed response-time targets are measured, not assumed

**Evidence:** No scenario-specific execution recorded.

### OPS-09 Audit reconstructs a disputed repair
P0 | Source: Partial | Execution: NOT RUN

**Given:** A customer questions who changed assignment or coverage

**When:** Manager reviews history

**Expected:** Actor, time, old and new states, reasons and related documents are available

**Evidence:** No scenario-specific execution recorded.

### OPS-10 Demo reset cannot erase operational data
P0 | Source: Partial | Execution: NOT RUN

**Given:** A training fixture needs to be replayed

**When:** Tester resets the isolated fixture

**Expected:** Only the explicitly selected test dataset changes; live/demo customer work is preserved

**Evidence:** No scenario-specific execution recorded.


## UXP Mobile Windows navigation and device behavior

### UXP-01 Return to filtered project list
P1 | Source: Present in source | Execution: NOT RUN

**Given:** Staff opens a project from a searched stage-filtered list

**When:** They choose Back

**Expected:** Search, stage and page context are retained

**Evidence:** No scenario-specific execution recorded.

### UXP-02 Next task follows actual saved state
P0 | Source: Partial | Execution: NOT RUN

**Given:** A project moves from survey to payment or packing

**When:** Staff reloads the project

**Expected:** The next-step message matches saved progress and the user's permitted action

**Evidence:** No scenario-specific execution recorded.

### UXP-03 Navigate away from unsaved form
P0 | Source: Missing workflow | Execution: NOT RUN

**Given:** Staff edits a long form without saving

**When:** They choose another screen or phone Back

**Expected:** A stay/discard choice prevents accidental data loss

**Evidence:** No scenario-specific execution recorded.

### UXP-04 Small phone with keyboard open
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** A 360px screen shows a long repair form

**When:** Technician focuses the last field

**Expected:** The field, error and submit action remain reachable without whole-page overflow

**Evidence:** No scenario-specific execution recorded.

### UXP-05 Screen reader and keyboard operation
P1 | Source: Partial | Execution: NOT RUN

**Given:** A user cannot use a mouse or read color cues

**When:** They navigate menus and forms

**Expected:** Labels, focus order, status messages and keyboard actions remain understandable

**Evidence:** No scenario-specific execution recorded.

### UXP-06 Android native app against same backend
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A signed Android build uses the shared API

**When:** Staff completes an assigned repair

**Expected:** Identity, photos, invoice rules and server permissions match the desktop workflow

**Evidence:** No scenario-specific execution recorded.

### UXP-07 Windows native app against same backend
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A signed Windows build is installed

**When:** Staff schedules and invoices a repair

**Expected:** The installed client uses the same authoritative rules and handles printing and file permissions

**Evidence:** No scenario-specific execution recorded.

### UXP-08 Offline during field visit
P0 | Source: Partial | Execution: NOT RUN

**Given:** A technician loses network after opening a visit

**When:** They attempt save or completion

**Expected:** Offline state is explicit and no unsynced work is shown as committed; draft policy is defined

**Evidence:** No scenario-specific execution recorded.

### UXP-09 Barcode camera on a physical phone
P1 | Source: Needs verification | Execution: NOT RUN

**Given:** A real device grants camera access in a supported secure context

**When:** Technician scans a printed label

**Expected:** The actual serial is decoded and server eligibility checks still run

**Evidence:** No scenario-specific execution recorded.

### UXP-10 Client is older than backend
P1 | Source: Missing workflow | Execution: NOT RUN

**Given:** A native or cached web client uses an older request shape

**When:** It calls a changed endpoint

**Expected:** Version compatibility or a clear update message prevents silent corruption

**Evidence:** No scenario-specific execution recorded.
