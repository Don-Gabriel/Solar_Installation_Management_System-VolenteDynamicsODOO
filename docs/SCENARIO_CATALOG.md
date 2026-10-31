# SunPower real world scenarios and acceptance plan

Prepared 31 October 2026 for the user's revised working deadline of **31 October 2026 at 14:45 IST**. There is no confirmed official event deadline. The aim is a working, demonstrable operational system, not a large checklist with invented passes.

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

The implemented build has **eight staff roles and 34 preserved demo accounts**: two administrators, three sales staff, two surveyors, two support staff, two service coordinators, two warehouse staff, two accounts staff and 19 technician identities. Fifteen technicians form the active dispatch roster; four older identities remain for historical work. No customer login is needed for the phone-led service workflow.

Support can create installation requests and repair complaints before a faulty part is known. Coordinators search dates, skills and crew size, reserve qualified workers atomically, reschedule visits and see leave conflicts. Installation and repair bookings share availability checks. Weekly working days, 09:00 to 17:00 IST hours and a 30-minute buffer are enforced. Geographic route planning and a dated holiday calendar are not implemented.

Assigned repair technicians can open site and installed-component history, select faulty items, propose replacements and attach completion photos. Approval is tied to diagnosis revision. Completion requires a photo from the current visit and diagnosis, and repeated completion cannot issue stock or bills twice. The original installation invoice remains unchanged. Service invoices show covered and charged lines, warranty credits and original/replacement serials, including a zero-payable document when fully covered. Selling prices and internal costs are separate. Returned components enter quarantine. Support records customer confirmation, disputes or a linked follow-up request.

Installation crews record individual time and cost, and accounts can pay crew members separately without duplicate payment. Administrators can change staff access and qualifications with an audit reason; deactivation revokes sessions. These are implemented capabilities, not a claim that every exception in the catalogue is complete. The execution register contains 137 passed cases and 63 blocked cases at this revision. All six original review failures have passing focused retests.

## Roles and realistic staffing

Standalone acceptance fixture: **eight permission roles and 27 distinct demo employees**, including exactly **15 field technicians**. These are proposed fixture sizes for a 40-installations-per-month company, not a proven optimal hiring plan. Actual staffing depends on geography, average job duration and repair volume. Do not expand every role to 50 people.

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

The **newly implemented permission role is Service coordinator**. Dispatching and service supervision are responsibilities inside this role; they do not need two separate permission roles yet. Lead installer, assistant, driver and purchasing clerk are job responsibilities or qualifications, not automatically separate login roles. Record each person's identity; never share a team password.

The target has one owner and one accountant, with explicit backup arrangements rather than duplicate daily roles. Sales, surveys, support, coordination and stock are each two-person teams. Technicians are the large team. A possible skills fixture is four lead-capable technicians, nine qualified general technicians and two supervised assistants. Skills and crew membership must constrain assignments; a free assistant cannot become an independent electrical lead simply because the calendar is empty. Qualifications here are synthetic test attributes, not real-world certifications.

One employee may cover several duties in a small business, but the current database has one role per user. Define the combined capabilities and conflicts before adding multi-role support. A coordinator may also handle calls through explicitly granted intake permission. Financial override, payment approval and technical completion should remain independently attributable. A reporting-only owner delegate may be added later if actually needed; no separate customer, supplier, HR or driver login is required for this demo.

The live demo preserves its original 32 employees and adds two named coordinators, giving 34 accounts. The standalone F15 planning fixture has 27 people; it does not replace the live staff directory. The demo seeds 15 active dispatch technicians, with 13 occupied in the 13:00 to 15:00 IST interval on days 3 through 5. Working dates and the two free names are recorded in the demo settings. Existing users, payments and historical work are not deleted.

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

Recommended order under the 14:45 target: implement and test the shared scheduling, repair and billing rules first; prove the native path with a narrow client; then package only platforms whose build and device gates actually pass. Keep the browser client available for rehearsal. Installing a web app is not the same as shipping a React Native app.

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

Use the remaining time before 14:45 IST for regression, artifact generation and rehearsal of scheduling and warranty billing. This is a planning target, not a promise that 200 scenarios or every native platform can be completed in that time. If the deadline becomes incompatible with required work, report the exact unfinished cases rather than hiding them or marking them passed.

A release may be called verified for this catalogue only when every required case has a recorded executed result, no unresolved required failures, and no required blocked cases. Any deferred P1/P2 scenario must be listed and accepted as a limitation; it must not be relabelled PASS. Security, monetary and stock integrity failures prevent a clean-release claim. Physical-device and restore gates cannot be replaced by source inspection. An explicit owner-approved scope change is required to remove a requirement.

## Source map and references

The original user-supplied Solar Installation Management System PDF was read on 31 October 2026. It is kept outside Git. The user's review messages and staffing clarification are primary requirements; the calendar window and target staffing numbers are labelled proposals.

Repository evidence: `apps/api/src/routes.ts` for role boundaries; `modules/scheduling.ts` for shared worker availability; `modules/field.ts` for installation crews and individual payouts; `modules/service-operations.ts` for diagnosis, coverage and billing; `modules/staff.ts` for access changes; `modules/queries.ts` for restricted views; `plugins/files.ts` for private installation and repair evidence; migrations 003 through 009 for service operations; `tests/integration/lifecycle.test.ts` and `tests/e2e` for executed checks. The original catalogue source classifications remain historical baseline assessments; current execution status is authoritative for test results.

- React Native platform-specific code: https://reactnative.dev/docs/platform-specific-code
- React Native environment setup: https://reactnative.dev/docs/set-up-your-environment
- Microsoft React Native Windows setup: https://microsoft.github.io/react-native-windows/docs/getting-started/
- Odoo field-service reference: https://www.odoo.com/documentation/20.0/applications/services/field_service/product_management.html

The Odoo reference supports separating field work, materials, customer reports and billing. Its documented whole-shift warranty behavior is not evidence that our component-by-component requirement is already implemented. The proposed design is our inference from the user's requirements and reviewed source. No dependency on Odoo hosting is introduced.


## Catalogue status summary

Historical source review at d0d1038 is separate from current execution. Counts below are generated from the 200 named cases.

- Missing workflow: 103
- Partial: 28
- Needs verification: 24
- Present in source: 43
- Policy decision: 2

Execution: PASS: 194, BLOCKED: 6.


## INT Calls and installation requests

### INT-01 Support records a new installation call
P0 | Source: Missing workflow | Execution: PASS

**Given:** A new caller has a site and preferred visit date

**When:** Support records the enquiry

**Expected:** One numbered request records the caller, site, phone source and support actor

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [INT-01 SEC-01] support creates audited installation intake without gaining stock or finance authority

### INT-02 Caller does not know system size
P1 | Source: Missing workflow | Execution: PASS

**Given:** Caller wants advice but cannot choose capacity

**When:** Support saves a request awaiting survey

**Expected:** Unknown capacity is explicit and no package is silently promised

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/navigation.spec.ts

**Observed:** Passed: Customer intake and contact history [INT-02 INT-05 INT-06] unknown capacity stays explicit, survey sizes it, and hazard creates tracked review; Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (chromium); Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (webkit)

### INT-03 Repeated call for the same request
P0 | Source: Missing workflow | Execution: PASS

**Given:** An open installation request exists

**When:** Support searches phone and updates the contact log

**Expected:** The existing request is offered and a second project is not silently created

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/navigation.spec.ts

**Observed:** Passed: Customer intake and contact history [INT-03 INT-04 CRM-03] returning customer can add a site or another system while repeated calls append to one request; Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (chromium); Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (webkit)

### INT-04 Two unrelated requests from one household
P1 | Source: Partial | Execution: PASS

**Given:** A caller wants installation at two addresses

**When:** Support creates two site requests

**Expected:** Separate sites and appointment histories stay linked to the right customer

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/navigation.spec.ts

**Observed:** Passed: Customer intake and contact history [INT-03 INT-04 CRM-03] returning customer can add a site or another system while repeated calls append to one request; Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (chromium); Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (webkit)

### INT-05 Customer wants a specific appointment
P0 | Source: Missing workflow | Execution: PASS

**Given:** Customer can attend only Friday afternoon

**When:** Support records the preference

**Expected:** Preference is stored separately from a confirmed appointment

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [INT-02 INT-05 INT-06] unknown capacity stays explicit, survey sizes it, and hazard creates tracked review

### INT-06 Caller reports an electrical hazard
P0 | Source: Missing workflow | Execution: PASS

**Given:** Caller reports smoke or exposed live wiring

**When:** Support marks the request urgent and escalates

**Expected:** An urgent queue and human escalation appear without applying the routine 3 to 5 day promise

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [INT-02 INT-05 INT-06] unknown capacity stays explicit, survey sizes it, and hazard creates tracked review

### INT-07 Wrong phone number entered
P1 | Source: Needs verification | Execution: PASS

**Given:** Support enters a malformed phone number

**When:** Save is attempted

**Expected:** Validation explains the error and no incomplete customer is committed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INT-07] malformed phone is rejected without creating a partial customer

### INT-08 Customer changes their mind before survey
P1 | Source: Missing workflow | Execution: PASS

**Given:** An enquiry has no accepted order

**When:** Support cancels with a reason

**Expected:** Request history is retained and any future appointment is released

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [INT-08] cancellation preserves enquiry history and releases the future survey appointment

### INT-09 Call interrupted during entry
P1 | Source: Partial | Execution: PASS

**Given:** Support has entered customer details

**When:** The app loses connection before save

**Expected:** Unsaved information remains recoverable and no success message is shown

**Evidence:** tests/e2e/navigation.spec.ts

