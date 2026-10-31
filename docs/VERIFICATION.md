# Verification record

Updated 31 October 2026. Tested application revision: `f9e4e5fbb91ab5175ef10e0144f7cb43e46d2c6d`.

## Completed checks

- TypeScript checks and production frontend/API build passed.
- PostgreSQL-backed integration suite: **114 passed, zero failed**. Tests use disposable schemas, including concurrency, stale revisions, permission failures, stock balances, warranty decisions and financial corrections.
- Browser suite: **28 passed, zero failed or skipped**, covering Chromium desktop and WebKit mobile emulation. Includes role-based navigation, interrupted drafts, full repair completion, reviewed invoice credits, remote support, scheduling and reviewed stock counts.
- All six original review regressions passed again through `scripts/probe-review-scenarios.ts`.
- The complete 200-case register records **194 PASS, 6 BLOCKED, 0 FAIL, 0 NOT RUN**. A scenario can be supported by an API test, a browser journey or both; this does not mean 200 separate full browser journeys ran.
- Backup and disposable restore passed for **58 tables and 2 private evidence files**. Financial totals and file bytes matched.
- Local load scenario checked 1,000 searchable projects and 200 requests. This is local synthetic-load evidence, not a production capacity guarantee.
- All **198 individual barcode images** and all **198 labels in the printable PDF** decoded successfully in software. Physical camera scanning remains unverified.
- The local application at `http://127.0.0.1:3001` reports a connected database. Migrations 001–023 are applied, preserving the demo workspace.
- File inventory: **376 files**, exactly two purpose sentences each, no introduction. All filenames were checked against the extracted PDF and page text stayed inside the margins.
- Screen guide: **32 pages**. Barcode PDF: **18 pages**. Scenario document: **68 pages**, with every scenario identifier present and text bounds checked. PDF page renders were inspected for layout.

## Remaining acceptance limitations

- **EVD-05**: A file picker is available; camera-denial recovery still needs a physical-device test.
- **UXP-04**: Responsive browser widths pass, but a physical phone with the software keyboard open was not tested.
- **UXP-05**: Automated accessibility checks and Escape behavior pass; a full screen-reader and keyboard-only walkthrough remains unverified.
- **UXP-06**: No signed Android native build exists. Responsive mobile web/PWA is the implemented client.
- **UXP-07**: No signed Windows native build exists. Desktop web/PWA is the implemented client.
- **UXP-09**: All generated barcode images can be decoded by software; physical-phone camera scanning in HTTPS remains unverified.

Firefox automation could not launch on this Windows host (`spawn UNKNOWN`), even after checking the installed browser package. The passing local browser report explicitly covers Chromium and WebKit; Firefox is not represented as locally passed. The repository CI configuration also defines Firefox on Linux, whose result must be checked separately.

The application is responsive browser/PWA software, not a signed React Native Android or Windows package. Mobile emulation cannot establish physical camera permission behavior, software-keyboard usability or a complete screen-reader walkthrough. The user is handling physical barcode checks; no unreported manual outcome is counted as a pass.

## Important demo policies

Warranty coverage starts on receipt of the relevant delivery line. Serial replacements retain original warranty dates; engineering compatibility is an explicitly recorded human decision. Supplier reimbursement never changes customer entitlement. Financial documents use integer paise; no tax configuration or external payment-provider settlement integration is claimed.

Scheduling uses the stated 30-minute travel buffer and recorded working days, skills, holidays and leave. It does not use a live travel-time provider. A supplier parts estimate is not a confirmed repair appointment; readiness and stock are checked again before booking and completion.

Enquiry and diagnosis drafts can recover in the same browser tab after interruption. They require manual submission after reconnection; background synchronization of offline transactions is not implemented.

## Evidence and reproducibility

The scenario register stores each requirement, its specific test evidence, checked time, environment and tested application revision. The register refuses failing/flaky/skipped browser results and uncommitted application source. Runtime reports, generated PDFs, local credentials and uploaded evidence are excluded from Git.

Use `npm test` for API checks and `npm run build` followed by `node scripts/test-e2e.mjs --project=chromium --project=webkit` for the verified Windows browser configurations. Use `node scripts/training-workspace.mjs rehearsal` to create an isolated named training dataset and add `--reset` only when replaying that same marked dataset.
