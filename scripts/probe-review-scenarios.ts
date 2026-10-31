/** Gap probes against the real API in a disposable schema. Failures describe unmet new requirements. */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";

try {
  process.loadEnvFile(".env");
} catch {}
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const schema = "solar_scenarios_" + randomUUID().replaceAll("-", "");
const adminDb = new Pool({ connectionString: process.env.DATABASE_URL });
const results: Record<string, any> = {};
let app: any, db: any;
const accounts: Record<string, any> = {};
function result(id: string, pass: boolean, observed: string) {
  results[id] = {
    status: pass ? "PASS" : "FAIL",
    evidence:
      "scripts/probe-review-scenarios.ts; output/scenarios/runtime-probes.json",
    observed,
    commit,
    environment:
      "Isolated PostgreSQL schema; Fastify injection; Windows; 31 October 2026",
    defect: pass ? "" : `GAP-${id}`,
  };
}
async function login(key: string, email: string) {
  const r = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { email, password: process.env.DEMO_PASSWORD },
  });
  if (r.statusCode !== 200) throw new Error("Probe sign-in failed: " + key);
  accounts[key] = {
    cookie: r.cookies.map((c: any) => `${c.name}=${c.value}`).join(";"),
    csrf: r.json().csrfToken,
    id: r.json().user.id,
  };
}
async function request(
  role: string,
  method: string,
  path: string,
  payload?: any,
) {
  const a = accounts[role];
  return app.inject({
    method,
    url: "/api" + path,
    headers: {
      cookie: a.cookie,
      "x-csrf-token": a.csrf,
      "idempotency-key": randomUUID(),
    },
    ...(payload ? { payload } : {}),
  });
}
async function post(path: string, payload: any) {
  const r = await request("admin", "POST", path, payload);
  if (r.statusCode !== 200)
    throw new Error(`Probe fixture command ${path}: ${r.statusCode} ${r.body}`);
  return r.json();
}
try {
  await adminDb.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = "test";
  process.env.DEMO_TOOLS = "true";
  process.env.UPLOAD_DIR = `tmp/test-uploads/${schema}`;
  const setup = new Pool({ connectionString: url.toString() });
  try {
    for (const f of (await readdir("db/migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await setup.query(await readFile("db/migrations/" + f, "utf8"));
  } finally {
    await setup.end();
  }
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "db/seeds/demo.ts"],
    { env: process.env, stdio: "pipe" },
  );
  db = (await import("../apps/api/src/db.js")).pool;
  app = await (await import("../apps/api/src/app.js")).buildApp();
  await app.ready();
  await login("admin", "admin@sunpower.local");
  await login("support", "support@sunpower.local");
  await login("tech", "deepa@sunpower.local");
  const intake = await request("support", "POST", "/projects", {
    name: "Scenario caller",
    phone: "9898989898",
    address: "Synthetic call site",
    capacity_kw: 3,
    system_type: "on_grid",
    source: "Phone",
    subsidy_interest: false,
  });
  result(
    "INT-01",
    intake.statusCode === 200,
    `Support installation intake returned HTTP ${intake.statusCode}; required success with an audited support actor.`,
  );
  const w = (
    await db.query(
      "SELECT w.*,o.project_id,o.id AS order_id FROM warranties w JOIN assets a ON a.id=w.asset_id JOIN order_lines l ON l.id=w.order_line_id JOIN orders o ON o.id=l.order_id JOIN jobs j ON j.order_id=o.id WHERE a.status='delivered' AND w.expires_at>now() AND j.technician_id IS DISTINCT FROM $1 ORDER BY w.expires_at LIMIT 1",
      [accounts.tech.id],
    )
  ).rows[0];
  if (!w) throw new Error("Missing covered probe fixture");
  const unknown = await request("support", "POST", "/tickets", {
    customer_id: randomUUID(),
    project_id: w.project_id,
    complaint: "Low output, component unknown",
    fault_code: "UNKNOWN",
  });
  result(
    "SRV-01",
    unknown.statusCode === 200,
    `Complaint without a preselected warranty returned HTTP ${unknown.statusCode}; current contract requires warranty_id before diagnosis.`,
  );
  const t = await post("/tickets", {
    warranty_id: w.id,
    complaint: "Synthetic inverter fault",
    fault_code: "TEST",
    assigned_to: accounts.tech.id,
  });
  result(
    "WAR-01",
    t.covered === true && /delivery/i.test(t.coverage_reason),
    `Active device ticket saved covered=${t.covered} with delivery-based reason.`,
  );
  const access = await request("tech", "GET", `/projects/${w.project_id}`);
  result(
    "SRV-03",
    access.statusCode === 200,
    `A different technician assigned to this repair received HTTP ${access.statusCode} when opening the site project.`,
  );
  const old = (await db.query("SELECT * FROM assets WHERE id=$1", [w.asset_id]))
    .rows[0];
  const replacement = (
    await db.query(
      "SELECT * FROM assets WHERE product_id=$1 AND status='available' ORDER BY serial LIMIT 1",
      [old.product_id],
    )
  ).rows[0];
  const resolved = await request(
    "admin",
    "POST",
    `/tickets/${t.id}/resolution`,
    {
      resolution: "Synthetic repair completed without a photo",
      parts_cost_minor: 0,
      labour_cost_minor: 10000,
      replacement_serial: replacement.serial,
    },
  );
  result(
    "EVD-01",
    resolved.statusCode === 409,
    `Repair resolution without any repair photo returned HTTP ${resolved.statusCode}; required completion rejection.`,
  );
  const freeInvoices = (
    await db.query("SELECT * FROM invoices WHERE ticket_id=$1", [t.id])
  ).rows;
  result(
    "BIL-01",
    freeInvoices.length === 1,
    `Covered replacement created ${freeInvoices.length} service documents; required a visible zero-payable replacement line.`,
  );
  const nw = (
    await db.query("SELECT * FROM warranties WHERE asset_id=$1", [
      replacement.id,
    ])
  ).rows[0];
  result(
    "RMA-10",
    !!nw &&
      nw.starts_at.toISOString() === w.starts_at.toISOString() &&
      nw.expires_at.toISOString() === w.expires_at.toISOString(),
    "Replacement warranty dates compared directly with the original saved dates.",
  );
  const exp = (
    await db.query(
      "SELECT w.*,o.id AS order_id FROM warranties w JOIN assets a ON a.id=w.asset_id JOIN order_lines l ON l.id=w.order_line_id JOIN orders o ON o.id=l.order_id WHERE a.status='delivered' AND w.expires_at<now() LIMIT 1",
    )
  ).rows[0];
  if (!exp) throw new Error("Missing expired probe fixture");
  const initial = (
    await db.query(
      "SELECT i.*,jsonb_agg(l ORDER BY l.id) AS lines FROM invoices i JOIN invoice_lines l ON l.invoice_id=i.id WHERE i.order_id=$1 AND i.kind='installation' GROUP BY i.id",
      [exp.order_id],
    )
  ).rows;
  const et = await post("/tickets", {
    warranty_id: exp.id,
    complaint: "Expired inverter test",
    fault_code: "TEST",
  });
  result(
    "WAR-02",
    et.covered === false,
    `Expired device ticket saved covered=${et.covered}.`,
  );
  const original = (
    await db.query("SELECT * FROM assets WHERE id=$1", [exp.asset_id])
  ).rows[0];
  const spare = (
    await db.query(
      "SELECT * FROM assets WHERE product_id=$1 AND status='available' LIMIT 1",
      [original.product_id],
    )
  ).rows[0];
  await db.query(
    "UPDATE products SET price_minor=1800000,stock_value_minor=stock_value_minor+1400000-$2 WHERE id=$1",
    [original.product_id, spare.cost_minor],
  );
  await db.query("UPDATE assets SET cost_minor=1400000 WHERE id=$1", [
    spare.id,
  ]);
  const er = await post(`/tickets/${et.id}/resolution`, {
    resolution: "Synthetic paid replacement",
    parts_cost_minor: 1800000,
    labour_cost_minor: 0,
    replacement_serial: spare.serial,
  });
  result(
    "BIL-05",
    er.customer_charge_minor === 1800000,
    `Replacement customer charge was INR ${er.customer_charge_minor / 100}; approved-price fixture is INR 18000 and acquisition cost INR 14000.`,
  );
  const initialAfter = (
    await db.query(
      "SELECT i.*,jsonb_agg(l ORDER BY l.id) AS lines FROM invoices i JOIN invoice_lines l ON l.invoice_id=i.id WHERE i.order_id=$1 AND i.kind='installation' GROUP BY i.id",
      [exp.order_id],
    )
  ).rows;
  const paidInvoices = (
    await db.query(
      "SELECT * FROM invoices WHERE ticket_id=$1 AND kind='service'",
      [et.id],
    )
  ).rows;
  result(
    "BIL-03",
    paidInvoices.length === 1 &&
      JSON.stringify(initial) === JSON.stringify(initialAfter),
    "Compared complete original invoice and lines before/after repair; checked a separate linked service invoice exists.",
  );
  const jobs = (
    await db.query(
      "SELECT id FROM jobs WHERE status IN ('unassigned','scheduled') ORDER BY id LIMIT 2",
    )
  ).rows;
  const at = "2027-02-02T04:30:00.000Z";
  await post(`/jobs/${jobs[0].id}/assignment`, {
    technician_id: accounts.tech.id,
    scheduled_at: at,
    duration_hours: 4,
  });
  const overlap = await request(
    "admin",
    "POST",
    `/jobs/${jobs[1].id}/assignment`,
    { technician_id: accounts.tech.id, scheduled_at: at, duration_hours: 4 },
  );
  result(
    "SCH-06",
    overlap.statusCode === 409,
    `Overlapping installation assignment returned HTTP ${overlap.statusCode}; does not test shared repair scheduling.`,
  );
  await mkdir("output/scenarios", { recursive: true });
  await writeFile(
    "output/scenarios/runtime-probes.json",
    JSON.stringify(
      { commit, generated_at: new Date().toISOString(), results },
      null,
      2,
    ),
  );
  await writeFile(
    "docs/scenarios/execution.json",
    JSON.stringify(results, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        executed: Object.keys(results).length,
        pass: Object.values(results).filter((r) => r.status === "PASS").length,
        fail: Object.values(results).filter((r) => r.status === "FAIL").length,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await app?.close();
  await db?.end();
  await adminDb.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await adminDb.end();
}