**Observed:** Passed: [INT-09 UXP-03] interrupted enquiry recovers its draft and in-app/back navigation offers stay or discard (chromium); Passed: [INT-09 UXP-03] interrupted enquiry recovers its draft and in-app/back navigation offers stay or discard (webkit)

### INT-10 Public intake disabled for staff operation
P1 | Source: Missing workflow | Execution: PASS

**Given:** The business chooses phone-led intake only

**When:** An anonymous visitor opens the enquiry URL

**Expected:** Public creation is disabled by an explicit setting while staff intake remains available

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final billing and intake guards [INT-10] explicit phone-only setting blocks anonymous creation while staff intake stays usable


## CRM Customers sites and contact history

### CRM-01 Search a returning customer by phone
P0 | Source: Partial | Execution: PASS

**Given:** A customer already has installed equipment

**When:** Support searches the full phone number

**Expected:** Matching customers and sites are shown without exposing unrelated private evidence

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [CRM-01 CRM-02] phone search distinguishes customers sharing a phone by name and site

### CRM-02 Shared family phone number
P1 | Source: Partial | Execution: PASS

**Given:** Two distinct customers use the same phone

**When:** Support searches and chooses the correct person

**Expected:** Records remain distinguishable by name and site rather than forcibly merging

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [CRM-01 CRM-02] phone search distinguishes customers sharing a phone by name and site

### CRM-03 Multiple systems at one address
P0 | Source: Missing workflow | Execution: PASS

**Given:** One site has an older and newer installation

**When:** Support opens a repair request

**Expected:** The affected installation must be selected and both histories remain visible

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/navigation.spec.ts

**Observed:** Passed: Customer intake and contact history [INT-03 INT-04 CRM-03] returning customer can add a site or another system while repeated calls append to one request; Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (chromium); Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (webkit)

### CRM-04 Correct a customer spelling
P1 | Source: Missing workflow | Execution: PASS

**Given:** An installed project exists with a name typo

**When:** Authorized staff corrects the name

**Expected:** Current contact data changes with an audit record while issued document snapshots stay unchanged

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [CRM-04 CRM-05 CRM-07 CRM-10] verified optimistic contact edits preserve issued name/address and restrict old phone history

### CRM-05 Change customer contact number
P1 | Source: Missing workflow | Execution: PASS

**Given:** A customer reports a replacement phone number

**When:** Support verifies and updates the number

**Expected:** The old value remains in restricted history and future contact uses the new number

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [CRM-04 CRM-05 CRM-07 CRM-10] verified optimistic contact edits preserve issued name/address and restrict old phone history

### CRM-06 Record access instructions
P1 | Source: Partial | Execution: PASS

**Given:** A roof is accessible only through a locked gate

**When:** Support adds access notes

**Expected:** Assigned workers see the notes before departure

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/navigation.spec.ts

**Observed:** Passed: Customer intake and contact history [CRM-06] assigned technician receives versioned site access instructions; Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (chromium); Passed: [INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions (webkit)

### CRM-07 Customer address differs from billing address
P1 | Source: Missing workflow | Execution: PASS

**Given:** A company pays for a remote installation

**When:** Staff records the two addresses

**Expected:** Work goes to the service address and the invoice uses the agreed billing address

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [CRM-04 CRM-05 CRM-07 CRM-10] verified optimistic contact edits preserve issued name/address and restrict old phone history

### CRM-08 Duplicate records discovered
P2 | Source: Missing workflow | Execution: PASS

**Given:** Two records represent the same person and site

**When:** An administrator reviews a merge

**Expected:** No invoices, warranties or evidence are lost and identifiers remain traceable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [CRM-08] reviewed administrator merge preserves project and all invoice identifiers

### CRM-09 Wrong customer selected for a complaint
P0 | Source: Missing workflow | Execution: PASS

**Given:** Support has selected a different household

**When:** Support changes the selection before submission

**Expected:** Selected devices and proposed visit reset to the correct customer

**Evidence:** tests/e2e/repairs.spec.ts

**Observed:** Passed: [CRM-09 BIL-10 UXP-08] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (chromium); Passed: [CRM-09 BIL-10 UXP-08] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (webkit)

### CRM-10 Customer calls while another employee edits
P1 | Source: Missing workflow | Execution: PASS

**Given:** Two support employees open the same contact record

**When:** Both submit conflicting changes

**Expected:** The later save detects a conflict rather than silently losing the earlier change

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer intake and contact history [CRM-04 CRM-05 CRM-07 CRM-10] verified optimistic contact edits preserve issued name/address and restrict old phone history


## SUR Survey and suitability

### SUR-01 Quote without a survey
P0 | Source: Present in source | Execution: PASS

**Given:** A new enquiry has no approved survey

**When:** Sales issues a quote

**Expected:** The server refuses and explains that survey approval is required

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [SUR-01] blocks direct quote issuance without an approved survey

### SUR-02 Insufficient roof area
P0 | Source: Present in source | Execution: PASS

**Given:** A 3 kW request has less than the configured roof requirement

**When:** Surveyor tries approval

**Expected:** Approval is refused with the actual measured requirement

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection

### SUR-03 Unsuitable on-grid connection
P0 | Source: Present in source | Execution: PASS

**Given:** The grid-suitability check is false

**When:** Surveyor approves an on-grid request

**Expected:** Approval is refused and the survey remains reviewable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection

### SUR-04 Approve a suitable site
P0 | Source: Present in source | Execution: PASS

**Given:** Measurements satisfy the configured package rules

**When:** Surveyor records and approves the survey

**Expected:** Sales can quote the approved package with the survey reference

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection

### SUR-05 New measurements after quote issuance
P0 | Source: Needs verification | Execution: PASS

**Given:** An unaccepted quote exists and roof measurements change

**When:** Surveyor records a new survey

**Expected:** Old approval cannot authorize a quote based on the new unreviewed measurements

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection

### SUR-06 Negative or impossible readings
P1 | Source: Needs verification | Execution: PASS

**Given:** A measurement is negative or outside configured bounds

**When:** Surveyor saves

**Expected:** The server rejects invalid values without partially storing the survey

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection

### SUR-07 Customer absent for survey
P1 | Source: Missing workflow | Execution: PASS

**Given:** A survey visit was confirmed

**When:** Surveyor records no access

**Expected:** The visit is not marked completed and a reschedule task is created

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [SUR-07 SUR-09 DSP-04] survey no-access remains explicit and leave-triggered crew reassignment preserves history; Passed: Operational exceptions and follow-through [SUR-07] surveyor no-access creates a real reschedule and customer-contact task without completing the visit

### SUR-08 Survey needs two workers
P1 | Source: Missing workflow | Execution: PASS

**Given:** Access requires an assistant under company policy

**When:** Coordinator schedules the survey

**Expected:** Both people must be available and the visit records the crew

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/repairs.spec.ts

**Observed:** Passed: Review regressions and real operational requests [SUR-08] two-worker survey stores both crew members and blocks both calendars; Passed: [SUR-08] coordinator books a two-person survey crew against the selected site (chromium); Passed: [SUR-08] coordinator books a two-person survey crew against the selected site (webkit)

### SUR-09 Rain prevents roof inspection
P1 | Source: Missing workflow | Execution: PASS

**Given:** A scheduled survey cannot safely proceed

**When:** Coordinator postpones with a reason

**Expected:** The original slot, reason and revised appointment remain in history

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [SUR-07 SUR-09 DSP-04] survey no-access remains explicit and leave-triggered crew reassignment preserves history

### SUR-10 Accepted system requested to change
P0 | Source: Partial | Execution: PASS

**Given:** An accepted order already exists

**When:** Staff tries to replace its survey or capacity

**Expected:** The original commercial record is protected and a change-order path is required

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection; Passed: [QUO-09 SUR-10] accepted-order additions use a linked survey-approved change order and bill only approved extras


## QUO Quotations acceptance and commercial changes

### QUO-01 Generate a package quote
P0 | Source: Present in source | Execution: PASS

**Given:** An approved survey selects a configured capacity and type

**When:** Sales issues a quote

**Expected:** Quantities, prices, warranty periods and total match the selected package version

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [QUO-01 PAY-01] package lines and totals carry through to one installation invoice

### QUO-02 Price changes after acceptance
P0 | Source: Present in source | Execution: PASS

**Given:** A customer has accepted a quote

**When:** The product list price changes

**Expected:** Accepted quote, order and invoice amounts remain unchanged

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [QUO-02 QUO-03 CON-01] acceptance is idempotent and material prices remain snapshots

### QUO-03 Customer accepts twice
P0 | Source: Present in source | Execution: PASS

**Given:** One quote is accepted successfully

**When:** The acceptance is retried

**Expected:** Only one order, installation invoice and job exist

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [QUO-02 QUO-03 CON-01] acceptance is idempotent and material prices remain snapshots

### QUO-04 Two staff accept simultaneously
P0 | Source: Needs verification | Execution: PASS

**Given:** Sales and administrator accept the same quote at once

**When:** Both requests reach the server

**Expected:** One commercial acceptance is committed without duplicate orders

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [QUO-04] concurrent customer acceptance produces one order, invoice and job

### QUO-05 Customer requests a discount
P1 | Source: Missing workflow | Execution: PASS

**Given:** An unaccepted quote exists

**When:** Sales requests a discount beyond their limit

**Expected:** An authorized approver and reason are required; original prices remain traceable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [QUO-05] discount ceiling and independent approval create a fresh quote without rewriting the original

### QUO-06 Customer accepts an older quote
P0 | Source: Partial | Execution: PASS

**Given:** A newer quote version has been issued

**When:** Acceptance references the older version

**Expected:** The selected version is explicit and stale acceptance is rejected or reviewed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Financial corrections and settlement [QUO-06 QUO-07] stale and expired quotations require a fresh reviewed version

### QUO-07 Quote expires before acceptance
P1 | Source: Missing workflow | Execution: PASS

**Given:** The quoted validity date has passed

**When:** Sales records acceptance

**Expected:** The quote must be renewed or an authorized exception recorded

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Financial corrections and settlement [QUO-06 QUO-07] stale and expired quotations require a fresh reviewed version

### QUO-08 Customer cancels after paying advance
P1 | Source: Missing workflow | Execution: PASS

**Given:** An order exists with money received

**When:** Staff initiates cancellation

**Expected:** A cancellation and refund workflow preserves the original invoice and releases eligible reservations

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [QUO-08] reviewed paid-order cancellation releases stock, credits the retained invoice and permits only the actual refundable amount

### QUO-09 Customer adds a battery after order acceptance
P1 | Source: Missing workflow | Execution: PASS

**Given:** The original package is frozen

**When:** Sales prepares a change order

**Expected:** Only the approved additional work is billed; the original invoice is not overwritten

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [QUO-09 SUR-10] accepted-order additions use a linked survey-approved change order and bill only approved extras

### QUO-10 Package unavailable for requested system
P0 | Source: Needs verification | Execution: PASS

**Given:** The chosen capacity and type have no active package

**When:** Sales issues a quote

**Expected:** A clear configuration error appears and no empty quote or order is created

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [QUO-10] unavailable package refuses an empty quote


## PAY Initial invoices and payments

### PAY-01 Initial installation invoice
P0 | Source: Present in source | Execution: PASS

**Given:** A customer accepts a component-and-installation quote

**When:** The system creates the invoice

**Expected:** Components and installation appear as distinct lines on one initial invoice

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [QUO-01 PAY-01] package lines and totals carry through to one installation invoice

### PAY-02 Advance below threshold
P0 | Source: Present in source | Execution: PASS

**Given:** An invoice has less than the configured advance received

**When:** Stock reservation is requested

**Expected:** Reservation is refused and the shortfall is clear

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [PAY-02 DLV-01 STK-06] blocks reservation before advance, incomplete scans and unknown serials

### PAY-03 Advance exactly at threshold
P0 | Source: Present in source | Execution: PASS

**Given:** Payment reaches the exact required advance

**When:** Stock reservation is requested

**Expected:** Reservation is allowed if stock is sufficient

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [PAY-03] exact required advance permits reservation

### PAY-04 Payment submitted twice
P0 | Source: Present in source | Execution: PASS

**Given:** A receipt has already been recorded

**When:** The same payment is retried

**Expected:** No duplicate collection is created

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries

### PAY-05 Payment exceeds outstanding amount
P0 | Source: Present in source | Execution: PASS

**Given:** Only INR 1000 is due

**When:** Staff tries to record INR 1001

**Expected:** The payment is rejected and the balance remains unchanged

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries

### PAY-06 Two payments race for final balance
P0 | Source: Needs verification | Execution: PASS

**Given:** Two cashiers submit payments against the same balance

**When:** Requests overlap

**Expected:** The committed sum never exceeds the permitted outstanding amount

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [PAY-06] two cashiers cannot collect the final balance twice

### PAY-07 UPI payment not actually settled
P1 | Source: Missing workflow | Execution: PASS

**Given:** A customer shows an unverified payment screenshot

**When:** Staff records payment status

**Expected:** A pending payment does not count as cleared advance until verified

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Financial corrections and settlement [PAY-07] pending receipts do not release stock and only finance can verify settlement

### PAY-08 Part payment against service bill
P0 | Source: Partial | Execution: PASS

**Given:** An issued service invoice has a balance

**When:** Accounts records part payment

**Expected:** Only that invoice balance falls and installation payment history remains intact

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-05 BIL-03 PAY-08] customer retail differs from acquisition cost and service part-payments leave initial invoice unchanged

