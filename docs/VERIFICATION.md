# Verification record

## Scheduling and warranty revision — 31 October 2026

Application source commit `3f337d4` passed the independent [GitHub Actions run](https://github.com/Don-Gabriel/Solar_Installation_Management_System-VolenteDynamicsODOO/actions/runs/41186050178): clean dependency installation, TypeScript checks, **76 PostgreSQL/API tests**, production build and **21 browser tests across Chromium, Firefox and WebKit**. Local Windows checks passed all 76 backend tests and 14 Chromium/WebKit journeys. Firefox was verified on Linux CI; its local Windows runtime cannot launch on this machine.

All six initial review failures passed focused retests: support installation intake (INT-01), complaint before component diagnosis (SRV-01), repair-assigned worker access (SRV-03), required repair photo (EVD-01), a visible zero-payable replacement document (BIL-01), and selling price separate from company cost (BIL-05).

The complete 200-case acceptance register currently contains **137 PASS and 63 BLOCKED**, with zero executed failures. This is not a 200-case pass or a complete release. Blockers include missing workflows and unavailable device/native environments. Partial checks remain attached to blocked scenarios; for example, protecting an issued invoice does not prove that its missing credit-note correction workflow exists. See [the exact register](scenarios/EXECUTION.md).

Scheduling checks cover the 13-busy/two-free interval, qualifications, leave, office hours, 30-minute buffers, installation/repair conflicts, multi-worker crews, simultaneous coordinators, stale suggestions and atomic rescheduling. The load fixture contains 1,000 projects and 200 service requests; all searchable records were recovered. Ten concurrent users had maximum local search time below 35 ms and availability time below 200 ms in the recorded run, against 2,000/3,000 ms limits. These are local Fastify/PostgreSQL measurements, not internet or production capacity guarantees.

Warranty checks cover per-component decisions, independent labour cover, callout lines, complaint-date expiry, unknown-policy review, approval invalidation, current-visit/current-diagnosis photos, quarantined returns, serial lineage, stock races and rollback after an injected invoice error. MIX1 uses a real connector product fixture and verifies ₹900 connectors + ₹600 labour + ₹200 callout = ₹1,700, while the ₹18,000 covered inverter remains visible at zero payable. A separate check verifies both charged and credited callout treatment.

The live synthetic workspace preserves 40 projects, 34 employees across eight roles and 198 device identities. The optional service rehearsal script adds two completed synthetic repair examples and one unassigned request through the real API; its second run preserved the existing examples. Evidence images explicitly identify themselves as simulations. Database dump/restore reconciled all 37 table counts, invoiced and collected totals, and both live private-file hashes in an isolated database. An additional synthetic photo roundtrip verified a restored evidence link, byte size and SHA-256.

Physical phone camera/printer checks, installed native applications and full assistive-technology evaluation remain unverified. Automated accessibility samples and mobile emulation are narrower checks. Older records below describe earlier revisions and retain their historical counts.

Verified locally on Windows, 31 October 2026, using Node 24.15.0 and dedicated PostgreSQL 18.6. Results describe this build, not a security certification or a claim of production readiness.

The previous [GitHub Actions Linux run for application commit 1aa525c](https://github.com/Don-Gabriel/Solar_Installation_Management_System-VolenteDynamicsODOO/actions/runs/41173148316) completed successfully: clean `npm ci`, type checks, **20 integration tests**, production build and **6 browser tests across Chromium, Firefox and WebKit**. The new usability revision is recorded separately below.

## Usability revision - 31 October 2026

- Independent [GitHub Actions run for c46de26](https://github.com/Don-Gabriel/Solar_Installation_Management_System-VolenteDynamicsODOO/actions/runs/41177351599) passed clean installation, type checks, **22 integration tests**, build and **15 browser tests across Chromium, Firefox and WebKit**. This following record update changes documentation only.
- Type checks and production build passed.
- **22 PostgreSQL integration tests passed**, including the complete barcode library, administrator-only staff directory, denied access for other roles, disabled test helpers and proof that the available-serial picker does not mutate stock.
- **10 local browser tests passed across Chromium and WebKit**: full saved installation journey, public enquiry, next-step navigation, retained search/stage after returning and reloading, mobile menu Escape behavior, six screen overflow/accessibility checks, and separate staff-role sessions with server denial checks.
- Axe checks report no violations for the selected WCAG 2 A/AA and 2.1 AA tags on Home and the six phone screens: staff, barcodes, guide, stock, repairs and reports. This is automated sample coverage, not full conformance.
- Demo export confirms **40 projects, 32 staff (19 installers), and 198 serialized devices**. Seed expansion preserves existing demo work and has its own idempotent marker.
- Generated and visually reviewed **29 guide pages and 18 barcode pages**. Software decoding matches all **198 PNG labels and 198 unique PDF labels** to saved serials. Actual printed-label/camera scanning remains unverified.
- `npm audit --omit=dev`: **0 reported vulnerabilities**. Full dependency audit still reports six low-severity development advisories.
- Static Latin font weights replace variable-font imports after a WebKit readability issue. Focusable table regions, wrapped phone tabs and inactive-tab colors were corrected based on browser failures and retested successfully.
- The guide documents the remaining lack of a general in-app unsaved-form guard. Save forms before changing sections. List search/filter context is retained.

The results below describe the earlier baseline where counts differ.

## Passed

- `npm run typecheck`: frontend and backend.
- `npm test`: **20 integration tests**, running against a newly created PostgreSQL schema with real migrations and seed data. Coverage includes authentication, CSRF/origins, roles, survey gates, immutable accepted prices, retry/idempotency conflicts, overpayment, advance requirements, mandatory/wrong/duplicate serial scans, concurrent allocation, duplicate receipt rollback, delivery-only warranties, scheduling conflicts, missing evidence, free covered service, exact expired-service billing, replacement lineage, inherited coverage, financial reconciliation and a fresh server instance.
- Independent financial fixture: Sneha & Arun invoice/collected ₹139,300; material ₹83,900; installation labour ₹2,100; completed contribution ₹53,300.
- `npm run build`: client assets/PWA shell and compiled server.
- `node scripts/test-e2e.mjs --project=chromium --project=webkit`: **4 browser tests passed**. Both engines exercise the full persisted enquiry → survey → approval → quotation → payment → reserve → serial scan → dispatch → delivery → assignment → evidence → handover journey, plus anonymous public enquiry. Chromium tests drawing/saving a signature; WebKit tests the signature-image fallback. Evidence remains after reload. No captured browser console errors in the full journey.
- Chromium overview checked at widths **360, 390, 430, 768, 1280 and 1440**, without page-level horizontal overflow. WebKit executes the full journey at 390 × 844 with mobile/touch emulation.
- Automated axe WCAG 2 A/AA and 2.1 AA checks pass on the overview in both tested engines. This is limited coverage, not a full accessibility audit.
- Packaged app serves `/` with HTTP 200. A real restart of the dedicated project PostgreSQL cluster preserved the authenticated session and identical dashboard data: 12 seeded projects and 21 accounts remained.
- A separate clean manifest/lockfile installation with `npm ci --ignore-scripts` succeeded. Native dependencies were exercised in the main workspace build and tests; the separate clean install only verifies dependency resolution.
- `docker compose config --quiet`: configuration validates with supplied environment values.
- `git diff --check`: no whitespace errors.
- `npm audit --omit=dev`: **0 reported production vulnerabilities** at verification time. Full dependency audit reports **6 low-severity development-tool advisories** associated with deepmerge and dependents; no moderate/high/critical advisories. Root overrides pin glob 14.0.3 and minimatch 11.0.3, and the app/build tests passed with them.

## Limitations and remaining release checks

- Playwright's downloaded Firefox cannot launch on this Windows machine, including after reinstall. Windows reported a side-by-side `mozglue` assembly failure; the fresh attempt returns a process-launch error. The same full journey and public enquiry tests **passed in Firefox on Linux CI**. Windows Firefox remains unverified.
- No physical phone/camera test, actual barcode-camera scan, or HTTPS deployment was performed. Phone-width browser emulation verifies layout and the workflow; manual serial entry and file uploads were tested.
- Docker Compose was validated but the container image and full container startup were not executed. The native Windows setup is the verified route.
- No full manual screen-reader, load/soak, penetration, backup/restore or external user acceptance test was performed. Static PWA registration is built; installed-phone behavior and offline relaunch are unverified. Offline writes are intentionally unsupported.
- The linked Linux CI run passed. No public deployment or hackathon submission has been made.

## Evidence and reproducibility

Local screenshots are under `output/qa/`: desktop/phone overview and completed installation. Playwright reports and failure traces are under `output/`; runtime uploads and test schemas are separate from the demo. These generated outputs are ignored by Git.

Setup commands are in [README.md](../README.md). Test schemas use validated random names and are dropped at runner completion. Abruptly killing a runner can leave its isolated schema; it does not reset public demo records. A historical seed includes explicitly synthetic completed jobs without real homeowner photos/signatures; new completions through the application require both.
