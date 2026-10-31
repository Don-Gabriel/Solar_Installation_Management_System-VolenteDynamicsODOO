# Scenario execution record

Baseline application commit: `d0d1038dbbcf9e4c519f7f721870e87cc0ac159c`. Executed on Windows against a newly created PostgreSQL schema on 31 October 2026. The schema was dropped after completion. No live demo business records were changed.

## Initial focused checks

The probe executed **11 catalogue scenarios: 5 passed and 6 failed**. **189 remain NOT RUN.** This is not a full acceptance result. The original regression suite exercises the earlier requirements; its success does not remove these newly identified gaps.

The unchanged baseline was also rerun: type checks passed, all **22 integration tests** passed, and **10 browser tests** passed across local Chromium and WebKit. These counts are reported separately from the 200-case catalogue and are not added to its pass count.

| Defect | Observed behavior | Required change |
| --- | --- | --- |
| GAP-INT-01 | Support enquiry creation returns 403 | Add controlled support intake permission and UI |
| GAP-SRV-01 | Complaint without a selected warranty returns 400 | Allow site-level intake before diagnosis |
| GAP-SRV-03 | Repair-assigned worker receives 403 for the site project | Authorize access through the current repair assignment |
| GAP-EVD-01 | Repair resolution without photos succeeds | Add repair visit evidence and completion gates |
| GAP-BIL-01 | Covered replacement creates no service document | Produce visible zero-payable replacement lines |
| GAP-BIL-05 | INR 14000 acquisition cost becomes the customer charge despite INR 18000 selling-price fixture | Separate approved selling prices from internal costs |

The passing focused cases are active coverage, expired coverage, inherited replacement dates, a separate service invoice without changing the original invoice, and rejection of overlapping **installation** assignments. The latter is not proof of repair scheduling or the F15 availability search.

## Reproduce and regenerate

```sh
npx tsx scripts/probe-review-scenarios.ts
node scripts/create-scheduling-fixture.mjs
python scripts/create-scenario-document.py
python scripts/verify-scenario-document.py
```

The probe is a diagnostic harness: successful process completion means observations were captured, not that required behaviors all passed. Read the explicit PASS/FAIL results. Its source should be evolved into stable acceptance tests when the new service model and endpoints are implemented. It does not create a native app or implement the missing workflows.

`execution.json` contains scenario-level results and the tested commit. `catalog.json` merges those results with the specification. The editable human-readable document is `docs/SCENARIO_CATALOG.md`; the PDF and CSV test register are local generated outputs under `output/`. `F15-fixture.json` defines 27 named synthetic employees, eight proposed roles, exactly 15 field technicians and 39 busy intervals. It is a fixture specification, not an imported production seed.

The Python authoring/verification tools use ReportLab, PyMuPDF and Pillow, with Arial registered from Windows font paths. PDF visual review follows generated contact sheets and full-size sample pages. Validate the document after changing any case, execution result or policy.

## Next acceptance work

Implement the role and service-data foundations first, followed by the shared calendar, repair assignment/access, diagnosis/evidence and itemized warranty billing. Then execute every remaining catalogue case with evidence. Keep failed requirements visible until both the implementation and its regression tests pass. Device, backup, external policy and native packaging gates require their actual environments; source inspection cannot complete them.