### PAY-09 Incorrect payment needs reversal
P1 | Source: Missing workflow | Execution: PASS

**Given:** A confirmed receipt was entered by mistake

**When:** Accounts requests reversal

**Expected:** A traceable reversal is created without deleting historical receipts

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Financial corrections and settlement [PAY-09] reversing an incorrect receipt preserves history and reopens the balance once

### PAY-10 Two customers use the same reference text
P1 | Source: Needs verification | Execution: PASS

**Given:** Different invoices have independently valid receipts

**When:** Accounts records both

**Expected:** Uniqueness follows the documented receipt scope and does not merge customers

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [PAY-10] identical reference text on different invoices remains independently scoped


## STK Stock receipt and reservation

### STK-01 Receive serialized equipment
P0 | Source: Present in source | Execution: PASS

**Given:** Warehouse receives three new inverters with distinct serials

**When:** Staff saves the receipt

**Expected:** Three assets and the correct quantity and value are added atomically

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [STK-01 STK-09] receipt creates three distinct devices and scan normalizes case and spaces

### STK-02 Duplicate serial in a receipt
P0 | Source: Present in source | Execution: PASS

**Given:** A batch contains a serial already in stock

**When:** Staff saves the batch

**Expected:** The whole invalid receipt rolls back without inflating stock

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [STK-02] receipt rollback preserves stock when duplicate serials are submitted

### STK-03 Insufficient stock for full package
P0 | Source: Needs verification | Execution: PASS

**Given:** At least one required product is short

**When:** Warehouse reserves the order

**Expected:** No partial hidden reservation is left and shortages identify product and quantity

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [STK-03] insufficient package stock leaves no hidden partial reservation

### STK-04 Two orders compete for the last device
P0 | Source: Present in source | Execution: PASS

**Given:** One unreserved compatible serial remains

**When:** Both orders allocate it concurrently

**Expected:** At most one order owns the serial and the other receives a clear conflict

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [STK-04] concurrent allocations can never claim the same physical device twice

### STK-05 Wrong product scanned
P0 | Source: Present in source | Execution: PASS

**Given:** An inverter is required but a battery serial is scanned

**When:** Warehouse adds the serial

**Expected:** The scan is rejected without altering reservations or ownership

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [STK-05 STK-07] rejects a wrong product and duplicate serial scans

### STK-06 Unknown barcode scanned
P0 | Source: Present in source | Execution: PASS

**Given:** The serial has never been received

**When:** Warehouse scans it into packing

**Expected:** The app refuses the unknown identity rather than inventing stock

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [PAY-02 DLV-01 STK-06] blocks reservation before advance, incomplete scans and unknown serials

### STK-07 Duplicate scan on one order
P0 | Source: Present in source | Execution: PASS

**Given:** The device is already allocated to that order

**When:** It is scanned again

**Expected:** Required quantity and stock are not counted twice

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [STK-05 STK-07] rejects a wrong product and duplicate serial scans

### STK-08 Stock found damaged before dispatch
P0 | Source: Missing workflow | Execution: PASS

**Given:** A reserved device fails inspection

**When:** Warehouse marks it unusable

**Expected:** It is quarantined and a compatible substitute is allocated without double counting

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [STK-08] damaged allocated serial is quarantined and a substitute must be scanned before dispatch

### STK-09 Serial pasted with spaces and case changes
P1 | Source: Needs verification | Execution: PASS

**Given:** A saved serial is pasted with surrounding spaces or lower case

**When:** Warehouse submits the scan

**Expected:** Documented normalization locates the same device without creating a second identity

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [STK-01 STK-09] receipt creates three distinct devices and scan normalizes case and spaces

### STK-10 Stock correction after physical count
P1 | Source: Missing workflow | Execution: PASS

**Given:** A count differs from recorded quantity

**When:** Warehouse proposes adjustment

**Expected:** An authorized adjustment records reason, quantity and value without editing history

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/repairs.spec.ts

**Observed:** Passed: [STK-10] stock count needs a second reviewer, preserves reservations and rejects stale counts; Passed: [STK-10] warehouse count is reviewed separately by accounts through the desktop and phone interface (chromium); Passed: [STK-10] warehouse count is reviewed separately by accounts through the desktop and phone interface (webkit)


## DLV Packing delivery and warranty start

### DLV-01 Dispatch before every required scan
P0 | Source: Present in source | Execution: PASS

**Given:** A reserved order is missing one serialized device

**When:** Warehouse dispatches

**Expected:** Dispatch is refused with the missing item count

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [PAY-02 DLV-01 STK-06] blocks reservation before advance, incomplete scans and unknown serials

### DLV-02 Dispatch a complete packing list
P0 | Source: Present in source | Execution: PASS

**Given:** All required quantities and scans are present

**When:** Warehouse confirms dispatch

**Expected:** Equipment ownership and dispatch status change once with an audit record

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates

### DLV-03 Dispatch does not start warranty
P0 | Source: Present in source | Execution: PASS

**Given:** An order has left the warehouse but is undelivered

**When:** Support checks warranty dates

**Expected:** No delivery-based warranty has started yet

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates

### DLV-04 Delivery starts each line warranty
P0 | Source: Present in source | Execution: PASS

**Given:** The customer has received all equipment

**When:** Warehouse confirms delivery

**Expected:** Each covered component receives its own policy period from delivery time

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates

### DLV-05 Delivery is retried
P0 | Source: Present in source | Execution: PASS

**Given:** Delivery was recorded successfully

**When:** The same action is repeated

**Expected:** No extra warranty is created and original dates remain unchanged

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates

### DLV-06 Partial delivery
P1 | Source: Missing workflow | Execution: PASS

**Given:** Only inverter and some panels arrive

**When:** Staff records quantities received

**Expected:** Undelivered lines remain pending and warranty start follows the agreed per-line rule

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [DLV-06] separate line receipts start only received-component warranties and retain dates on retry

### DLV-07 Wrong customer receives equipment
P0 | Source: Missing workflow | Execution: PASS

**Given:** Driver discovers the wrong destination

