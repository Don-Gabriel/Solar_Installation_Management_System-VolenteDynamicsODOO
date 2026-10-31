/** Re-run the six review regressions through the real database/API integration suite. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const output = "output/scenarios";
await mkdir(output, { recursive: true });
execFileSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--reporter=json",
    "--outputFile=" + output + "/review-tests.json",
    "-t",
    "INT-01|SRV-01|EVD-01|BIL-01|BIL-05",
  ],
  { stdio: "inherit", env: process.env },
);
const report = JSON.parse(
  await readFile(output + "/review-tests.json", "utf8"),
);
const tests = report.testResults.flatMap((r: any) => r.assertionResults);
const results: any = {};
for (const id of ["INT-01", "SRV-01", "SRV-03", "EVD-01", "BIL-01", "BIL-05"]) {
  const relevant = tests.filter((t: any) => t.fullName.includes(id));
  results[id] = {
    status:
      relevant.length && relevant.every((t: any) => t.status === "passed")
        ? "PASS"
        : "FAIL",
    evidence:
      "tests/integration/lifecycle.test.ts; output/scenarios/review-tests.json",
    observed: relevant.map((t: any) => t.fullName).join("; "),
    checked_at: new Date().toISOString(),
  };
}
await writeFile(
  output + "/runtime-probes.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
if (Object.values(results).some((r: any) => r.status !== "PASS"))
  process.exitCode = 1;
