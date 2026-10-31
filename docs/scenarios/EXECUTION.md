# Scenario execution register

Checked 2026-10-31T08:51:03.251Z. Application source commit: 3f337d4239bd7c043af9f98b13f461c2a466446e.

All 200 scenarios assessed: 137 PASS, 63 BLOCKED.

76/76 backend tests passed. Browser results and restore checks are recorded separately. A test can verify several named scenarios; 200 scenarios does not mean 200 automated test functions.

BLOCKED means the full required workflow or necessary test environment is unavailable. Some blocked scenarios have partial passing checks, retained in execution.json. They are not counted as passes. Source assessments in the original catalogue remain the historical d0d1038 baseline.

## Six review failures

- INT-01: PASS
- SRV-01: PASS
- SRV-03: PASS
- EVD-01: PASS
- BIL-01: PASS
- BIL-05: PASS

## Results

| Scenario | Result | Observed result or blocker |
| --- | --- | --- |
| INT-01 Support records a new installation call | PASS | Passed: Review regressions and real operational requests [INT-01 SEC-01] support creates audited installation intake without gaining stock or finance authority |
| INT-02 Caller does not know system size | BLOCKED | Capacity is still mandatory at enquiry intake; an explicit unknown-size state and later survey sizing are missing. |
| INT-03 Repeated call for the same request | BLOCKED | Installation enquiry intake does not suggest duplicates or append to an existing installation contact log. |
| INT-04 Two unrelated requests from one household | BLOCKED | Each installation enquiry still creates a customer record; a shared customer with multiple separately linked sites is not supported by intake. |
| INT-05 Customer wants a specific appointment | BLOCKED | A follow-up date and notes exist, but a structured customer appointment preference separate from confirmation is missing. |
| INT-06 Caller reports an electrical hazard | BLOCKED | Urgent repair priority exists; installation-call hazard triage and a tracked human escalation are missing. |
| INT-07 Wrong phone number entered | PASS | Passed: Additional acceptance boundaries [INT-07] malformed phone is rejected without creating a partial customer |
| INT-08 Customer changes their mind before survey | BLOCKED | Pre-survey installation cancellation and release of related visits are not implemented. |
| INT-09 Call interrupted during entry | BLOCKED | Inputs survive a request error while the form stays open; durable interrupted-entry recovery is not implemented. |
| INT-10 Public intake disabled for staff operation | PASS | Passed: Final billing and intake guards [INT-10] explicit phone-only setting blocks anonymous creation while staff intake stays usable |
| CRM-01 Search a returning customer by phone | PASS | Passed: Additional acceptance boundaries [CRM-01 CRM-02] phone search distinguishes customers sharing a phone by name and site |
| CRM-02 Shared family phone number | PASS | Passed: Additional acceptance boundaries [CRM-01 CRM-02] phone search distinguishes customers sharing a phone by name and site |
| CRM-03 Multiple systems at one address | BLOCKED | Separate installation projects can be selected, but a shared-site view linking multiple systems is missing. |
| CRM-04 Correct a customer spelling | BLOCKED | Customer correction with issued-document name snapshots is not implemented. |
| CRM-05 Change customer contact number | BLOCKED | Verified contact-number updates with restricted old-value history are not implemented. |
| CRM-06 Record access instructions | BLOCKED | Repair contact notes are visible to the assigned crew; a dedicated persisted site-access record and a focused access-instruction test are missing. |
| CRM-07 Customer address differs from billing address | BLOCKED | Separate service and billing addresses are not implemented. |
| CRM-08 Duplicate records discovered | BLOCKED | An administrator-reviewed customer merge workflow is not implemented. |
| CRM-09 Wrong customer selected for a complaint | PASS | Passed: [CRM-09 BIL-10] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (chromium); Passed: [CRM-09 BIL-10] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (webkit) |
| CRM-10 Customer calls while another employee edits | BLOCKED | Customer contact editing with optimistic version checks is not implemented; ticket and visit version checks do exist. |
| SUR-01 Quote without a survey | PASS | Passed: Sales lifecycle and snapshots [SUR-01] blocks direct quote issuance without an approved survey |
| SUR-02 Insufficient roof area | PASS | Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection |
| SUR-03 Unsuitable on-grid connection | PASS | Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection |
| SUR-04 Approve a suitable site | PASS | Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection |
| SUR-05 New measurements after quote issuance | PASS | Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection |
| SUR-06 Negative or impossible readings | PASS | Passed: Additional acceptance boundaries [SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection |
| SUR-07 Customer absent for survey | BLOCKED | No-access survey outcome and reason are tested; an automatic reschedule task is not created. |
| SUR-08 Survey needs two workers | PASS | Passed: Review regressions and real operational requests [SUR-08] two-worker survey stores both crew members and blocks both calendars |
| SUR-09 Rain prevents roof inspection | PASS | Passed: Final concurrency and revision checks [SUR-07 SUR-09 DSP-04] survey no-access remains explicit and leave-triggered crew reassignment preserves history |
| SUR-10 Accepted system requested to change | BLOCKED | Accepted commercial records are protected, but the required approved change-order path is not implemented. |
| QUO-01 Generate a package quote | PASS | Passed: Additional acceptance boundaries [QUO-01 PAY-01] package lines and totals carry through to one installation invoice |
| QUO-02 Price changes after acceptance | PASS | Passed: Sales lifecycle and snapshots [QUO-02 QUO-03 CON-01] acceptance is idempotent and material prices remain snapshots |
| QUO-03 Customer accepts twice | PASS | Passed: Sales lifecycle and snapshots [QUO-02 QUO-03 CON-01] acceptance is idempotent and material prices remain snapshots |
| QUO-04 Two staff accept simultaneously | PASS | Passed: Additional acceptance boundaries [QUO-04] concurrent customer acceptance produces one order, invoice and job |
| QUO-05 Customer requests a discount | BLOCKED | Discount limits, requests and approval workflow are not implemented. |
| QUO-06 Customer accepts an older quote | BLOCKED | Acceptance selects the current quote server-side, but the caller cannot explicitly submit a quote version for stale-acceptance detection. |
| QUO-07 Quote expires before acceptance | BLOCKED | Quote expiry and renewal exceptions are not implemented. |
| QUO-08 Customer cancels after paying advance | BLOCKED | Paid-order cancellation, refunds and reservation release are not implemented. |
| QUO-09 Customer adds a battery after order acceptance | BLOCKED | Accepted-order additions need a change-order workflow which is not implemented. |
| QUO-10 Package unavailable for requested system | PASS | Passed: Additional acceptance boundaries [QUO-10] unavailable package refuses an empty quote |
| PAY-01 Initial installation invoice | PASS | Passed: Additional acceptance boundaries [QUO-01 PAY-01] package lines and totals carry through to one installation invoice |
| PAY-02 Advance below threshold | PASS | Passed: Inventory integrity and warranty timing [PAY-02 DLV-01 STK-06] blocks reservation before advance, incomplete scans and unknown serials |
| PAY-03 Advance exactly at threshold | PASS | Passed: Additional acceptance boundaries [PAY-03] exact required advance permits reservation |
| PAY-04 Payment submitted twice | PASS | Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries |
| PAY-05 Payment exceeds outstanding amount | PASS | Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries |
| PAY-06 Two payments race for final balance | PASS | Passed: Additional acceptance boundaries [PAY-06] two cashiers cannot collect the final balance twice |
| PAY-07 UPI payment not actually settled | BLOCKED | Collections are manually recorded as received; pending/verified settlement states and payment-provider verification are missing. |
| PAY-08 Part payment against service bill | PASS | Passed: Review regressions and real operational requests [BIL-05 BIL-03 PAY-08] customer retail differs from acquisition cost and service part-payments leave initial invoice unchanged |
| PAY-09 Incorrect payment needs reversal | BLOCKED | Receipt reversal with retained financial history is not implemented. |
| PAY-10 Two customers use the same reference text | PASS | Passed: Additional acceptance boundaries [PAY-10] identical reference text on different invoices remains independently scoped |
| STK-01 Receive serialized equipment | PASS | Passed: Additional acceptance boundaries [STK-01 STK-09] receipt creates three distinct devices and scan normalizes case and spaces |
| STK-02 Duplicate serial in a receipt | PASS | Passed: Inventory integrity and warranty timing [STK-02] receipt rollback preserves stock when duplicate serials are submitted |
| STK-03 Insufficient stock for full package | PASS | Passed: Additional acceptance boundaries [STK-03] insufficient package stock leaves no hidden partial reservation |
| STK-04 Two orders compete for the last device | PASS | Passed: Inventory integrity and warranty timing [STK-04] concurrent allocations can never claim the same physical device twice |
| STK-05 Wrong product scanned | PASS | Passed: Inventory integrity and warranty timing [STK-05 STK-07] rejects a wrong product and duplicate serial scans |
| STK-06 Unknown barcode scanned | PASS | Passed: Inventory integrity and warranty timing [PAY-02 DLV-01 STK-06] blocks reservation before advance, incomplete scans and unknown serials |
| STK-07 Duplicate scan on one order | PASS | Passed: Inventory integrity and warranty timing [STK-05 STK-07] rejects a wrong product and duplicate serial scans |
| STK-08 Stock found damaged before dispatch | BLOCKED | Repair returns can enter quarantine; damaged reserved sale stock still lacks quarantine/substitution handling. |
| STK-09 Serial pasted with spaces and case changes | PASS | Passed: Additional acceptance boundaries [STK-01 STK-09] receipt creates three distinct devices and scan normalizes case and spaces |
| STK-10 Stock correction after physical count | BLOCKED | Reasoned physical-count adjustments and approval are not implemented. |
| DLV-01 Dispatch before every required scan | PASS | Passed: Inventory integrity and warranty timing [PAY-02 DLV-01 STK-06] blocks reservation before advance, incomplete scans and unknown serials |
| DLV-02 Dispatch a complete packing list | PASS | Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates |
| DLV-03 Dispatch does not start warranty | PASS | Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates |
| DLV-04 Delivery starts each line warranty | PASS | Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates |
| DLV-05 Delivery is retried | PASS | Passed: Inventory integrity and warranty timing [DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates |
| DLV-06 Partial delivery | BLOCKED | Delivery remains all-or-nothing; partial line delivery and per-line receipt dates are missing. |
| DLV-07 Wrong customer receives equipment | BLOCKED | Failed/wrong-destination delivery and driver custody events are not implemented. |
| DLV-08 Transit damage | BLOCKED | Transit incident handling and replacement-delivery records are not implemented. |
| DLV-09 Customer refuses delivery | BLOCKED | Delivery refusal with a return task is not implemented. |
| DLV-10 Delivery time entered in another timezone | PASS | Passed: Customer follow-up and workflow compatibility [DLV-10] warranty instants are invariant when database session timezones differ |
| SCH-01 Thirteen busy and two free | PASS | Passed: Review regressions and real operational requests [SCH-01] fifteen dispatch workers, thirteen occupied and precisely two free in the demonstrated interval |
| SCH-02 No worker free within target window | BLOCKED | Availability returns explicit next dates and an escalation instruction, but no dedicated persisted escalation task is created when the requested window is full. |
| SCH-03 Free worker lacks required skill | PASS | Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking |
| SCH-04 Leave overrides an empty calendar | PASS | Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking |
| SCH-05 Travel consumes the apparent gap | PASS | Passed: Review regressions and real operational requests [SCH-05 SCH-07 SCH-10] travel buffer and two coordinators racing for one worker |
| SCH-06 Two jobs have overlapping times | PASS | Passed: Field work and service [SCH-06 INS-06] blocks overlapping assignments and completion without saved evidence |
| SCH-07 Adjacent visits at the same site | PASS | Passed: Review regressions and real operational requests [SCH-05 SCH-07 SCH-10] travel buffer and two coordinators racing for one worker |
| SCH-08 Customer available outside business hours | PASS | Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking |
| SCH-09 Routine window crosses a holiday | BLOCKED | Weekly nonworking days and calendar-day targets are implemented and tested; a dated company-holiday calendar is missing. |
| SCH-10 Two coordinators choose the same free slot | PASS | Passed: Review regressions and real operational requests [SCH-05 SCH-07 SCH-10] travel buffer and two coordinators racing for one worker |
| DSP-01 Twenty simultaneous customer calls | PASS | Passed: Review regressions and real operational requests [DSP-01 SEC-08] twenty concurrent calls survive without appointments or shared identities |
| DSP-02 One slot remains and two requests compete | BLOCKED | Priority is visible and available candidates have stable names; due-date/travel/workload ranking and anti-starvation rules are not implemented. |
| DSP-03 Urgent repair interrupts routine planning | BLOCKED | Urgent requests are highlighted, but a tracked hazard-escalation and displaced-customer contact workflow is missing. |
| DSP-04 Technician becomes sick after assignment | BLOCKED | Leave flags and conflict-checked reassignment pass; a separate tracked customer-contact task is missing. |
| DSP-05 Customer requests another date | PASS | Passed: Review regressions and real operational requests [DSP-05 DSP-09 CON-07] rescheduling releases old time atomically, rejects stale revision and supports retry |
| DSP-06 Job overruns planned duration | BLOCKED | An in-progress appointment cannot yet be extended with downstream-conflict alerts. |
| DSP-07 Technician declines an unsuitable job | BLOCKED | An assigned worker can cancel a visit with a reason; a dedicated decline/acknowledgement workflow and focused decline test are not recorded. |
| DSP-08 Technician cannot be contacted | BLOCKED | Worker acknowledgement deadlines and coordinator alerts are not implemented. |
| DSP-09 Assignment retry after network timeout | PASS | Passed: Review regressions and real operational requests [DSP-05 DSP-09 CON-07] rescheduling releases old time atomically, rejects stale revision and supports retry |
| DSP-10 Search result becomes stale | PASS | Passed: Review regressions and real operational requests [SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking |
| INS-01 Only assigned installer sees work | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost |
| INS-02 Start before delivery | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost |
| INS-03 Two-person installation crew | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost |
| INS-04 Lead and assistant have different powers | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost |
| INS-05 Safety checklist incomplete | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost |
| INS-06 Missing installation evidence | PASS | Passed: Field work and service [SCH-06 INS-06] blocks overlapping assignments and completion without saved evidence |
| INS-07 Actual hours differ from scheduled hours | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost |
| INS-08 Multiple crew members record time | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost; Passed: Capacity, payroll and workload verification [INS-08] individual crew payout does not pay the other worker or duplicate the first payment |
| INS-09 Customer refuses installation sign-off | BLOCKED | Missing signature blocks completion; an explicit installation dispute/review state is not implemented. |
| INS-10 Installed system differs from accepted capacity | PASS | Passed: Final billing and intake guards [INS-10] material capacity discrepancy blocks handover for review |
| SRV-01 Complaint before faulty part is known | PASS | Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access |
| SRV-02 Assigned repair worker gets full installed list | PASS | Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access |
| SRV-03 Technician changes between original install and repair | PASS | Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access |
| SRV-04 Two open faults at one customer | BLOCKED | Independent faults coexist, including the 20-call test, but automatic duplicate suggestions are not implemented. |
| SRV-05 Repeated call about same unresolved fault | PASS | Passed: Customer follow-up and workflow compatibility [SRV-05 SEC-06] coordinator has explicit call intake powers and support can append a repeated call without duplicating work |
| SRV-06 Remote fix avoids a visit | BLOCKED | A remote-resolution policy and remote-completion route without onsite evidence are not implemented. |
| SRV-07 Repair cancelled before attendance | PASS | Passed: Additional acceptance boundaries [SRV-07] support cancellation releases appointment and records reason |
| SRV-08 First visit diagnoses but cannot fix | PASS | Passed: Review regressions and real operational requests [SRV-08 SRV-09 EVD-08] no access and waiting-for-parts preserve open work; a customer dispute prevents closure |
| SRV-09 Customer unavailable at repair visit | PASS | Passed: Review regressions and real operational requests [SRV-08 SRV-09 EVD-08] no access and waiting-for-parts preserve open work; a customer dispute prevents closure |
| SRV-10 Customer calls after alleged repair failed | PASS | Passed: Customer follow-up and workflow compatibility [SRV-10 RMA-08] failed replacement follow-up retains both identities, original bill and evidence |
| DIA-01 Select multiple faulty installed components | PASS | Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost |
| DIA-02 Select another customer's serial | PASS | Passed: Review regressions and real operational requests [DIA-02 DIA-03 CON-03] foreign component, excessive quantity and stale diagnosis are rejected |
| DIA-03 Diagnose a quantity-tracked panel | PASS | Passed: Review regressions and real operational requests [DIA-02 DIA-03 CON-03] foreign component, excessive quantity and stale diagnosis are rejected |
| DIA-04 Part not supplied by this company | BLOCKED | Diagnosis only accepts installed order components; external/third-party equipment records are not implemented. |
| DIA-05 No fault found | BLOCKED | Diagnosis requires at least one faulty item; reviewed no-fault closure is not implemented. |
| DIA-06 Diagnosis changes before approval | PASS | Passed: Review regressions and real operational requests [DIA-06 BIL-06] editing diagnosis invalidates approval and unapproved work cannot create an invoice |
| DIA-07 Diagnosis changes after billing | BLOCKED | Issued diagnosis and invoice edits are correctly blocked, but the required reviewed correction or credit workflow is not implemented. |
| DIA-08 Customer disputes diagnosis | PASS | Passed: Customer follow-up and workflow compatibility [DIA-08] declined diagnosis stays disputed with no invoice or unapproved replacement |
| DIA-09 One of many panels is replaced repeatedly | BLOCKED | A diagnosis cannot exceed installed quantity, but cumulative quantity-only replacement entitlement is not tracked. |
| DIA-10 Retired serial selected again | PASS | Passed: Field work and service [DIA-10] traces replacement serials and preserves the original warranty dates |
| WAR-01 Covered component at ticket opening | PASS | Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit |
| WAR-02 Expired component at ticket opening | PASS | Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit |
| WAR-03 Different cover within the same system | PASS | Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost |
| WAR-04 Exact expiry boundary | PASS | Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit |
| WAR-05 Warranty expires before the booked visit | PASS | Passed: Additional acceptance boundaries [WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit |
| WAR-06 Excluded accidental damage | BLOCKED | Authorized exclusion with reason and actor is tested; requiring diagnostic evidence before an exclusion remains unimplemented. |
| WAR-07 Unknown or missing policy | PASS | Passed: Final billing and intake guards [WAR-07] missing promised policy requires a reviewed decision, never silent billing |
| WAR-08 Parts covered but labour excluded | PASS | Passed: Review regressions and real operational requests [WAR-08 BIL-04] covered parts can have approved charged labour and callout, while full cover credits all three |
| WAR-09 Manufacturer reimbursement differs from customer cover | BLOCKED | Customer coverage exists; supplier recovery balances and independent manufacturer claims are not implemented. |
| WAR-10 Warranty override | PASS | Passed: Review regressions and real operational requests [WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion |
| RMA-01 Compatible replacement in stock | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure |
| RMA-02 Replacement uses an allocated serial | PASS | Passed: Additional acceptance boundaries [RMA-02 RMA-03] replacement cannot use wrong model or device allocated to another customer |
| RMA-03 Replacement is a different product | PASS | Passed: Additional acceptance boundaries [RMA-02 RMA-03] replacement cannot use wrong model or device allocated to another customer |
| RMA-04 Different compatible model approved | BLOCKED | Only the same product can replace an installed device; approved cross-model engineering substitutions are not implemented. |
| RMA-05 Faulty part returned to warehouse | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure |
| RMA-06 Faulty part not yet returned | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure |
| RMA-07 No replacement stock available | BLOCKED | Waiting-for-parts and return visits exist, but parts procurement/readiness is not tied to follow-up completion-date promises. |
| RMA-08 Replacement fails immediately | PASS | Passed: Customer follow-up and workflow compatibility [SRV-10 RMA-08] failed replacement follow-up retains both identities, original bill and evidence |
| RMA-09 Supplier accepts or rejects claim | BLOCKED | Return receipt stops at quarantine; supplier claim decisions, credits and supplier custody are not implemented. |
| RMA-10 Replacement retains original coverage | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure |
| BIL-01 Covered replacement shown at zero | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure |
| BIL-02 Mixed coverage service bill | PASS | Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost |
| BIL-03 Separate service invoice from original sale | PASS | Passed: Review regressions and real operational requests [BIL-05 BIL-03 PAY-08] customer retail differs from acquisition cost and service part-payments leave initial invoice unchanged |
| BIL-04 All repair lines covered | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure; Passed: Review regressions and real operational requests [WAR-08 BIL-04] covered parts can have approved charged labour and callout, while full cover credits all three |
| BIL-05 Internal cost differs from selling price | PASS | Passed: Review regressions and real operational requests [BIL-05 BIL-03 PAY-08] customer retail differs from acquisition cost and service part-payments leave initial invoice unchanged |
| BIL-06 Customer rejects paid estimate | PASS | Passed: Review regressions and real operational requests [DIA-06 BIL-06] editing diagnosis invalidates approval and unapproved work cannot create an invoice |
| BIL-07 Resolution retried after timeout | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure |
| BIL-08 Invoice correction after issue | BLOCKED | Issued work cannot be edited; credit notes and approved revised invoices are not implemented. |
| BIL-09 Financial totals for mixed repair | PASS | Passed: Review regressions and real operational requests [DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost |
| BIL-10 Tax and warranty document treatment unconfigured | PASS | Passed: [CRM-09 BIL-10] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (chromium); Passed: [CRM-09 BIL-10] repair appointment, diagnosis, approval, real photo and service document on desktop and phone (webkit) |
| EVD-01 After-repair photo required | PASS | Passed: Review regressions and real operational requests [EVD-01] valid diagnosis and approval still cannot complete without this visit photo |
| EVD-02 Diagnosis photo linked to faulty item | BLOCKED | Evidence links to a ticket, visit and diagnosis revision, but not to an individual faulty component. |
| EVD-03 Wrong file masquerades as photo | PASS | Passed: Additional acceptance boundaries [EVD-03 EVD-10] disguised executable rejected and private evidence cannot be opened anonymously |
| EVD-04 Upload loses connection midway | BLOCKED | Bad uploads are rejected, but transport interruption and content-deduplicated retry were not tested; upload deduplication is not implemented. |
| EVD-05 Device permission denied | BLOCKED | A file picker is available; camera-denial recovery still needs a physical-device test. |
| EVD-06 Customer signs before final changes | PASS | Passed: Final concurrency and revision checks [EVD-06 EVD-09 DIA-07] changed diagnosis invalidates earlier evidence and issued work cannot be edited or erased |
| EVD-07 Customer confirms by phone | PASS | Passed: Review regressions and real operational requests [BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure |
| EVD-08 Customer disputes closure | PASS | Passed: Review regressions and real operational requests [SRV-08 SRV-09 EVD-08] no access and waiting-for-parts preserve open work; a customer dispute prevents closure |
| EVD-09 Technician attempts to erase evidence | PASS | Passed: Final concurrency and revision checks [EVD-06 EVD-09 DIA-07] changed diagnosis invalidates earlier evidence and issued work cannot be edited or erased |
| EVD-10 Unauthenticated person opens a photo URL | PASS | Passed: Additional acceptance boundaries [EVD-03 EVD-10] disguised executable rejected and private evidence cannot be opened anonymously |
| SEC-01 Support creates installation request | PASS | Passed: Review regressions and real operational requests [INT-01 SEC-01] support creates audited installation intake without gaining stock or finance authority |
| SEC-02 Coordinator manages visits | PASS | Passed: Review regressions and real operational requests [WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion |
| SEC-03 Technician sees assigned repair only | PASS | Passed: Review regressions and real operational requests [SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access |
| SEC-04 Warehouse cannot approve customer discount | PASS | Passed: Additional acceptance boundaries [SEC-04 SEC-07 SEC-10] admin access changes take effect on open sessions and flag assigned work |
| SEC-05 Accounts cannot fake technical completion | PASS | Passed: Review regressions and real operational requests [WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion |
| SEC-06 One employee covers two duties | PASS | Passed: Customer follow-up and workflow compatibility [SRV-05 SEC-06] coordinator has explicit call intake powers and support can append a repeated call without duplicating work |
| SEC-07 Employee leaves the company | PASS | Passed: Additional acceptance boundaries [SEC-04 SEC-07 SEC-10] admin access changes take effect on open sessions and flag assigned work |
| SEC-08 Two support agents work concurrently | PASS | Passed: Review regressions and real operational requests [DSP-01 SEC-08] twenty concurrent calls survive without appointments or shared identities |
| SEC-09 Only administrator sees staff directory | PASS | Passed: Session and authorization [SEC-09] protects the staff directory and complete barcode library by role |
| SEC-10 Permission changed while screen is open | PASS | Passed: Additional acceptance boundaries [SEC-04 SEC-07 SEC-10] admin access changes take effect on open sessions and flag assigned work |
| CON-01 Same idempotency key same request | PASS | Passed: Sales lifecycle and snapshots [QUO-02 QUO-03 CON-01] acceptance is idempotent and material prices remain snapshots |
| CON-02 Same idempotency key changed request | PASS | Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries |
| CON-03 Two workers diagnose same service visit | PASS | Passed: Review regressions and real operational requests [DIA-02 DIA-03 CON-03] foreign component, excessive quantity and stale diagnosis are rejected |
| CON-04 Two repair tickets replace the same original | PASS | Passed: Final concurrency and revision checks [CON-04] competing tickets cannot replace one original device twice |
| CON-05 Reservation races with service replacement | PASS | Passed: Final concurrency and revision checks [CON-05] last unreserved device cannot be promised to both sale and replacement |
| CON-06 Failure after stock update before invoice | PASS | Passed: Review regressions and real operational requests [CON-06] database failure after replacement changes rolls back stock, original serial, invoice and ticket together |
| CON-07 Two coordinators reschedule the same visit | PASS | Passed: Review regressions and real operational requests [DSP-05 DSP-09 CON-07] rescheduling releases old time atomically, rejects stale revision and supports retry |
| CON-08 Payment response lost after commit | PASS | Passed: Sales lifecycle and snapshots [PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries |
| CON-09 Double tap completion | PASS | Passed: Additional acceptance boundaries [INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost |
| CON-10 Database rejects a foreign identifier | PASS | Passed: Additional acceptance boundaries [CON-10] nonexistent record yields controlled error without an orphan ticket |
| OPS-01 Server restarts after saved action | PASS | Passed: Field work and service [OPS-01] persists committed data across a new application instance |
| OPS-02 Database connection fails during save | BLOCKED | Transactional rollback was tested with an injected database error; a real database outage during save was not exercised. |
| OPS-03 Evidence disk is full | BLOCKED | File-write errors occur before evidence metadata insertion, but actual disk-full failure injection was not exercised. |
| OPS-04 Restore a backup | PASS | Passed: [OPS-04] PostgreSQL dump and restore, financial totals and private photo bytes |
| OPS-05 Dashboard distinguishes backlog from active work | PASS | Passed: Capacity, payroll and workload verification [OPS-05] work queue distinguishes new, scheduled, active, blocked and awaiting-confirmation work |
| OPS-06 Report distinguishes cash and profit | PASS | Passed: Field work and service [OPS-06] reconciles report amounts against invoice, material and labour records |
| OPS-07 Covered repair still costs money | PASS | Passed: Field work and service [OPS-07] keeps covered repair free but accounts for internal costs |
| OPS-08 Search handles growing workload | PASS | Passed: Capacity, payroll and workload verification [OPS-08] LOAD1 preserves all 1000 searchable projects and 200 requests with measured local response time |
| OPS-09 Audit reconstructs a disputed repair | PASS | Passed: Final concurrency and revision checks [OPS-09] repair review audit retains before and after decisions with actor and time |
| OPS-10 Demo reset cannot erase operational data | BLOCKED | Seed reruns preserve operational data; a user-selectable training-dataset reset/replay command is not implemented. |
| UXP-01 Return to filtered project list | PASS | Passed: [UXP-01] project next step and back navigation preserve search and stage (chromium); Passed: [UXP-01] project next step and back navigation preserve search and stage (webkit) |
| UXP-02 Next task follows actual saved state | PASS | Passed: [UXP-02] staff roles show permitted next steps, different workspaces and server access rules (chromium); Passed: [UXP-02] staff roles show permitted next steps, different workspaces and server access rules (webkit); Passed: [UXP-02] responsive navigation, saved next steps and accessible core screens (chromium); Passed: [UXP-02] responsive navigation, saved next steps and accessible core screens (webkit) |
| UXP-03 Navigate away from unsaved form | BLOCKED | Browser unload warns on dirty shared forms; in-app navigation and phone Back do not yet consistently show stay/discard. |
| UXP-04 Small phone with keyboard open | BLOCKED | Responsive browser widths pass, but a physical phone with the software keyboard open was not tested. |
| UXP-05 Screen reader and keyboard operation | BLOCKED | Automated accessibility checks and Escape behavior pass; a full screen-reader and keyboard-only walkthrough remains unverified. |
| UXP-06 Android native app against same backend | BLOCKED | No signed Android native build exists. Responsive mobile web/PWA is the implemented client. |
| UXP-07 Windows native app against same backend | BLOCKED | No signed Windows native build exists. Desktop web/PWA is the implemented client. |
| UXP-08 Offline during field visit | BLOCKED | Network errors do not report success, but a complete offline draft/sync policy and field-offline journey are missing. |
| UXP-09 Barcode camera on a physical phone | BLOCKED | All generated barcode images can be decoded by software; physical-phone camera scanning in HTTPS remains unverified. |
| UXP-10 Client is older than backend | PASS | Passed: Customer follow-up and workflow compatibility [UXP-10] older repair payload cannot silently supply a charge or replacement outside approved diagnosis |