**When:** Staff records a failed delivery

**Expected:** The intended customer is not marked delivered and custody is traceable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [DLV-07 DLV-09] failed destination and customer refusal preserve custody, block warranty and create follow-up tasks

### DLV-08 Transit damage
P1 | Source: Missing workflow | Execution: PASS

**Given:** A serial is damaged before customer acceptance

**When:** Warehouse records the incident

**Expected:** The damaged device is not commissioned and replacement delivery is tracked

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [DLV-08] transit-damaged device is quarantined, replacement shipment is reviewed and only the received replacement gains warranty

### DLV-09 Customer refuses delivery
P1 | Source: Missing workflow | Execution: PASS

**Given:** The customer does not accept the shipment

**When:** Warehouse records refusal

**Expected:** No false handover or warranty start occurs; a return task is opened

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [DLV-07 DLV-09] failed destination and customer refusal preserve custody, block warranty and create follow-up tasks

### DLV-10 Delivery time entered in another timezone
P1 | Source: Needs verification | Execution: PASS

**Given:** The office and device show different timezones

**When:** Delivery is viewed on both devices

**Expected:** One saved instant produces consistent policy start and expiry boundaries

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer follow-up and workflow compatibility [DLV-10] warranty instants are invariant when database session timezones differ


## SCH Availability search and workload

### SCH-01 Thirteen busy and two free
P0 | Source: Missing workflow | Execution: PASS

**Given:** Fixture F15 has 15 active technicians and 13 busy during the requested visit interval

**When:** Coordinator searches days 3 to 5

**Expected:** Only the two qualified available technicians are offered with actual times and reasons

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-01] fifteen dispatch workers, thirteen occupied and precisely two free in the demonstrated interval

### SCH-02 No worker free within target window
P0 | Source: Missing workflow | Execution: PASS

**Given:** All qualified workers are occupied on days 3 to 5

**When:** Coordinator searches

**Expected:** An unassigned escalation and earliest feasible alternative appear without a false promise

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/repairs.spec.ts

**Observed:** Passed: Capacity, payroll and workload verification [SCH-02 SCH-09] full working-day capacity returns explicit alternatives and Sunday is excluded; Passed: Operational exceptions and follow-through [SCH-02 SCH-09] full holiday window creates one persisted capacity task and returns working-day alternatives; Passed: [SCH-02 SCH-09] a holiday search shows alternatives and a tracked follow-up that can be completed (chromium); Passed: [SCH-02 SCH-09] a holiday search shows alternatives and a tracked follow-up that can be completed (webkit)

### SCH-03 Free worker lacks required skill
P0 | Source: Missing workflow | Execution: PASS

**Given:** One available worker lacks inverter skills

**When:** Coordinator searches for inverter repair

**Expected:** That worker is excluded or shown as ineligible with a reason

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking

### SCH-04 Leave overrides an empty calendar
P0 | Source: Missing workflow | Execution: PASS

**Given:** A worker has approved leave but no job that day

**When:** Availability is searched

**Expected:** The worker is not offered during leave

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking

### SCH-05 Travel consumes the apparent gap
P0 | Source: Missing workflow | Execution: PASS

**Given:** A worker has a one-hour calendar gap between distant sites

**When:** A one-hour visit is proposed

**Expected:** Travel buffers prevent an impossible booking

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-05 SCH-07 SCH-10] travel buffer and two coordinators racing for one worker

### SCH-06 Two jobs have overlapping times
P0 | Source: Present in source | Execution: PASS

**Given:** A technician has an existing installation

**When:** Another overlapping installation is assigned

**Expected:** The server refuses the overlap even if the UI submits it

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Field work and service [SCH-06 INS-06] blocks overlapping assignments and completion without saved evidence

### SCH-07 Adjacent visits at the same site
P1 | Source: Partial | Execution: PASS

**Given:** One visit ends exactly when the next begins

**When:** Coordinator books the second

**Expected:** Half-open intervals allow adjacency only when travel and handover buffers permit

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-05 SCH-07 SCH-10] travel buffer and two coordinators racing for one worker

### SCH-08 Customer available outside business hours
P1 | Source: Missing workflow | Execution: PASS

**Given:** Customer asks for a late-night routine visit

**When:** Coordinator searches

**Expected:** Out-of-hours handling follows a documented policy and does not silently book normal staff

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking

### SCH-09 Routine window crosses a holiday
P1 | Source: Missing workflow | Execution: PASS

**Given:** Day 3 is a configured nonworking day

**When:** Coordinator searches a routine visit

**Expected:** Working-day or calendar-day policy is explicit and eligible dates are shown

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/repairs.spec.ts

**Observed:** Passed: Capacity, payroll and workload verification [SCH-02 SCH-09] full working-day capacity returns explicit alternatives and Sunday is excluded; Passed: Operational exceptions and follow-through [SCH-02 SCH-09] full holiday window creates one persisted capacity task and returns working-day alternatives; Passed: [SCH-02 SCH-09] a holiday search shows alternatives and a tracked follow-up that can be completed (chromium); Passed: [SCH-02 SCH-09] a holiday search shows alternatives and a tracked follow-up that can be completed (webkit)

### SCH-10 Two coordinators choose the same free slot
P0 | Source: Partial | Execution: PASS

**Given:** Two requests target one technician at the same time

**When:** Both coordinators confirm

**Expected:** One booking succeeds and the other refreshes availability after an atomic conflict

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-05 SCH-07 SCH-10] travel buffer and two coordinators racing for one worker


## DSP Assignment changes and competing requests

### DSP-01 Twenty simultaneous customer calls
P0 | Source: Missing workflow | Execution: PASS

**Given:** Twenty independent requests arrive for the same 15-person team

**When:** Support saves them and coordinator opens the queue

**Expected:** All requests are uniquely recorded and none disappear because capacity is full

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DSP-01 SEC-08] twenty concurrent calls survive without appointments or shared identities

### DSP-02 One slot remains and two requests compete
P0 | Source: Missing workflow | Execution: PASS

**Given:** Two equally eligible jobs need the same worker

**When:** Coordinator applies ranking

**Expected:** Priority, target date, travel and stable tie-break reasons are visible; no silent starvation occurs

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [DSP-02] dispatch ranks aged requests and urgent targets, then suggests qualified crews by workload with travel and stable tie reasons

### DSP-03 Urgent repair interrupts routine planning
P0 | Source: Missing workflow | Execution: PASS

**Given:** A hazardous fault arrives after routine appointments are confirmed

**When:** Coordinator reviews escalation

**Expected:** Urgent work is escalated and displaced customers require explicit rescheduling

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [DSP-03] urgent fault creates human hazard escalation and displaced customers get explicit rescheduling and contact tasks

### DSP-04 Technician becomes sick after assignment
P0 | Source: Missing workflow | Execution: PASS

**Given:** Tomorrow's worker becomes unavailable

**When:** Coordinator reassigns the visit

**Expected:** Replacement eligibility is checked and both assignment history and customer contact task are retained

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [SUR-07 SUR-09 DSP-04] survey no-access remains explicit and leave-triggered crew reassignment preserves history; Passed: Operational exceptions and follow-through [DSP-04] sick-worker reassignment retains a tracked customer-contact task with an audited outcome

### DSP-05 Customer requests another date
P0 | Source: Missing workflow | Execution: PASS

**Given:** A confirmed repair appointment exists

**When:** Support records a reschedule request

**Expected:** Old capacity is released only when the replacement arrangement is safely committed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DSP-05 DSP-09 CON-07] rescheduling releases old time atomically, rejects stale revision and supports retry

### DSP-06 Job overruns planned duration
P0 | Source: Missing workflow | Execution: PASS

**Given:** A technician remains at the current site

**When:** Coordinator extends the visit

**Expected:** Affected later appointments are flagged instead of silently overlapping

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Operational exceptions and follow-through [DSP-06] an actual overrun flags downstream appointments and customer contact without silently moving them

### DSP-07 Technician declines an unsuitable job
P1 | Source: Missing workflow | Execution: PASS

**Given:** A worker has been assigned outside capability

**When:** Worker declines with reason

**Expected:** The task returns to the coordinator queue and is not marked completed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Operational exceptions and follow-through [DSP-07 DSP-08] overdue acknowledgement is actionable, acknowledgement clears it, and decline returns work to dispatch

### DSP-08 Technician cannot be contacted
P1 | Source: Missing workflow | Execution: PASS

**Given:** A confirmed worker has not acknowledged the visit

**When:** The acknowledgement deadline passes

**Expected:** The coordinator receives an actionable exception without auto-closing the request

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Operational exceptions and follow-through [DSP-07 DSP-08] overdue acknowledgement is actionable, acknowledgement clears it, and decline returns work to dispatch

### DSP-09 Assignment retry after network timeout
P0 | Source: Partial | Execution: PASS

**Given:** Booking committed but the response was lost

**When:** Coordinator repeats the command

**Expected:** One assignment exists and capacity is not held twice

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DSP-05 DSP-09 CON-07] rescheduling releases old time atomically, rejects stale revision and supports retry

### DSP-10 Search result becomes stale
P0 | Source: Partial | Execution: PASS

**Given:** Availability was viewed before a new booking or leave record

**When:** Coordinator confirms the old suggestion

**Expected:** The server rechecks all constraints at confirmation time

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking


## INS Installation crews and field work

### INS-01 Only assigned installer sees work
P0 | Source: Present in source | Execution: PASS

**Given:** Two technicians own different installations

**When:** One opens the other's project or evidence URL

**Expected:** The server denies access and the user's own list stays usable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost

### INS-02 Start before delivery
P0 | Source: Present in source | Execution: PASS

**Given:** An installation is scheduled but equipment is undelivered

**When:** Installer starts work

