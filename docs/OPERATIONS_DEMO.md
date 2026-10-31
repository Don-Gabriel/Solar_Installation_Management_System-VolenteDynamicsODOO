# Scheduling and warranty demonstration

Open http://127.0.0.1:3001. These are synthetic examples, not records of real field work. Use the configured demo password; the local setup default is `SolarDemo!2026`. Sign out before switching employees.

## Eight staff roles

| Role | Preserved demo accounts | Main responsibility |
| --- | ---: | --- |
| Administrator | 2 | Staff access, reviewed exceptions and oversight |
| Sales | 3 | Survey-approved quotations and acceptance |
| Site surveyor | 2 | Measurements and survey approval |
| Customer support | 2 | Installation calls, complaints, approval records and confirmation |
| Service coordinator | 2 | Availability, crews, visits, leave and repair review |
| Warehouse | 2 | Equipment, delivery and faulty-part quarantine |
| Field technician | 19 | Assigned installations and repairs; 15 are on the new dispatch roster |
| Accounts | 2 | Payments, costs and individual crew payouts |

There are 34 named staff accounts and no customer login. Four historical technician identities are preserved alongside the 15-person dispatch roster. The separate 27-person F15 planning fixture is not the live staff directory.

## Show the reviewer’s 15-technician example

1. Sign in as `coordinator@sunpower.local` (Isha Raman). The backup coordinator is `vishal@sunpower.local`.
2. Open Repairs & warranty and find **SR-5**, the synthetic request awaiting scheduling. Choose **Find technician and schedule visit**.
3. Search 3–5 November 2026, inverter repair, two hours and one worker. Choose the **13:00 IST** slot. The seeded afternoon conflict fixture leaves **Yash Shah and Zubin Roy** available; the other 13 are occupied during that interval. Other times may have more available workers.
4. Select a worker and crew lead, then confirm. Confirmation rechecks skills, leave, hours, buffers and competing work in one transaction.
5. The test suite separately races two coordinators for one worker and verifies exactly one succeeds. It also checks a repair competing with installation work, two-person crews and stale search results.

Search is not a reservation. The app uses a fixed 30-minute buffer and weekly working days; it does not calculate road travel or a holiday calendar. When a window is full it shows alternative dates and an escalation instruction. A separate persisted escalation task is still missing.

## Show zero-payable warranty work

Open **SR-3 — Lakshmi Iyer** in Repairs & warranty. The saved synthetic replacement shows the original and new inverter serials, a visible replacement line, warranty credits, and a **₹0** service statement. Labour and callout are also credited. The initial installation invoice remains unchanged.

The case is awaiting customer confirmation. Support can record a phone confirmation; warehouse can receive the faulty part into quarantine. Receiving it never makes it saleable stock.

## Show parts-only coverage

Open **SR-4 — Sneha & Arun**. Its synthetic policy review covers the replacement part, while the customer approved **₹500 labour and ₹200 callout**, making **₹700** payable. Both charges have separate document lines. Accounts can collect a payment against this service invoice without changing the initial installation balance.

The automated MIX1 fixture also verifies the exact larger example: a covered inverter valued at ₹18,000, two connectors costing the customer ₹900, ₹600 uncovered labour and ₹200 callout, for **₹1,700 total payable**. It uses actual connector product/order lines in an isolated database and checks that internal stock costs remain nonzero.

The two saved demo evidence images explicitly say **SYNTHETIC REPAIR REHEARSAL**. They exercise private upload and billing rules and must not be presented as photographs of real work.

## Show role boundaries

- `support@sunpower.local`: create an installation enquiry or a complaint without knowing the faulty component. Support cannot complete physical work or pay staff.
- `coordinator@sunpower.local`: search, book, reschedule and review coverage. Finance and team administration remain denied.
- `arjun@sunpower.local`: open assigned work and upload evidence. Unrelated sites and financial reports remain denied.
- `warehouse@sunpower.local`: receive returned faulty components into quarantine.
- `accounts@sunpower.local`: view actual costs separately from customer charges, record payments and pay individual installation crew members.
- `admin@sunpower.local`: edit staff roles, skills, working days and active status with an audit reason. Deactivation revokes sessions and flags future visits for review.

## Rehearsal data and limits

`node --env-file=.env --import tsx scripts/seed-service-rehearsal.ts` adds these examples through the real API only when `DEMO_TOOLS=true`. Its marker prevents duplicates; rerunning it preserves existing records. It does not reset used equipment or invoices. Runtime IDs and links are saved locally in `output/scenarios/demo-rehearsal.json`.

The app is a responsive browser application for Windows and phone-sized screens. Native Android/Windows installers, physical camera checks, refunds, credit notes, supplier claims and other blocked catalogue workflows are not complete. Consult `docs/scenarios/EXECUTION.md` for every case; do not describe the full 200-case catalogue as passed.
