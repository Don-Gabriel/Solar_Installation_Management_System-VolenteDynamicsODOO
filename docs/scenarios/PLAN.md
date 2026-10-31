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