**Expected:** The server blocks starting and identifies the missing delivery

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost

### INS-03 Two-person installation crew
P0 | Source: Missing workflow | Execution: PASS

**Given:** A roof job requires a lead and an assistant

**When:** Coordinator assigns the crew

**Expected:** Both memberships and time reservations are stored and both see the assigned work

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost

### INS-04 Lead and assistant have different powers
P1 | Source: Missing workflow | Execution: PASS

**Given:** A two-person crew is assigned

**When:** Assistant tries final sign-off

**Expected:** Only a qualified lead or authorized supervisor can approve the handover

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost

### INS-05 Safety checklist incomplete
P0 | Source: Present in source | Execution: PASS

**Given:** One required commissioning check is false

**When:** Installer completes the job

**Expected:** Completion is blocked without falsely marking the project installed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost

### INS-06 Missing installation evidence
P0 | Source: Present in source | Execution: PASS

**Given:** A started job has no saved photo or signature

**When:** Installer completes

**Expected:** Completion is blocked until required evidence has been saved

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Field work and service [SCH-06 INS-06] blocks overlapping assignments and completion without saved evidence

### INS-07 Actual hours differ from scheduled hours
P0 | Source: Partial | Execution: PASS

**Given:** A four-hour appointment takes six hours

**When:** Lead submits actual time

**Expected:** Actual labour cost uses saved rates and actual time; schedule and billable time are distinguished

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost

### INS-08 Multiple crew members record time
P1 | Source: Missing workflow | Execution: PASS

**Given:** Two workers spend different hours at the site

**When:** The crew submits work

**Expected:** Costs and payables are calculated per worker without double counting

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost; Passed: Capacity, payroll and workload verification [INS-08] individual crew payout does not pay the other worker or duplicate the first payment

### INS-09 Customer refuses installation sign-off
P0 | Source: Missing workflow | Execution: PASS

**Given:** Checks pass but customer disputes the work

**When:** Lead records the disagreement

**Expected:** Work awaits review and a fabricated signature or automatic closure is forbidden

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Reviewed service exceptions [INS-09] disputed installation handover creates review and cannot complete using an invented signature

### INS-10 Installed system differs from accepted capacity
P1 | Source: Needs verification | Execution: PASS

**Given:** The measured or installed capacity differs materially

**When:** Installer submits handover

**Expected:** A discrepancy is flagged for authorized review before final acceptance

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final billing and intake guards [INS-10] material capacity discrepancy blocks handover for review


## SRV Repair calls and service visits

### SRV-01 Complaint before faulty part is known
P0 | Source: Missing workflow | Execution: PASS

**Given:** A customer reports low output but cannot name a component

**When:** Support creates a repair request

**Expected:** A customer-and-site ticket can be saved without guessing a warranty or faulty asset

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access

### SRV-02 Assigned repair worker gets full installed list
P0 | Source: Missing workflow | Execution: PASS

**Given:** A coordinator assigns a repair visit

**When:** The technician opens it

**Expected:** Installed quantities, serials, locations, delivery dates, warranty terms and repair history load for that site

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access

### SRV-03 Technician changes between original install and repair
P0 | Source: Missing workflow | Execution: PASS

**Given:** A different qualified worker receives the repair visit

**When:** They open the customer project

**Expected:** Repair assignment grants necessary site access without exposing every customer

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access

### SRV-04 Two open faults at one customer
P0 | Source: Missing workflow | Execution: PASS

**Given:** An inverter warning and damaged cable are separately reported

**When:** Support reviews open requests

**Expected:** Distinct faults can coexist and duplicate detection suggests linking related work

**Evidence:** tests/e2e/repairs.spec.ts

**Observed:** Passed: [SRV-04 SRV-06] support sees possible duplicate work and a separate coordinator reviews safe remote resolution (chromium); Passed: [SRV-04 SRV-06] support sees possible duplicate work and a separate coordinator reviews safe remote resolution (webkit)

### SRV-05 Repeated call about same unresolved fault
P1 | Source: Missing workflow | Execution: PASS

**Given:** An existing open complaint matches the site and symptom

**When:** Support records the call

**Expected:** It appends contact history or links the duplicate without losing either caller report

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer follow-up and workflow compatibility [SRV-05 SEC-06] coordinator has explicit call intake powers and support can append a repeated call without duplicating work

### SRV-06 Remote fix avoids a visit
P1 | Source: Policy decision | Execution: PASS

**Given:** A permitted nonhazardous issue is resolved by guided support

**When:** Support documents resolution and customer confirmation

**Expected:** The case records remote resolution and no fake onsite photos or visit hours are created

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/repairs.spec.ts

**Observed:** Passed: Reviewed service exceptions [SRV-06] reviewed safe remote resolution records customer confirmation without onsite work or charges; Passed: [SRV-04 SRV-06] support sees possible duplicate work and a separate coordinator reviews safe remote resolution (chromium); Passed: [SRV-04 SRV-06] support sees possible duplicate work and a separate coordinator reviews safe remote resolution (webkit)

### SRV-07 Repair cancelled before attendance
P1 | Source: Missing workflow | Execution: PASS

**Given:** Customer withdraws the request

**When:** Support cancels

**Expected:** The visit slot and reserved parts are released with a reason and history

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SRV-07] support cancellation releases appointment and records reason

### SRV-08 First visit diagnoses but cannot fix
P0 | Source: Missing workflow | Execution: PASS

**Given:** A specialist part is required

**When:** Technician completes diagnosis only

**Expected:** The case stays open with a separate return visit and parts task

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SRV-08 SRV-09 EVD-08] no access and waiting-for-parts preserve open work; a customer dispute prevents closure; Passed: [RMA-07 SRV-08] unavailable parts block a promised return visit until replenishment and warehouse readiness

### SRV-09 Customer unavailable at repair visit
P1 | Source: Missing workflow | Execution: PASS

**Given:** Technician arrives but cannot access the property

**When:** Technician records failed attendance

**Expected:** The ticket stays unresolved and rescheduling or a reviewed callout charge follows policy

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SRV-08 SRV-09 EVD-08] no access and waiting-for-parts preserve open work; a customer dispute prevents closure

### SRV-10 Customer calls after alleged repair failed
P0 | Source: Missing workflow | Execution: PASS

**Given:** A closed issue recurs

**When:** Support opens a linked follow-up

**Expected:** Original evidence and charges remain immutable and repeat-fault history is visible

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer follow-up and workflow compatibility [SRV-10 RMA-08] failed replacement follow-up retains both identities, original bill and evidence


## DIA Diagnosis and component selection

### DIA-01 Select multiple faulty installed components
P0 | Source: Missing workflow | Execution: PASS

**Given:** The asset list includes an inverter and a controller

**When:** Technician marks both faulty

**Expected:** Separate diagnosis lines retain component identity, quantity and coverage decision

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost

### DIA-02 Select another customer's serial
P0 | Source: Missing workflow | Execution: PASS

**Given:** A serial belongs to another installation

**When:** Technician tries adding it to diagnosis

**Expected:** The server rejects the cross-customer component

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-02 DIA-03 CON-03] foreign component, excessive quantity and stale diagnosis are rejected

### DIA-03 Diagnose a quantity-tracked panel
P0 | Source: Missing workflow | Execution: PASS

**Given:** Panels were tracked by quantity rather than unique serial

**When:** Technician selects one faulty panel

**Expected:** Affected quantity is bounded by installed quantity and references the original order line

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-02 DIA-03 CON-03] foreign component, excessive quantity and stale diagnosis are rejected

### DIA-04 Part not supplied by this company
P1 | Source: Missing workflow | Execution: PASS

**Given:** A third-party component caused the symptom

**When:** Technician records the external part

**Expected:** It is clearly marked external and is not automatically covered by an unrelated company warranty

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: External equipment and independent supplier claims [DIA-04] third-party equipment is recorded without creating company entitlement

### DIA-05 No fault found
P1 | Source: Missing workflow | Execution: PASS

**Given:** Diagnostics pass and no component is marked faulty

**When:** Technician records observations

**Expected:** The visit can close under a reviewed no-fault policy without fabricating a replacement

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Reviewed service exceptions [DIA-05] no-fault onsite findings need a photo and separate review, with zero charge and no replacement

### DIA-06 Diagnosis changes before approval
P0 | Source: Missing workflow | Execution: PASS

**Given:** A previously selected component is found healthy

**When:** Technician revises the draft diagnosis

**Expected:** Draft bill and parts reservation refresh while the revision history is retained

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-06 BIL-06] editing diagnosis invalidates approval and unapproved work cannot create an invoice

### DIA-07 Diagnosis changes after billing
P0 | Source: Missing workflow | Execution: PASS

**Given:** A service invoice is already issued

**When:** Staff tries editing the fault selection

**Expected:** Issued lines remain frozen; correction uses a reviewed revision or credit workflow

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Financial corrections and settlement [BIL-08 DIA-07] reviewed credits and replacement invoices preserve original charges and bound refunds; Passed: Final concurrency and revision checks [EVD-06 EVD-09 DIA-07] changed diagnosis invalidates earlier evidence and issued work cannot be edited or erased

### DIA-08 Customer disputes diagnosis
P0 | Source: Missing workflow | Execution: PASS

**Given:** Customer declines the proposed replacement

**When:** Support records disagreement

**Expected:** No chargeable work starts without the required approval and the dispute remains visible

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer follow-up and workflow compatibility [DIA-08] declined diagnosis stays disputed with no invoice or unapproved replacement

### DIA-09 One of many panels is replaced repeatedly
P1 | Source: Missing workflow | Execution: PASS

**Given:** A quantity-tracked line has several panels

**When:** Technician records successive replacements

