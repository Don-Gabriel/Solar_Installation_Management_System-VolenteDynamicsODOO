import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import type { FastifyInstance } from "fastify";
const baseUrl = process.env.DATABASE_URL!;
const schema = `solar_test_${randomUUID().replaceAll("-", "")}`;
const adminDb = new Pool({ connectionString: baseUrl });
let app: FastifyInstance,
  db: any,
  accounts: Record<string, { cookie: string; csrf: string; id: string }> = {};
const id = () => randomUUID();
async function login(role: string, email = `${role}@sunpower.local`) {
  const r = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { email, password: process.env.DEMO_PASSWORD },
  });
  expect(r.statusCode, r.body).toBe(200);
  accounts[role] = {
    cookie: r.cookies.map((c) => `${c.name}=${c.value}`).join(";"),
    csrf: r.json().csrfToken,
    id: r.json().user.id,
  };
  return r;
}
async function req(
  method: "GET" | "POST",
  url: string,
  payload?: any,
  role = "admin",
  key = id(),
) {
  const a = accounts[role];
  return app.inject({
    method,
    url: `/api${url}`,
    headers: {
      cookie: a.cookie,
      "x-csrf-token": a.csrf,
      "idempotency-key": key,
    },
    ...(payload !== undefined
      ? { payload }
      : method === "POST"
        ? { payload: {} }
        : {}),
  });
}
async function post(
  url: string,
  payload: any = {},
  role = "admin",
  key = id(),
) {
  const r = await req("POST", url, payload, role, key);
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
}
async function get(url: string, role = "admin") {
  const r = await req("GET", url, undefined, role);
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
}
async function enquiry() {
  return post("/projects", {
    name: `QA ${id().slice(0, 7)}`,
    phone: "9898989898",
    address: "Synthetic QA site",
    capacity_kw: 1,
    system_type: "on_grid",
    source: "Test",
    subsidy_interest: true,
  });
}
async function surveyed() {
  const p = await enquiry();
  await post(`/projects/${p.id}/surveys`, {
    roof_area: 20,
    bill_minor: 200000,
    grid_suitable: true,
    direction: "South",
    tilt: 12,
    cable_distance: 15,
  });
  await post(`/projects/${p.id}/survey-approval`, { approved: true });
  return p;
}
async function ordered() {
  const p = await surveyed();
  await post(`/projects/${p.id}/quotes`);
  await post(`/projects/${p.id}/acceptance`);
  return get(`/projects/${p.id}`);
}
async function paid() {
  const d = await ordered();
  await post(`/invoices/${d.invoices[0].id}/payments`, {
    amount_minor: d.order.minimum_advance_minor,
    method: "bank",
    reference: id(),
  });
  await post(`/orders/${d.order.id}/reservations`);
  return get(`/projects/${d.project.id}`);
}
async function scanAll(d: any) {
  for (const l of d.order.lines.filter((l: any) => l.kind === "serialized")) {
    const assets = (
      await db.query(
        "SELECT serial FROM assets WHERE product_id=$1 AND status='available' ORDER BY serial LIMIT $2",
        [l.product_id, l.quantity],
      )
    ).rows;
    for (const a of assets)
      await post(`/orders/${d.order.id}/scans`, { serial: a.serial });
  }
}
async function delivered() {
  const d = await paid();
  await scanAll(d);
  await post(`/orders/${d.order.id}/dispatch`);
  await post(`/orders/${d.order.id}/delivery`);
  return get(`/projects/${d.project.id}`);
}
beforeAll(async () => {
  expect(baseUrl, "DATABASE_URL must be configured").toBeTruthy();
  await adminDb.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(baseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.UPLOAD_DIR = `./tmp/test-uploads/${schema}`;
  const setup = new Pool({ connectionString: process.env.DATABASE_URL });
  for (const f of (await readdir("db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await setup.query(await readFile(`db/migrations/${f}`, "utf8"));
  await setup.end();
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "db/seeds/demo.ts"],
    { env: process.env, stdio: "pipe" },
  );
  db = (await import("../../apps/api/src/db.js")).pool;
  app = await (await import("../../apps/api/src/app.js")).buildApp();
  await app.ready();
  await login("admin");
  await login("warehouse");
  await login("sales");
  await login("surveyor");
  await login("support");
  await login("accounts");
  await login("technician", "arjun@sunpower.local");
});
afterAll(async () => {
  await app?.close();
  await db?.end();
  if (/^solar_test_[a-f0-9]{32}$/.test(schema))
    await adminDb.query(`DROP SCHEMA ${schema} CASCADE`);
  await adminDb.end();
});
describe("Session and authorization", () => {
  it("uses HttpOnly, strict same-site cookies and rejects anonymous requests", async () => {
    const r = await app.inject({ url: "/api/projects" });
    expect(r.statusCode).toBe(401);
    const l = await login("admin");
    expect(l.headers["set-cookie"]).toContain("HttpOnly");
    expect(l.headers["set-cookie"]).toContain("SameSite=Strict");
  });
  it("requires CSRF and rejects foreign origins", async () => {
    const a = accounts.admin;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          headers: { cookie: a.cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/login",
          headers: { origin: "https://attacker.invalid" },
          payload: { email: "admin@sunpower.local", password: "wrong" },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("blocks financial and administrative commands for warehouse and technicians", async () => {
    expect(
      (await req("GET", "/reports", undefined, "technician")).statusCode,
    ).toBe(403);
    const p = await enquiry();
    expect(
      (
        await req(
          "POST",
          `/projects/${p.id}/survey-approval`,
          { approved: true },
          "warehouse",
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await req("GET", `/projects/${p.id}`, undefined, "technician"))
        .statusCode,
    ).toBe(403);
  });
  it("validates request contracts and rejects unknown fields", async () => {
    expect(
      (await req("POST", "/projects", { name: "X", capacity_kw: 99 }))
        .statusCode,
    ).toBe(400);
    const r = await req("POST", "/projects", {
      name: "X",
      phone: "9898989898",
      address: "Test",
      capacity_kw: 1,
      system_type: "on_grid",
      source: "Test",
      subsidy_interest: false,
      evil: true,
    });
    expect(r.statusCode).toBe(400);
  });
});
describe("Sales lifecycle and snapshots", () => {
  it("blocks direct quote issuance without an approved survey", async () => {
    const p = await enquiry();
    const r = await req("POST", `/projects/${p.id}/quotes`);
    expect(r.statusCode).toBe(409);
    expect(r.json().error.message).toMatch(/survey/i);
  });
  it("rejects insufficient roofs and unsuitable on-grid connection", async () => {
    const p = await enquiry();
    await post(`/projects/${p.id}/surveys`, {
      roof_area: 3,
      bill_minor: 100000,
      grid_suitable: false,
      direction: "South",
      tilt: 10,
      cable_distance: 5,
    });
    expect(
      (
        await req("POST", `/projects/${p.id}/survey-approval`, {
          approved: true,
        })
      ).statusCode,
    ).toBe(409);
  });
  it("acceptance is idempotent and material prices remain snapshots", async () => {
    const p = await surveyed(),
      q = await post(`/projects/${p.id}/quotes`);
    const key = id();
    const a = await post(`/projects/${p.id}/acceptance`, {}, "admin", key),
      b = await post(`/projects/${p.id}/acceptance`, {}, "admin", key),
      c = await post(`/projects/${p.id}/acceptance`);
    expect(a.id).toBe(b.id);
    expect(c.id).toBe(a.id);
    const d = await get(`/projects/${p.id}`);
    await db.query(
      "UPDATE products SET price_minor=price_minor+1 WHERE id=$1",
      [d.quotes[0].lines[0].product_id],
    );
    const after = await get(`/projects/${p.id}`);
    expect(after.order.total_minor).toBe(q.total_minor);
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM jobs WHERE order_id=$1",
          [a.id],
        )
      ).rows[0].n,
    ).toBe(1);
    await expect(
      db.query("UPDATE quote_lines SET unit_price_minor=1 WHERE quote_id=$1", [
        q.id,
      ]),
    ).rejects.toThrow(/immutable/);
  });
  it("does not duplicate payments and blocks overpayment or changed retries", async () => {
    const d = await ordered(),
      invoice = d.invoices[0],
      key = id(),
      body = {
        amount_minor: invoice.total_minor,
        method: "upi",
        reference: id(),
      };
    const first = await post(
      `/invoices/${invoice.id}/payments`,
      body,
      "admin",
      key,
    );
    expect(
      (await post(`/invoices/${invoice.id}/payments`, body, "admin", key)).id,
    ).toBe(first.id);
    expect((await post(`/invoices/${invoice.id}/payments`, body)).id).toBe(
      first.id,
    );
    expect(
      (
        await req(
          "POST",
          `/invoices/${invoice.id}/payments`,
          { ...body, amount_minor: 1 },
          "admin",
          key,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await req("POST", `/invoices/${invoice.id}/payments`, {
          ...body,
          reference: id(),
        })
      ).statusCode,
    ).toBe(409);
  });
});
describe("Inventory integrity and warranty timing", () => {
  it("blocks reservation before advance, incomplete scans and unknown serials", async () => {
    const d = await ordered();
    expect(
      (await req("POST", `/orders/${d.order.id}/reservations`)).statusCode,
    ).toBe(409);
    expect(
      (await req("POST", `/orders/${d.order.id}/dispatch`)).statusCode,
    ).toBe(409);
    expect(
      (
        await req("POST", `/orders/${d.order.id}/scans`, {
          serial: "NO-SUCH-DEVICE",
        })
      ).statusCode,
    ).toBe(404);
  });
  it("rejects a wrong product and duplicate serial scans", async () => {
    const d = await paid();
    const wrong = (
      await db.query(
        "SELECT serial FROM assets a JOIN products p ON p.id=a.product_id WHERE p.sku='INV5' AND a.status='available' LIMIT 1",
      )
    ).rows[0];
    expect(
      (await req("POST", `/orders/${d.order.id}/scans`, wrong)).statusCode,
    ).toBe(409);
    const line = d.order.lines.find((l: any) => l.kind === "serialized");
    const a = (
      await db.query(
        "SELECT serial FROM assets WHERE product_id=$1 AND status='available' LIMIT 1",
        [line.product_id],
      )
    ).rows[0];
    await post(`/orders/${d.order.id}/scans`, a);
    expect(
      (await req("POST", `/orders/${d.order.id}/scans`, a)).statusCode,
    ).toBe(409);
  });
  it("concurrent allocations can never claim the same physical device twice", async () => {
    const a = await paid(),
      b = await paid(),
      line = a.order.lines.find((l: any) => l.kind === "serialized");
    const device = (
      await db.query(
        "SELECT serial FROM assets WHERE product_id=$1 AND status='available' LIMIT 1",
        [line.product_id],
      )
    ).rows[0];
    const results = await Promise.all([
      req("POST", `/orders/${a.order.id}/scans`, device),
      req("POST", `/orders/${b.order.id}/scans`, device),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const row = (
      await db.query("SELECT order_line_id FROM assets WHERE serial=$1", [
        device.serial,
      ])
    ).rows[0];
    expect(row.order_line_id).toBeTruthy();
  });
  it("starts warranties on delivery only, and delivery retries preserve dates", async () => {
    const d = await paid();
    await scanAll(d);
    await post(`/orders/${d.order.id}/dispatch`);
    expect((await get(`/projects/${d.project.id}`)).warranties).toHaveLength(0);
    await post(`/orders/${d.order.id}/delivery`);
    const first = await get(`/projects/${d.project.id}`);
    expect(first.warranties.length).toBeGreaterThan(0);
    await post(`/orders/${d.order.id}/delivery`);
    const second = await get(`/projects/${d.project.id}`);
    expect(second.order.delivered_at).toBe(first.order.delivered_at);
    expect(second.warranties).toEqual(first.warranties);
    for (const w of first.warranties)
      expect(w.starts_at).toBe(first.order.delivered_at);
  });
  it("receipt rollback preserves stock when duplicate serials are submitted", async () => {
    const p = (await db.query("SELECT * FROM products WHERE sku='INV2'"))
      .rows[0];
    const duplicate = (
      await db.query("SELECT serial FROM assets WHERE product_id=$1 LIMIT 1", [
        p.id,
      ])
    ).rows[0].serial;
    expect(
      (
        await req("POST", "/receipts", {
          product_id: p.id,
          supplier: "QA",
          reference: id(),
          quantity: 1,
          unit_cost_minor: 10000,
          serials: [duplicate],
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await db.query("SELECT stock_qty FROM products WHERE id=$1", [p.id]))
        .rows[0].stock_qty,
    ).toBe(p.stock_qty);
  });
});
describe("Field work and service", () => {
  it("matches an independently calculated completed installation margin", async () => {
    const report = await get("/reports?period=all");
    const fixture = report.jobs.find((j: any) =>
      j.customer_name.includes("Sneha"),
    );
    expect(fixture).toBeTruthy();
    expect(fixture.invoiced_minor).toBe(13930000);
    expect(fixture.collected_minor).toBe(13930000);
    expect(fixture.material_cost_minor).toBe(8390000);
    expect(fixture.labour_cost_minor).toBe(210000);
    expect(fixture.contribution_minor).toBe(5330000);
  });
  it("traces replacement serials and preserves the original warranty dates", async () => {
    const d = await delivered();
    const w = d.warranties.find((w: any) => w.asset_id);
    const original = (
      await db.query("SELECT * FROM assets WHERE id=$1", [w.asset_id])
    ).rows[0];
    const replacement = (
      await db.query(
        "SELECT * FROM assets WHERE product_id=$1 AND status='available' ORDER BY serial LIMIT 1",
        [original.product_id],
      )
    ).rows[0];
    const ticket = await post("/tickets", {
      warranty_id: w.id,
      complaint: "Synthetic failed inverter",
      fault_code: "QA",
    });
    await post(`/tickets/${ticket.id}/resolution`, {
      resolution: "Device replaced and tested",
      parts_cost_minor: 0,
      labour_cost_minor: 10000,
      replacement_serial: replacement.serial,
    });
    const replacementWarranty = (
      await db.query("SELECT * FROM warranties WHERE asset_id=$1", [
        replacement.id,
      ])
    ).rows[0];
    expect(replacementWarranty.starts_at.toISOString()).toBe(w.starts_at);
    expect(replacementWarranty.expires_at.toISOString()).toBe(w.expires_at);
    expect(
      (await db.query("SELECT status FROM assets WHERE id=$1", [original.id]))
        .rows[0].status,
    ).toBe("replaced");
    const resolved = (await get("/tickets")).find(
      (t: any) => t.id === ticket.id,
    );
    expect(resolved.parts_cost_minor).toBe(replacement.cost_minor);
    expect(resolved.customer_charge_minor).toBe(0);
    expect(
      (
        await req("POST", "/tickets", {
          warranty_id: w.id,
          complaint: "Old device",
          fault_code: "QA",
        })
      ).statusCode,
    ).toBe(409);
  });
  it("blocks overlapping assignments and completion without saved evidence", async () => {
    const d = await delivered(),
      d2 = await delivered();
    const tech = accounts.technician.id;
    const schedule = {
      technician_id: tech,
      scheduled_at: "2030-01-01T09:00:00+05:30",
      duration_hours: 4,
    };
    await post(`/jobs/${d.job.id}/assignment`, schedule);
    expect(
      (await req("POST", `/jobs/${d2.job.id}/assignment`, schedule)).statusCode,
    ).toBe(409);
    await post(`/jobs/${d.job.id}/start`, {}, "technician");
    const r = await req(
      "POST",
      `/jobs/${d.job.id}/completion`,
      {
        capacity_kw: 1,
        generation_kw: 0.8,
        labour_minutes: 60,
        signer_name: "QA Customer",
        checklist: {
          mounting: true,
          earthing: true,
          wiring: true,
          inverter: true,
          handover: true,
        },
      },
      "technician",
    );
    expect(r.statusCode).toBe(409);
    expect(r.json().error.message).toMatch(/photo.*signature/);
  });
  it("keeps covered repair free but accounts for internal costs", async () => {
    const t = (await get("/tickets")).find(
      (t: any) => t.covered && t.status === "open",
    );
    await post(`/tickets/${t.id}/resolution`, {
      resolution: "Replaced fan and tested",
      parts_cost_minor: 120000,
      labour_cost_minor: 50000,
    });
    const updated = (await get("/tickets")).find((x: any) => x.id === t.id);
    expect(updated.customer_charge_minor).toBe(0);
    expect(updated.parts_cost_minor + updated.labour_cost_minor).toBe(170000);
    expect(updated.status).toBe("awaiting_confirmation");
    await post(`/tickets/${t.id}/confirmation`, {
      confirmed_by: "Synthetic Customer",
    });
    expect((await get("/tickets")).find((x: any) => x.id === t.id).status).toBe(
      "closed",
    );
  });
  it("bills expired repairs as exact parts/labour lines", async () => {
    const t = (await get("/tickets")).find((t: any) => !t.covered);
    expect(
      (
        await req("POST", `/tickets/${t.id}/confirmation`, {
          confirmed_by: "QA",
        })
      ).statusCode,
    ).toBe(409);
    await post(`/tickets/${t.id}/resolution`, {
      resolution: "Fan replaced",
      parts_cost_minor: 125050,
      labour_cost_minor: 50000,
    });
    const d = await get(`/projects/${t.project_id}`);
    const invoice = d.invoices.find((i: any) => i.kind === "service");
    expect(invoice.total_minor).toBe(175050);
    expect(
      invoice.lines.reduce(
        (s: number, l: any) => s + l.quantity * l.unit_price_minor,
        0,
      ),
    ).toBe(175050);
  });
  it("reconciles report amounts against invoice, material and labour records", async () => {
    const report = await get("/reports?period=all");
    for (const j of report.jobs) {
      expect(j.outstanding_minor).toBe(j.invoiced_minor - j.collected_minor);
      expect(j.direct_cost_minor).toBe(
        j.material_cost_minor + j.labour_cost_minor + j.service_cost_minor,
      );
      expect(j.contribution_minor).toBe(
        j.stage === "completed" ? j.invoiced_minor - j.direct_cost_minor : null,
      );
    }
    expect(report.completed_contribution_minor).toBe(
      report.jobs.reduce(
        (s: number, j: any) => s + (j.contribution_minor || 0),
        0,
      ),
    );
  });
  it("persists committed data across a new application instance", async () => {
    const p = await enquiry();
    const fresh = await (await import("../../apps/api/src/app.js")).buildApp();
    try {
      const r = await fresh.inject({
        url: `/api/projects/${p.id}`,
        headers: { cookie: accounts.admin.cookie },
      });
      expect(r.statusCode).toBe(200);
      expect(r.json().project.id).toBe(p.id);
    } finally {
      await fresh.close();
    }
  });
});
