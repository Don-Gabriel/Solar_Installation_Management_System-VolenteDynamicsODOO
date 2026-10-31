import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const catalog = read("docs/scenarios/catalog.json");
const backend = read("output/scenarios/backend-results.json");
const browser = read("output/scenarios/browser-results.json");
const backup = read("output/backup-check/result.json");
const overrides = read("docs/scenarios/review-overrides.json");
const changedSource = execFileSync(
  "git",
  [
    "diff",
    "--name-only",
    "HEAD",
    "--",
    "apps",
    "packages",
    "db",
    "tests",
    "package.json",
    "package-lock.json",
  ],
  { encoding: "utf8" },
).trim();
if (changedSource)
  throw Error(
    "Commit the tested application source before recording its revision: " +
      changedSource,
  );
if (
  !backend.success ||
  backend.numFailedTests ||
  browser.stats.unexpected ||
  browser.stats.flaky ||
  browser.stats.skipped
)
  throw Error(
    "Resolve failing, flaky or skipped checks before publishing this acceptance snapshot.",
  );
const evidence = new Map();
function add(title, passed, source) {
  for (const id of new Set(title.match(/\b[A-Z]{3}-\d{2}\b/g) || [])) {
    if (!catalog.cases.some((c) => c.id === id))
      throw Error(`Unknown scenario ${id}`);
    const entries = evidence.get(id) || [];
    entries.push({ passed, test: title, source });
    evidence.set(id, entries);
  }
}
for (const suite of backend.testResults)
  for (const test of suite.assertionResults)
    add(
      test.fullName,
      test.status === "passed",
      "tests/integration/lifecycle.test.ts",
    );
function walk(suite) {
  for (const spec of suite.specs || [])
    for (const test of spec.tests || [])
      add(
        `${spec.title} (${test.projectName})`,
        test.status === "expected" && test.results.at(-1)?.status === "passed",
        `tests/e2e/${spec.file}`,
      );
  for (const child of suite.suites || []) walk(child);
}
for (const suite of browser.suites) walk(suite);
add(
  "[OPS-04] PostgreSQL dump and restore, financial totals and private photo bytes",
  backup.status === "PASS",
  "scripts/check-backup-restore.ts",
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const checked = new Date().toISOString();
const register = {};
for (const c of catalog.cases) {
  const entries = evidence.get(c.id) || [];
  const result = entries.length
    ? {
        status: entries.every((e) => e.passed) ? "PASS" : "FAIL",
        observed: entries
          .map((e) => `${e.passed ? "Passed" : "Failed"}: ${e.test}`)
          .join("; "),
        evidence: [...new Set(entries.map((e) => e.source))].join("; "),
        defect: "",
      }
    : {
        status: "NOT RUN",
        observed: "No scenario-specific runtime evidence.",
        evidence: "",
        defect: `GAP-${c.id}`,
      };
  if (overrides[c.id]) {
    Object.assign(result, overrides[c.id]);
    if (entries.length) result.partial_evidence = entries;
  }
  register[c.id] = {
    ...result,
    checked_at: checked,
    commit,
    environment:
      "Windows; Node 24; PostgreSQL 18; isolated API schemas; Chromium desktop and WebKit mobile emulation. Physical devices and native binaries unverified.",
  };
}
if (Object.keys(register).length !== 200)
  throw Error("Expected exactly 200 scenarios");
for (const id of Object.keys(overrides))
  if (!register[id]) throw Error(`Unknown override ${id}`);
const regressions = [
  "INT-01",
  "SRV-01",
  "SRV-03",
  "EVD-01",
  "BIL-01",
  "BIL-05",
];
for (const id of regressions)
  if (register[id].status !== "PASS")
    throw Error(`Review regression ${id} has not passed`);
const counts = Object.values(register).reduce(
  (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
  {},
);
writeFileSync(
  "docs/scenarios/execution.json",
  JSON.stringify(register, null, 2) + "\n",
);
const lines = [
  "# Scenario execution register",
  "",
  `Checked ${checked}. Application source commit: ${commit}.`,
  "",
  `All 200 scenarios assessed: ${Object.entries(counts)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ")}.`,
  "",
  `${backend.numPassedTests}/${backend.numTotalTests} backend tests passed. Browser results and restore checks are recorded separately. A test can verify several named scenarios; 200 scenarios does not mean 200 automated test functions.`,
  "",
  "BLOCKED means the full required workflow or necessary test environment is unavailable. Some blocked scenarios have partial passing checks, retained in execution.json. They are not counted as passes. Source assessments in the original catalogue remain the historical d0d1038 baseline.",
  "",
  "## Six review failures",
  "",
  ...regressions.map((id) => `- ${id}: PASS`),
  "",
  "## Results",
  "",
  "| Scenario | Result | Observed result or blocker |",
  "| --- | --- | --- |",
];
for (const c of catalog.cases)
  lines.push(
    `| ${c.id} ${c.title} | ${register[c.id].status} | ${register[c.id].observed.replaceAll("|", "/").replaceAll("\n", " ")} |`,
  );
writeFileSync("docs/scenarios/EXECUTION.md", lines.join("\n") + "\n");
console.log(
  JSON.stringify(
    { scenarios: 200, counts, backend_tests: backend.numTotalTests, commit },
    null,
    2,
  ),
);