**Expected:** Cumulative replacement quantities do not exceed identifiable entitlement without review

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Reviewed service exceptions [DIA-09] cumulative quantity replacements require explicit coordinator entitlement review beyond installed count

### DIA-10 Retired serial selected again
P0 | Source: Present in source | Execution: PASS

**Given:** An old device is marked replaced

**When:** Support opens a new fault against it

**Expected:** The app directs staff to the current replacement identity and retains old history

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Field work and service [DIA-10] traces replacement serials and preserves the original warranty dates


## WAR Coverage decisions per component

### WAR-01 Covered component at ticket opening
P0 | Source: Present in source | Execution: PASS

**Given:** A delivered device is within its warranty period

**When:** Support opens the corresponding ticket

**Expected:** Coverage decision and reason use saved delivery and expiry dates

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit

### WAR-02 Expired component at ticket opening
P0 | Source: Present in source | Execution: PASS

**Given:** The device warranty expired before the complaint

**When:** Support opens the ticket

**Expected:** It is not treated as covered solely because other system parts remain covered

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit

### WAR-03 Different cover within the same system
P0 | Source: Missing workflow | Execution: PASS

**Given:** Panel warranty is active but inverter warranty expired

**When:** Technician selects both faulty components

**Expected:** Each line gets an independent decision and the whole ticket is not globally free or charged

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost

### WAR-04 Exact expiry boundary
P0 | Source: Needs verification | Execution: PASS

**Given:** The complaint arrives exactly at expiry

**When:** Coverage is evaluated

**Expected:** The agreed exclusive expiry rule is consistently applied in the server and shown to staff

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit

### WAR-05 Warranty expires before the booked visit
P0 | Source: Partial | Execution: PASS

**Given:** Complaint was recorded while cover was active

**When:** Technician visits five days later

**Expected:** Coverage follows the documented complaint-date rule unless a reviewed exclusion applies

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit

### WAR-06 Excluded accidental damage
P0 | Source: Missing workflow | Execution: PASS

**Given:** A device is within time cover but diagnosis shows an excluded cause

**When:** Authorized reviewer considers evidence

**Expected:** Coverage is not auto-approved by date alone; reason, reviewer and evidence are saved

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion

### WAR-07 Unknown or missing policy
P0 | Source: Missing workflow | Execution: PASS

**Given:** Imported equipment has no reliable policy dates

**When:** Staff attempts automatic billing

**Expected:** The line is pending review rather than silently free or chargeable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final billing and intake guards [WAR-07] missing promised policy requires a reviewed decision, never silent billing

### WAR-08 Parts covered but labour excluded
P0 | Source: Missing workflow | Execution: PASS

**Given:** The policy covers an inverter but not callout labour

**When:** The repair is priced

**Expected:** Part charge is zero while approved labour is billed separately

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [WAR-08 BIL-04] covered parts can have approved charged labour and callout, while full cover credits all three

### WAR-09 Manufacturer reimbursement differs from customer cover
P1 | Source: Missing workflow | Execution: PASS

**Given:** Company promises cover while supplier claim is disputed

**When:** Accounts reviews the repair

**Expected:** Customer entitlement remains independent of the supplier recovery balance

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: External equipment and independent supplier claims [WAR-09 RMA-09] supplier custody, disputed decisions and bounded recoveries do not change customer cover or invoices

### WAR-10 Warranty override
P0 | Source: Missing workflow | Execution: PASS

**Given:** An authorized manager grants goodwill or corrects a coverage decision

**When:** The override is saved

**Expected:** Original decision, new decision, reason and actor are retained; technician cannot self-approve

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion


## RMA Replacement returns and supplier handling

### RMA-01 Compatible replacement in stock
P0 | Source: Partial | Execution: PASS

**Given:** A diagnosed serial has a matching available replacement

**When:** Authorized staff confirms replacement

**Expected:** Old and new identities link, stock reduces once and inherited warranty remains traceable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure

### RMA-02 Replacement uses an allocated serial
P0 | Source: Present in source | Execution: PASS

**Given:** A candidate replacement is reserved for another order

**When:** Staff tries the substitution

**Expected:** The server refuses without stealing stock from the other customer

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [RMA-02 RMA-03] replacement cannot use wrong model or device allocated to another customer

### RMA-03 Replacement is a different product
P0 | Source: Present in source | Execution: PASS

**Given:** A wrong inverter model is scanned

**When:** Replacement is submitted

**Expected:** The server rejects incompatible substitution without changing either device

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [RMA-02 RMA-03] replacement cannot use wrong model or device allocated to another customer

### RMA-04 Different compatible model approved
P1 | Source: Missing workflow | Execution: PASS

**Given:** Original model is discontinued

**When:** Manager approves an engineering-compatible substitute

**Expected:** Compatibility, customer agreement and any price adjustment are explicit and auditable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [RMA-04] different-model replacement needs engineering and customer agreement and preserves the original warranty

### RMA-05 Faulty part returned to warehouse
P0 | Source: Missing workflow | Execution: PASS

**Given:** Technician removes a failed device onsite

**When:** Warehouse receives its return

**Expected:** Custody changes to quarantine, never saleable Available stock

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure

### RMA-06 Faulty part not yet returned
P1 | Source: Missing workflow | Execution: PASS

**Given:** A new part was issued but old part is still onsite

**When:** Coordinator reviews pending returns

**Expected:** An outstanding-return task remains visible without falsifying receipt

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure

### RMA-07 No replacement stock available
P0 | Source: Missing workflow | Execution: PASS

**Given:** Diagnosis needs an unavailable part

**When:** Staff schedules follow-up

**Expected:** The case shows waiting for parts and does not promise a completion date as confirmed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: [RMA-07 SRV-08] unavailable parts block a promised return visit until replenishment and warehouse readiness

### RMA-08 Replacement fails immediately
P1 | Source: Missing workflow | Execution: PASS

**Given:** A newly fitted replacement does not work

**When:** Technician records another failure

**Expected:** Both serials and failure events remain visible without losing original warranty lineage

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer follow-up and workflow compatibility [SRV-10 RMA-08] failed replacement follow-up retains both identities, original bill and evidence

### RMA-09 Supplier accepts or rejects claim
P1 | Source: Missing workflow | Execution: PASS

**Given:** A quarantined device was sent to supplier

**When:** Warehouse records supplier decision

**Expected:** Supplier credit or returned stock follows its own record and does not rewrite the customer's invoice

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: External equipment and independent supplier claims [WAR-09 RMA-09] supplier custody, disputed decisions and bounded recoveries do not change customer cover or invoices

### RMA-10 Replacement retains original coverage
P0 | Source: Present in source | Execution: PASS

**Given:** A covered device is replaced near expiry

**When:** Support checks the new serial

**Expected:** The documented inherited-date policy applies rather than silently granting a new full term

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure


## BIL Repair estimates and service invoices

### BIL-01 Covered replacement shown at zero
P0 | Source: Missing workflow | Execution: PASS

**Given:** A covered inverter is replaced

**When:** A service document is issued

**Expected:** The replacement name, quantity and serials appear with INR 0 customer charge and a coverage reason

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure

### BIL-02 Mixed coverage service bill
P0 | Source: Missing workflow | Execution: PASS

**Given:** One covered inverter and two chargeable connectors are replaced

**When:** The approved repair is invoiced

**Expected:** All lines are visible and only uncovered items plus approved labour and travel are payable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost

### BIL-03 Separate service invoice from original sale
P0 | Source: Partial | Execution: PASS

**Given:** An installation invoice already exists

**When:** A later paid repair is resolved

**Expected:** A separately numbered linked service invoice is created; initial lines remain unchanged

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-05 BIL-03 PAY-08] customer retail differs from acquisition cost and service part-payments leave initial invoice unchanged

### BIL-04 All repair lines covered
P0 | Source: Missing workflow | Execution: PASS

**Given:** Every part and labour line is covered

**When:** Service is completed

**Expected:** A zero-payable service statement records the work; no payment is demanded

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure; Passed: Review regressions and real operational requests [WAR-08 BIL-04] covered parts can have approved charged labour and callout, while full cover credits all three

### BIL-05 Internal cost differs from selling price
P0 | Source: Missing workflow | Execution: PASS

**Given:** A replacement cost the company INR 14000 but agreed retail is INR 18000

**When:** An uncovered repair is invoiced

**Expected:** Customer charge uses approved selling price; internal cost remains separately reportable

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-05 BIL-03 PAY-08] customer retail differs from acquisition cost and service part-payments leave initial invoice unchanged

### BIL-06 Customer rejects paid estimate
P0 | Source: Missing workflow | Execution: PASS

**Given:** An uncovered repair estimate awaits consent

**When:** Customer declines

**Expected:** No chargeable replacement is executed or invoiced as accepted work

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-06 BIL-06] editing diagnosis invalidates approval and unapproved work cannot create an invoice

### BIL-07 Resolution retried after timeout
P0 | Source: Partial | Execution: PASS

**Given:** Repair and invoice committed but response was lost

**When:** The request is retried

**Expected:** No second replacement, stock movement or service invoice is created

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure

### BIL-08 Invoice correction after issue
P1 | Source: Missing workflow | Execution: PASS

**Given:** A service bill has an incorrect approved line

**When:** Accounts corrects it

**Expected:** An authorized credit or revised document links back without overwriting issued history

**Evidence:** tests/integration/lifecycle.test.ts; tests/e2e/repairs.spec.ts

**Observed:** Passed: Financial corrections and settlement [BIL-08 DIA-07] reviewed credits and replacement invoices preserve original charges and bound refunds; Passed: [BIL-08] invoice correction needs a second reviewer and displays the retained original and credit (chromium); Passed: [BIL-08] invoice correction needs a second reviewer and displays the retained original and credit (webkit)

### BIL-09 Financial totals for mixed repair
P0 | Source: Missing workflow | Execution: PASS

**Given:** Worked fixture MIX1 totals INR 1700 customer payable

**When:** Accounts views invoice and report

**Expected:** Invoice lines total 1700; covered costs remain company costs and are not recorded as zero cost

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost

### BIL-10 Tax and warranty document treatment unconfigured
P1 | Source: Policy decision | Execution: PASS

**Given:** The app has no verified tax configuration

**When:** Staff prints a service bill

**Expected:** It is labelled as a demo service statement and does not claim legally compliant tax invoicing

**Evidence:** tests/e2e/repairs.spec.ts

**Observed:** Passed: [CRM-09 BIL-10 UXP-08] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (chromium); Passed: [CRM-09 BIL-10 UXP-08] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (webkit)


## EVD Repair photos completion and confirmation

### EVD-01 After-repair photo required
P0 | Source: Missing workflow | Execution: PASS

**Given:** An onsite repair has no saved completion photo

**When:** Technician marks the visit complete

**Expected:** Completion is blocked until a valid visit-linked photo is saved

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [EVD-01] valid diagnosis and approval still cannot complete without this visit photo

### EVD-02 Diagnosis photo linked to faulty item
P0 | Source: Missing workflow | Execution: PASS

**Given:** Several components were inspected

**When:** Technician attaches a fault photo

**Expected:** The photo links to the correct visit and component rather than a generic customer album

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Component photo evidence [EVD-02 EVD-04] component-linked uploads reject foreign assets and concurrent retries store one private image

### EVD-03 Wrong file masquerades as photo
P0 | Source: Partial | Execution: PASS

**Given:** An executable is renamed to JPG

**When:** Technician uploads evidence

**Expected:** Content validation rejects it and no downloadable unsafe file is stored

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [EVD-03 EVD-10] disguised executable rejected and private evidence cannot be opened anonymously

### EVD-04 Upload loses connection midway
P1 | Source: Missing workflow | Execution: PASS

**Given:** A repair photo upload is interrupted

**When:** Technician retries

**Expected:** No partial image is treated as evidence; retry creates one usable record

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Component photo evidence [EVD-02 EVD-04] component-linked uploads reject foreign assets and concurrent retries store one private image; Passed: Storage and transport failures [EVD-04] an interrupted HTTP upload creates no evidence and a complete retry stores one usable photo

### EVD-05 Device permission denied
P1 | Source: Partial | Execution: BLOCKED

**Given:** Technician denies camera permission

**When:** They need to attach completion evidence

**Expected:** A clear explanation and permitted file-picker alternative are offered

**Evidence:** Current source review against docs/scenarios/catalog-source.txt; any partial runtime evidence is retained separately.

**Observed:** A file picker is available; camera-denial recovery still needs a physical-device test.

### EVD-06 Customer signs before final changes
P0 | Source: Missing workflow | Execution: PASS

**Given:** A signed service report is later changed

**When:** Staff edits charge or replaced component

**Expected:** Signature is invalidated for the changed version and fresh confirmation is requested

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [EVD-06 EVD-09 DIA-07] changed diagnosis invalidates earlier evidence and issued work cannot be edited or erased

### EVD-07 Customer confirms by phone
P1 | Source: Partial | Execution: PASS

**Given:** Customer cannot sign onsite but accepts the result by phone

**When:** Support records confirmation

**Expected:** Method, actor, time and stated confirmer are saved without pretending a handwritten signature exists

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure

### EVD-08 Customer disputes closure
P0 | Source: Missing workflow | Execution: PASS

**Given:** Technician marks work done but customer reports failure

**When:** Support records the dispute

**Expected:** Case remains awaiting review and is not silently counted as customer-confirmed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SRV-08 SRV-09 EVD-08] no access and waiting-for-parts preserve open work; a customer dispute prevents closure

### EVD-09 Technician attempts to erase evidence
P0 | Source: Missing workflow | Execution: PASS

**Given:** A photo belongs to an issued report

**When:** Worker tries replacing or deleting it

**Expected:** Issued evidence history remains protected and any correction is versioned

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [EVD-06 EVD-09 DIA-07] changed diagnosis invalidates earlier evidence and issued work cannot be edited or erased

### EVD-10 Unauthenticated person opens a photo URL
P0 | Source: Present in source | Execution: PASS

**Given:** A private image URL is copied outside the staff session

**When:** Visitor requests the image

**Expected:** The server denies private evidence access

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [EVD-03 EVD-10] disguised executable rejected and private evidence cannot be opened anonymously


## SEC Roles staffing and access boundaries

### SEC-01 Support creates installation request
P0 | Source: Missing workflow | Execution: PASS

**Given:** Support has a verified customer call

**When:** They open New enquiry and submit

**Expected:** Support can create intake without gaining price, stock or payout authority

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [INT-01 SEC-01] support creates audited installation intake without gaining stock or finance authority

### SEC-02 Coordinator manages visits
P0 | Source: Missing workflow | Execution: PASS

**Given:** A service coordinator has no finance role

**When:** They search and assign workers

**Expected:** Scheduling is allowed while invoice edits and staff payouts remain denied

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion

### SEC-03 Technician sees assigned repair only
P0 | Source: Missing workflow | Execution: PASS

**Given:** Two workers have different repair visits

**When:** One requests the other visit ID

**Expected:** Server rejects unrelated details and photos even through direct URLs

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access

### SEC-04 Warehouse cannot approve customer discount
P0 | Source: Partial | Execution: PASS

**Given:** Warehouse has stock permissions

**When:** They call a quote or discount approval action

**Expected:** The server denies the action regardless of hidden UI controls

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SEC-04 SEC-07 SEC-10] admin access changes take effect on open sessions and flag assigned work

### SEC-05 Accounts cannot fake technical completion
P0 | Source: Missing workflow | Execution: PASS

**Given:** Accounts can invoice but is not the assigned worker

**When:** They call repair completion

**Expected:** Technical completion is denied while authorized payment work stays available

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion

### SEC-06 One employee covers two duties
P1 | Source: Missing workflow | Execution: PASS

**Given:** A small company has a coordinator who also answers calls

**When:** Administrator grants defined capabilities

**Expected:** Permissions are explicit and audited without sharing another person's password

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer follow-up and workflow compatibility [SRV-05 SEC-06] coordinator has explicit call intake powers and support can append a repeated call without duplicating work

### SEC-07 Employee leaves the company
P0 | Source: Partial | Execution: PASS

**Given:** A staff account has active sessions and future visits

**When:** Administrator deactivates the person

**Expected:** Sessions become unusable and affected appointments enter reassignment review

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SEC-04 SEC-07 SEC-10] admin access changes take effect on open sessions and flag assigned work

### SEC-08 Two support agents work concurrently
P0 | Source: Partial | Execution: PASS

**Given:** Support team contains two named users

**When:** Both record different callers

**Expected:** Separate actor identities are retained; no shared login is required

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DSP-01 SEC-08] twenty concurrent calls survive without appointments or shared identities

### SEC-09 Only administrator sees staff directory
P0 | Source: Present in source | Execution: PASS

**Given:** A nonadmin staff member opens Team or its API

**When:** The request is made directly

**Expected:** The server refuses access to the administrative directory

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Session and authorization [SEC-09] protects the staff directory and complete barcode library by role

### SEC-10 Permission changed while screen is open
P0 | Source: Needs verification | Execution: PASS

**Given:** A user loses a permission after loading a form

**When:** They submit the old form

**Expected:** Current server permissions win and the operation is denied

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [SEC-04 SEC-07 SEC-10] admin access changes take effect on open sessions and flag assigned work


## CON Concurrency retry and integrity

### CON-01 Same idempotency key same request
P0 | Source: Present in source | Execution: PASS

**Given:** A command completed and its response was lost

**When:** Client repeats identical data and key

**Expected:** The saved result returns without repeating business effects

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [QUO-02 QUO-03 CON-01] acceptance is idempotent and material prices remain snapshots

### CON-02 Same idempotency key changed request
P0 | Source: Present in source | Execution: PASS

**Given:** A key was used for one command body

**When:** Client submits changed data with that key

**Expected:** The server rejects the conflicting retry

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries

### CON-03 Two workers diagnose same service visit
P0 | Source: Missing workflow | Execution: PASS

**Given:** Both opened the same draft revision

**When:** They submit different component findings

**Expected:** A version conflict is shown instead of losing either diagnosis silently

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DIA-02 DIA-03 CON-03] foreign component, excessive quantity and stale diagnosis are rejected

### CON-04 Two repair tickets replace the same original
P0 | Source: Needs verification | Execution: PASS

**Given:** Two open tickets reference one delivered serial

**When:** Both try a replacement concurrently

**Expected:** Only one replacement succeeds and the other detects the changed original state

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [CON-04] competing tickets cannot replace one original device twice

### CON-05 Reservation races with service replacement
P0 | Source: Needs verification | Execution: PASS

**Given:** One unreserved serial is needed by both workflows

**When:** Both commands execute together

**Expected:** Stock, reservation and replacement ownership remain consistent

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [CON-05] last unreserved device cannot be promised to both sale and replacement

### CON-06 Failure after stock update before invoice
P0 | Source: Needs verification | Execution: PASS

**Given:** A database error occurs during repair resolution

**When:** The transaction aborts

**Expected:** Stock, old serial, warranty, ticket and invoice all roll back together

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [CON-06] database failure after replacement changes rolls back stock, original serial, invoice and ticket together

### CON-07 Two coordinators reschedule the same visit
P0 | Source: Missing workflow | Execution: PASS

**Given:** Both opened the same appointment revision

**When:** They confirm different times

**Expected:** One coherent appointment remains and the stale change is rejected

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Review regressions and real operational requests [DSP-05 DSP-09 CON-07] rescheduling releases old time atomically, rejects stale revision and supports retry

### CON-08 Payment response lost after commit
P0 | Source: Present in source | Execution: PASS

**Given:** The payment was saved but client times out

**When:** Staff uses retry with the original key

**Expected:** One receipt remains and the UI recovers the committed outcome

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries

### CON-09 Double tap completion
P0 | Source: Needs verification | Execution: PASS

**Given:** A technician taps Complete twice rapidly

**When:** Both requests reach the server

**Expected:** One handover and one payable cost record exist

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost

### CON-10 Database rejects a foreign identifier
P0 | Source: Needs verification | Execution: PASS

**Given:** An action references a deleted or nonexistent record

**When:** The request is submitted

**Expected:** A controlled error is returned and no orphan business records appear

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Additional acceptance boundaries [CON-10] nonexistent record yields controlled error without an orphan ticket


## OPS Reliability reporting and recovery

### OPS-01 Server restarts after saved action
P0 | Source: Present in source | Execution: PASS

**Given:** A committed project and session exist

**When:** The API process restarts

**Expected:** Saved work remains and valid session behavior follows configured persistence

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Field work and service [OPS-01] persists committed data across a new application instance

### OPS-02 Database connection fails during save
P0 | Source: Needs verification | Execution: PASS

**Given:** The database becomes unreachable

**When:** Staff submits a command

**Expected:** No success is shown and retry cannot duplicate a partially committed action

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Storage and transport failures [OPS-02] a real database connection loss rolls back intake and the same retry creates one record

### OPS-03 Evidence disk is full
P0 | Source: Needs verification | Execution: PASS

**Given:** Metadata storage works but file storage cannot write

**When:** Technician uploads

**Expected:** The app reports failure and does not record nonexistent evidence as saved

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Storage and transport failures [OPS-03] injected disk-full write removes a partial file and never creates evidence metadata

### OPS-04 Restore a backup
P0 | Source: Needs verification | Execution: PASS

**Given:** A backup includes database and private files

**When:** The application is restored to a separate environment

**Expected:** Records and evidence links reconcile and restored totals match the backup checkpoint

**Evidence:** scripts/check-backup-restore.ts

**Observed:** Passed: [OPS-04] PostgreSQL dump and restore, financial totals and private photo bytes

### OPS-05 Dashboard distinguishes backlog from active work
P1 | Source: Missing workflow | Execution: PASS

**Given:** Many requests are waiting for parts or appointments

**When:** Coordinator opens Home

**Expected:** Counts separate unassigned, scheduled, blocked, in-progress and overdue visits

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Capacity, payroll and workload verification [OPS-05] work queue distinguishes new, scheduled, active, blocked and awaiting-confirmation work

### OPS-06 Report distinguishes cash and profit
P0 | Source: Present in source | Execution: PASS

**Given:** An invoice is unpaid or only partly paid

**When:** Accounts opens reports

**Expected:** Cash collected, outstanding and completed contribution are separate figures

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Field work and service [OPS-06] reconciles report amounts against invoice, material and labour records

### OPS-07 Covered repair still costs money
P0 | Source: Present in source | Execution: PASS

**Given:** Customer pays zero but the company uses parts and labour

**When:** Accounts views project contribution

**Expected:** Internal repair costs reduce contribution even with no customer charge

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Field work and service [OPS-07] keeps covered repair free but accounts for internal costs

### OPS-08 Search handles growing workload
P1 | Source: Needs verification | Execution: PASS

**Given:** Fixture LOAD1 has 1000 projects and 200 open service requests

**When:** Staff searches and pages through records

**Expected:** Pagination preserves all results and agreed response-time targets are measured, not assumed

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Capacity, payroll and workload verification [OPS-08] LOAD1 preserves all 1000 searchable projects and 200 requests with measured local response time

### OPS-09 Audit reconstructs a disputed repair
P0 | Source: Partial | Execution: PASS

**Given:** A customer questions who changed assignment or coverage

**When:** Manager reviews history

**Expected:** Actor, time, old and new states, reasons and related documents are available

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Final concurrency and revision checks [OPS-09] repair review audit retains before and after decisions with actor and time

### OPS-10 Demo reset cannot erase operational data
P0 | Source: Partial | Execution: PASS

**Given:** A training fixture needs to be replayed

**When:** Tester resets the isolated fixture

**Expected:** Only the explicitly selected test dataset changes; live/demo customer work is preserved

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Capacity, payroll and workload verification [OPS-10] rerunning demo setup preserves existing work, collections and evidence; Passed: [OPS-10] named isolated training reset replays only its selected dataset and refuses nontraining names


## UXP Mobile Windows navigation and device behavior

### UXP-01 Return to filtered project list
P1 | Source: Present in source | Execution: PASS

**Given:** Staff opens a project from a searched stage-filtered list

**When:** They choose Back

**Expected:** Search, stage and page context are retained

**Evidence:** tests/e2e/navigation.spec.ts

**Observed:** Passed: [UXP-01] project next step and back navigation preserve search and stage (chromium); Passed: [UXP-01] project next step and back navigation preserve search and stage (webkit)

### UXP-02 Next task follows actual saved state
P0 | Source: Partial | Execution: PASS

**Given:** A project moves from survey to payment or packing

**When:** Staff reloads the project

**Expected:** The next-step message matches saved progress and the user's permitted action

**Evidence:** tests/e2e/navigation.spec.ts; tests/e2e/workflow.spec.ts

**Observed:** Passed: [UXP-02] staff roles show permitted next steps, different workspaces and server access rules (chromium); Passed: [UXP-02] staff roles show permitted next steps, different workspaces and server access rules (webkit); Passed: [UXP-02] responsive navigation, saved next steps and accessible core screens (chromium); Passed: [UXP-02] responsive navigation, saved next steps and accessible core screens (webkit)

### UXP-03 Navigate away from unsaved form
P0 | Source: Missing workflow | Execution: PASS

**Given:** Staff edits a long form without saving

**When:** They choose another screen or phone Back

**Expected:** A stay/discard choice prevents accidental data loss

**Evidence:** tests/e2e/navigation.spec.ts

**Observed:** Passed: [INT-09 UXP-03] interrupted enquiry recovers its draft and in-app/back navigation offers stay or discard (chromium); Passed: [INT-09 UXP-03] interrupted enquiry recovers its draft and in-app/back navigation offers stay or discard (webkit)

### UXP-04 Small phone with keyboard open
P1 | Source: Needs verification | Execution: BLOCKED

**Given:** A 360px screen shows a long repair form

**When:** Technician focuses the last field

**Expected:** The field, error and submit action remain reachable without whole-page overflow

**Evidence:** Current source review against docs/scenarios/catalog-source.txt; any partial runtime evidence is retained separately.

**Observed:** Responsive browser widths pass, but a physical phone with the software keyboard open was not tested.

### UXP-05 Screen reader and keyboard operation
P1 | Source: Partial | Execution: BLOCKED

**Given:** A user cannot use a mouse or read color cues

**When:** They navigate menus and forms

**Expected:** Labels, focus order, status messages and keyboard actions remain understandable

**Evidence:** Current source review against docs/scenarios/catalog-source.txt; any partial runtime evidence is retained separately.

**Observed:** Automated accessibility checks and Escape behavior pass; a full screen-reader and keyboard-only walkthrough remains unverified.

### UXP-06 Android native app against same backend
P1 | Source: Missing workflow | Execution: BLOCKED

**Given:** A signed Android build uses the shared API

**When:** Staff completes an assigned repair

**Expected:** Identity, photos, invoice rules and server permissions match the desktop workflow

**Evidence:** Current source review against docs/scenarios/catalog-source.txt; any partial runtime evidence is retained separately.

**Observed:** No signed Android native build exists. Responsive mobile web/PWA is the implemented client.

### UXP-07 Windows native app against same backend
P1 | Source: Missing workflow | Execution: BLOCKED

**Given:** A signed Windows build is installed

**When:** Staff schedules and invoices a repair

**Expected:** The installed client uses the same authoritative rules and handles printing and file permissions

**Evidence:** Current source review against docs/scenarios/catalog-source.txt; any partial runtime evidence is retained separately.

**Observed:** No signed Windows native build exists. Desktop web/PWA is the implemented client.

### UXP-08 Offline during field visit
P0 | Source: Partial | Execution: PASS

**Given:** A technician loses network after opening a visit

**When:** They attempt save or completion

**Expected:** Offline state is explicit and no unsynced work is shown as committed; draft policy is defined

**Evidence:** tests/e2e/repairs.spec.ts

**Observed:** Passed: [CRM-09 BIL-10 UXP-08] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (chromium); Passed: [CRM-09 BIL-10 UXP-08] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (webkit)

### UXP-09 Barcode camera on a physical phone
P1 | Source: Needs verification | Execution: BLOCKED

**Given:** A real device grants camera access in a supported secure context

**When:** Technician scans a printed label

**Expected:** The actual serial is decoded and server eligibility checks still run

**Evidence:** Current source review against docs/scenarios/catalog-source.txt; any partial runtime evidence is retained separately.

**Observed:** All generated barcode images can be decoded by software; physical-phone camera scanning in HTTPS remains unverified.

### UXP-10 Client is older than backend
P1 | Source: Missing workflow | Execution: PASS

**Given:** A native or cached web client uses an older request shape

**When:** It calls a changed endpoint

**Expected:** Version compatibility or a clear update message prevents silent corruption

**Evidence:** tests/integration/lifecycle.test.ts

**Observed:** Passed: Customer follow-up and workflow compatibility [UXP-10] older repair payload cannot silently supply a charge or replacement outside approved diagnosis
