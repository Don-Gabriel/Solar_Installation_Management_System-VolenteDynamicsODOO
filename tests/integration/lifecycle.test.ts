import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
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
let repairDay = 40;
async function repairPhoto(
  ticketId: string,
  role = "admin",
  target = "tickets",
  kind = "photo",
) {
  const boundary = "solar-test-" + id();
  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#305060" },
  })
    .png()
    .toBuffer();
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic-test.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: "POST",
    url: `/api/${target}/${ticketId}/evidence`,
    headers: {
      cookie: accounts[role].cookie,
      "x-csrf-token": accounts[role].csrf,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
}
async function prepareRepair(
  ticketId: string,
  options: { replacement?: string; parts?: number; labour?: number } = {},
) {
  const d = await get(`/tickets/${ticketId}`);
  const component =
    d.components.find((c: any) => c.warranty_id === d.ticket.warranty_id) ||
    d.components.find((c: any) => c.asset_status === "delivered");
  const day = new Date(Date.now() + repairDay++ * 86400000);
  while (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
  const start = day.toISOString().slice(0, 10) + "T09:00:00+05:30";
  const visit = await post("/visits", {
    ticket_id: ticketId,
    starts_at: start,
    duration_hours: 2,
    skill: "inverter_repair",
    technician_ids: [accounts.technician.id],
    lead_id: accounts.technician.id,
  });
  await post(`/visits/${visit.id}/action`, {
    action: "start",
    version: visit.version,
  });
  await db.query("UPDATE users SET hourly_rate_minor=$2 WHERE id=$1", [
    accounts.technician.id,
    options.labour ?? 50000,
  ]);
  const current = await get(`/tickets/${ticketId}`);
  await post(`/tickets/${ticketId}/diagnosis`, {
    version: current.ticket.version,
    lines: [
      {
        order_line_id: component.order_line_id,
        ...(component.asset_id ? { asset_id: component.asset_id } : {}),
        quantity: 1,
        finding: "Synthetic diagnosed fault",
        action: options.replacement ? "replace" : "repair",
        replacement_serial: options.replacement || "",
        unit_price_minor: options.parts ?? 120000,
        unit_cost_minor: options.parts ?? 120000,
        labour_minutes: 60,
        labour_price_minor: options.labour ?? 50000,
      },
    ],
  });
  const diagnosed = await get(`/tickets/${ticketId}`);
  await post(`/tickets/${ticketId}/approval`, {
    version: diagnosed.ticket.version,
    confirmed_by: "Synthetic customer approval",
  });
  const photo = await repairPhoto(ticketId);
  expect(photo.statusCode, photo.body).toBe(200);
  return { visit, component };
}
beforeAll(async () => {
  process.env.RATE_LIMIT_MAX = "20000";
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
  it("[SEC-09] protects the staff directory and complete barcode library by role", async () => {
    const staff = (await get("/team")).items;
    expect(staff).toHaveLength(34);
    expect(staff.every((u: any) => !("password_hash" in u))).toBe(true);
    for (const role of [
      "warehouse",
      "sales",
      "surveyor",
      "support",
      "accounts",
      "technician",
    ])
      expect((await req("GET", "/team", undefined, role)).statusCode).toBe(403);
    const devices = (await get("/barcodes", "warehouse")).items;
    expect(devices).toHaveLength(198);
    expect(new Set(devices.map((a: any) => a.serial)).size).toBe(198);
    expect((await get("/barcodes", "accounts")).items).toHaveLength(198);
    for (const role of ["sales", "surveyor", "support", "technician"])
      expect((await req("GET", "/barcodes", undefined, role)).statusCode).toBe(
        403,
      );
  });
  it("keeps the optional serial picker read-only, role-limited and switchable", async () => {
    const previous = process.env.DEMO_TOOLS;
    const order = (
      await db.query(
        "SELECT id FROM orders WHERE status='packing' AND EXISTS (SELECT 1 FROM order_lines l WHERE l.order_id=orders.id AND l.reserved) LIMIT 1",
      )
    ).rows[0];
    const url = `/orders/${order.id}/available-serials`;
    try {
      process.env.DEMO_TOOLS = "false";
      expect((await req("GET", url, undefined, "warehouse")).statusCode).toBe(
        404,
      );
      process.env.DEMO_TOOLS = "true";
      expect((await req("GET", url, undefined, "sales")).statusCode).toBe(403);
      const before = (
        await db.query(
          "SELECT id,serial,status,order_line_id FROM assets ORDER BY id",
        )
      ).rows;
      const choices = (await get(url, "warehouse")).items;
      expect(choices.length).toBeGreaterThan(0);
      expect(
        choices.every((a: any) =>
          before.some(
            (b: any) => b.serial === a.serial && b.status === "available",
          ),
        ),
      ).toBe(true);
      expect(
        (
          await db.query(
            "SELECT id,serial,status,order_line_id FROM assets ORDER BY id",
          )
        ).rows,
      ).toEqual(before);
    } finally {
      if (previous === undefined) delete process.env.DEMO_TOOLS;
      else process.env.DEMO_TOOLS = previous;
    }
  });
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
  it("[SUR-01] blocks direct quote issuance without an approved survey", async () => {
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
  it("[QUO-02 QUO-03 CON-01] acceptance is idempotent and material prices remain snapshots", async () => {
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
  it("[PAY-04 PAY-05 CON-02 CON-08] does not duplicate payments and blocks overpayment or changed retries", async () => {
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
  it("[PAY-02 DLV-01 STK-06] blocks reservation before advance, incomplete scans and unknown serials", async () => {
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
  it("[STK-05 STK-07] rejects a wrong product and duplicate serial scans", async () => {
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
  it("[STK-04] concurrent allocations can never claim the same physical device twice", async () => {
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
  it("[DLV-02 DLV-03 DLV-04 DLV-05] starts warranties on delivery only, and delivery retries preserve dates", async () => {
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
  it("[STK-02] receipt rollback preserves stock when duplicate serials are submitted", async () => {
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
  it("[DIA-10] traces replacement serials and preserves the original warranty dates", async () => {
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
    await prepareRepair(ticket.id, {
      replacement: replacement.serial,
      parts: 0,
      labour: 10000,
    });
    await post(`/tickets/${ticket.id}/resolution`, {
      resolution: "Device replaced and tested",
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
  it("[SCH-06 INS-06] blocks overlapping assignments and completion without saved evidence", async () => {
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
  it("[OPS-07] keeps covered repair free but accounts for internal costs", async () => {
    const t = (await get("/tickets")).find(
      (t: any) => t.covered && t.status === "open",
    );
    await prepareRepair(t.id, { parts: 120000, labour: 50000 });
    await post(`/tickets/${t.id}/resolution`, {
      resolution: "Replaced fan and tested",
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
    await prepareRepair(t.id, { parts: 125050, labour: 50000 });
    await post(`/tickets/${t.id}/resolution`, {
      resolution: "Fan replaced",
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
  it("[OPS-06] reconciles report amounts against invoice, material and labour records", async () => {
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
  it("[OPS-01] persists committed data across a new application instance", async () => {
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

// Operational tests share this suite's disposable database and real HTTP helpers.
// Every bracketed ID refers to the acceptance catalogue, not a source-code assertion.
async function operationFixture(crew?: string[]) {
  const project = await delivered();
  const ticket = await post(
    "/tickets",
    {
      project_id: project.project.id,
      complaint: "Customer reports low output",
      fault_code: "Low generation",
    },
    "support",
  );
  const workers = crew || [accounts.technician.id];
  const when = new Date(Date.now() + (repairDay += 7) * 86400000);
  while (when.getUTCDay() === 0) when.setUTCDate(when.getUTCDate() + 1);
  const start = when.toISOString().slice(0, 10) + "T09:00:00+05:30";
  const body = {
    ticket_id: ticket.id,
    starts_at: start,
    duration_hours: 2,
    skill: "inverter_repair",
    technician_ids: workers,
    lead_id: workers[0],
  };
  const visit = await post("/visits", body, "coordinator");
  return { project, ticket, visit, body };
}
async function startDiagnosis(f: any, changes: any = {}, role = "technician") {
  await post(
    `/visits/${f.visit.id}/action`,
    { action: "start", version: f.visit.version },
    role,
  );
  const d = await get(`/tickets/${f.ticket.id}`);
  const component = d.components.find(
    (c: any) => c.asset_status === "delivered",
  );
  const spare = d.spares.find(
    (s: any) => s.product_id === component.product_id,
  );
  const line = {
    order_line_id: component.order_line_id,
    asset_id: component.asset_id,
    quantity: 1,
    finding: "Tested and confirmed electrical fault",
    action: "replace",
    replacement_serial: spare.serial,
    labour_minutes: 60,
    labour_price_minor: 50000,
    ...changes,
  };
  await post(`/tickets/${f.ticket.id}/diagnosis`, {
    version: d.ticket.version,
    lines: [line],
  });
  return { line, component, spare };
}
async function approveRepair(f: any) {
  const d = await get(`/tickets/${f.ticket.id}`);
  return post(
    `/tickets/${f.ticket.id}/approval`,
    {
      version: d.ticket.version,
      confirmed_by: "Customer agreed by phone; synthetic QA reference",
    },
    "support",
  );
}
describe("Review regressions and real operational requests", () => {
  beforeAll(async () => {
    await login("coordinator");
    await login("second", "vishal@sunpower.local");
    await login("other", "deepa@sunpower.local");
    for (const p of (
      await db.query("SELECT * FROM products WHERE kind<>'service'")
    ).rows)
      await post(
        "/receipts",
        {
          product_id: p.id,
          supplier: "Synthetic test replenishment",
          reference: id(),
          quantity: 100,
          unit_cost_minor: 10000,
          serials:
            p.kind === "serialized"
              ? Array.from({ length: 100 }, (_, i) => "QA-" + p.id + "-" + i)
              : [],
        },
        "warehouse",
      );
  });
  it("[INT-01 SEC-01] support creates audited installation intake without gaining stock or finance authority", async () => {
    const p = await post(
      "/projects",
      {
        name: "Phone caller",
        phone: "9898989898",
        address: "Synthetic site",
        capacity_kw: 3,
        system_type: "on_grid",
        source: "Phone",
        subsidy_interest: false,
      },
      "support",
    );
    expect(
      (await get(`/projects/${p.id}`)).audit.some(
        (a: any) => a.actor_id === accounts.support.id,
      ),
    ).toBe(true);
    expect(
      (await req("POST", `/projects/${p.id}/quotes`, {}, "support")).statusCode,
    ).toBe(403);
    expect((await req("POST", "/receipts", {}, "support")).statusCode).not.toBe(
      200,
    );
  });
  it("[SRV-01 SRV-02 SRV-03 SEC-03] unknown-component complaint, full installed list and different repair worker access", async () => {
    const f = await operationFixture();
    const d = await get(`/tickets/${f.ticket.id}`, "technician");
    expect(d.ticket.warranty_id).toBeNull();
    expect(d.components.length).toBeGreaterThan(2);
    expect(
      (
        await req(
          "GET",
          `/projects/${f.project.project.id}`,
          undefined,
          "technician",
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await req("GET", `/tickets/${f.ticket.id}`, undefined, "other"))
        .statusCode,
    ).toBe(403);
    expect(
      (await get("/tickets", "technician")).find(
        (t: any) => t.id === f.ticket.id,
      ),
    ).not.toHaveProperty("parts_cost_minor");
  });
  it("[SCH-01] fifteen dispatch workers, thirteen occupied and precisely two free in the demonstrated interval", async () => {
    const fixture = (
      await db.query(
        "SELECT value FROM settings WHERE key='demo_operations_v1'",
      )
    ).rows[0].value;
    const d = await get(
      "/schedule/availability?" +
        new URLSearchParams({
          from: fixture.dates[0],
          to: fixture.dates[0],
          skill: "inverter_repair",
          duration_hours: "2",
          crew_size: "1",
        }),
      "coordinator",
    );
    const slot = d.slots.find(
      (s: any) =>
        new Date(s.starts_at).getUTCHours() === 7 &&
        new Date(s.starts_at).getUTCMinutes() === 30,
    );
    expect(slot.candidates.map((c: any) => c.name).sort()).toEqual(
      fixture.free_technicians.sort(),
    );
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM users WHERE role='technician' AND active AND dispatch_enabled",
        )
      ).rows[0].n,
    ).toBe(15);
  });
  it("[SCH-03 SCH-04 SCH-08 DSP-10] skills, leave, office hours and stale suggestions are enforced on booking", async () => {
    const f = await operationFixture();
    await post(
      `/visits/${f.visit.id}/action`,
      { action: "cancel", version: 1, reason: "QA fresh slot" },
      "coordinator",
    );
    await db.query(
      "UPDATE users SET skills=ARRAY['installation','crew_lead'] WHERE id=$1",
      [accounts.technician.id],
    );
    expect(
      (await req("POST", "/visits", f.body, "coordinator")).statusCode,
    ).toBe(409);
    await db.query(
      "UPDATE users SET skills=ARRAY['installation','crew_lead','inverter_repair','survey','battery_repair'] WHERE id=$1",
      [accounts.technician.id],
    );
    expect(
      (
        await req(
          "POST",
          "/visits",
          { ...f.body, starts_at: f.body.starts_at.replace("09:00", "22:00") },
          "coordinator",
        )
      ).statusCode,
    ).toBe(409);
    await post(
      "/staff-leave",
      {
        user_id: accounts.technician.id,
        starts_at: f.body.starts_at,
        ends_at: f.body.starts_at.replace("09:00", "17:00"),
        reason: "Approved leave",
      },
      "coordinator",
    );
    expect(
      (await req("POST", "/visits", f.body, "coordinator")).statusCode,
    ).toBe(409);
  });
  it("[SCH-05 SCH-07 SCH-10] travel buffer and two coordinators racing for one worker", async () => {
    const f = await operationFixture();
    const t = await post("/tickets", {
      project_id: f.project.project.id,
      complaint: "Independent issue",
      fault_code: "Other",
    });
    expect(
      (
        await req(
          "POST",
          "/visits",
          {
            ...f.body,
            ticket_id: t.id,
            starts_at: f.body.starts_at.replace("09:00", "11:00"),
          },
          "coordinator",
        )
      ).statusCode,
    ).toBe(409);
    await post(`/visits/${f.visit.id}/action`, {
      action: "cancel",
      version: 1,
      reason: "Race setup",
    });
    const race = await Promise.all([
      req("POST", "/visits", f.body, "coordinator"),
      req("POST", "/visits", { ...f.body, ticket_id: t.id }, "second"),
    ]);
    expect(race.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM visits v JOIN visit_crew c ON c.visit_id=v.id WHERE c.user_id=$1 AND v.starts_at=$2 AND v.status='scheduled'",
          [accounts.technician.id, f.body.starts_at],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("[DSP-01 SEC-08] twenty concurrent calls survive without appointments or shared identities", async () => {
    const p = await delivered();
    await login("support2", "anita@sunpower.local");
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        req(
          "POST",
          "/tickets",
          {
            project_id: p.project.id,
            complaint: "Independent customer call " + i,
            fault_code: "Other",
          },
          i % 2 ? "support" : "support2",
        ),
      ),
    );
    expect(
      results.every((r) => r.statusCode === 200),
      results.filter((r) => r.statusCode !== 200).map((r) => r.body),
    ).toBe(true);
    expect(new Set(results.map((r) => r.json().id)).size).toBe(20);
    const actors = (
      await db.query(
        "SELECT DISTINCT actor_id FROM audit_events WHERE entity_id=$1 AND action='ticket.opened'",
        [p.project.id],
      )
    ).rows;
    expect(actors.map((a: any) => a.actor_id).sort()).toEqual(
      [accounts.support.id, accounts.support2.id].sort(),
    );
  });
  it("[DSP-05 DSP-09 CON-07] rescheduling releases old time atomically, rejects stale revision and supports retry", async () => {
    const f = await operationFixture();
    const body = {
      ...f.body,
      visit_id: f.visit.id,
      version: 1,
      starts_at: f.body.starts_at.replace("09:00", "13:00"),
      reason: "Customer requested afternoon",
    };
    const key = id();
    const a = await post("/visits", body, "coordinator", key);
    const b = await post("/visits", body, "coordinator", key);
    expect(a.id).toBe(b.id);
    expect(
      (
        await req(
          "POST",
          "/visits",
          { ...body, starts_at: f.body.starts_at.replace("09:00", "15:00") },
          "second",
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (await get(`/tickets/${f.ticket.id}`)).visits.filter(
        (v: any) => v.status === "scheduled",
      ),
    ).toHaveLength(1);
  });
  it("[SUR-08] two-worker survey stores both crew members and blocks both calendars", async () => {
    const f = await operationFixture();
    const tech = (
      await db.query(
        "SELECT id FROM users WHERE role='technician' AND dispatch_enabled AND id<>$1 ORDER BY id LIMIT 1",
        [accounts.technician.id],
      )
    ).rows[0];
    const v = await post(
      "/visits",
      {
        project_id: f.project.project.id,
        starts_at: f.body.starts_at.replace("09:00", "13:00"),
        duration_hours: 2,
        skill: "survey",
        technician_ids: [accounts.technician.id, tech.id],
        lead_id: accounts.technician.id,
      },
      "coordinator",
    );
    expect(
      (await db.query("SELECT * FROM visit_crew WHERE visit_id=$1", [v.id]))
        .rows,
    ).toHaveLength(2);
    expect(
      (
        await req(
          "POST",
          "/visits",
          {
            project_id: f.project.project.id,
            starts_at: f.body.starts_at.replace("09:00", "13:00"),
            duration_hours: 2,
            skill: "survey",
            technician_ids: [tech.id],
            lead_id: tech.id,
          },
          "coordinator",
        )
      ).statusCode,
    ).toBe(409);
  });
  it("[EVD-01] valid diagnosis and approval still cannot complete without this visit photo", async () => {
    const f = await operationFixture();
    await startDiagnosis(f);
    await approveRepair(f);
    const r = await req(
      "POST",
      `/tickets/${f.ticket.id}/resolution`,
      { resolution: "Repaired" },
      "technician",
    );
    expect(r.statusCode).toBe(409);
    expect(r.body).toContain("photo");
    expect((await get(`/tickets/${f.ticket.id}`)).invoices).toHaveLength(0);
  });
  it("[BIL-01 BIL-04 BIL-07 RMA-01 RMA-05 RMA-06 RMA-10 EVD-07] covered serial replacement, visible zero document, return quarantine, retry and phone closure", async () => {
    const f = await operationFixture();
    const { component, spare } = await startDiagnosis(f);
    await approveRepair(f);
    expect((await repairPhoto(f.ticket.id, "technician")).statusCode).toBe(200);
    await post(
      `/tickets/${f.ticket.id}/resolution`,
      { resolution: "Replacement tested onsite" },
      "technician",
    );
    await post(
      `/tickets/${f.ticket.id}/resolution`,
      { resolution: "Replacement tested onsite" },
      "technician",
    );
    let d = await get(`/tickets/${f.ticket.id}`);
    expect(d.invoices).toHaveLength(1);
    const invoice = d.invoices[0];
    expect(invoice.total_minor).toBe(0);
    expect(invoice.lines).toHaveLength(2);
    expect(
      invoice.lines.some(
        (l: any) =>
          l.original_serial === component.serial &&
          l.replacement_serial === spare.serial &&
          l.unit_price_minor === 0 &&
          l.warranty_credit_minor > 0,
      ),
    ).toBe(true);
    expect(d.returns[0].status).toBe("pending_return");
    expect(
      d.components.find((c: any) => c.serial === spare.serial).expires_at,
    ).toBe(component.expires_at);
    const stock = (
      await db.query("SELECT stock_qty FROM products WHERE id=$1", [
        component.product_id,
      ])
    ).rows[0].stock_qty;
    await post(
      `/service-returns/${d.returns[0].id}/receive`,
      { confirmed_by: "Received broken device into quarantine" },
      "warehouse",
    );
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.returns[0].status).toBe("quarantined");
    expect(
      (
        await db.query("SELECT stock_qty FROM products WHERE id=$1", [
          component.product_id,
        ])
      ).rows[0].stock_qty,
    ).toBe(stock);
    await post(
      `/tickets/${f.ticket.id}/confirmation`,
      { confirmed_by: "Customer confirmed by phone" },
      "support",
    );
    expect((await get(`/tickets/${f.ticket.id}`)).ticket.status).toBe("closed");
  });
  it("[BIL-05 BIL-03 PAY-08] customer retail differs from acquisition cost and service part-payments leave initial invoice unchanged", async () => {
    const f = await operationFixture();
    const initial = JSON.stringify(f.project.invoices);
    const { spare } = await startDiagnosis(f, {
      unit_price_minor: 1800000,
      coverage: "chargeable",
      coverage_reason: "Expired policy verified",
      labour_minutes: 0,
      labour_price_minor: 0,
    });
    await db.query("UPDATE assets SET cost_minor=1400000 WHERE serial=$1", [
      spare.serial,
    ]);
    await approveRepair(f);
    await repairPhoto(f.ticket.id);
    await post(`/tickets/${f.ticket.id}/resolution`, {
      resolution: "Paid replacement tested",
    });
    let d = await get(`/tickets/${f.ticket.id}`);
    expect(d.ticket.parts_cost_minor).toBe(1400000);
    expect(d.invoices[0].total_minor).toBe(1800000);
    await post(
      `/invoices/${d.invoices[0].id}/payments`,
      { amount_minor: 100000, method: "bank", reference: id() },
      "accounts",
    );
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.invoices[0].paid_minor).toBe(100000);
    expect(
      JSON.stringify(
        (await get(`/projects/${f.project.project.id}`)).invoices.filter(
          (i: any) => i.kind === "installation",
        ),
      ),
    ).toBe(initial);
  });
  it("[DIA-01 WAR-03 BIL-02 BIL-09] mixed cover totals exactly INR 1700 while covered stock remains a company cost", async () => {
    const connector = (
      await db.query(
        "INSERT INTO products(sku,name,kind,price_minor,stock_qty,stock_value_minor) VALUES($1,'Solar cable connector','quantity',45000,100,2000000) RETURNING id",
        ["MIX1-" + id()],
      )
    ).rows[0];
    const pkg = (
      await db.query(
        "SELECT id FROM packages WHERE capacity_kw=1 AND system_type='on_grid' ORDER BY version DESC LIMIT 1",
      )
    ).rows[0];
    await db.query(
      "INSERT INTO package_lines(package_id,product_id,quantity) VALUES($1,$2,2)",
      [pkg.id, connector.id],
    );
    let f: any;
    try {
      f = await operationFixture();
    } finally {
      await db.query(
        "DELETE FROM package_lines WHERE package_id=$1 AND product_id=$2",
        [pkg.id, connector.id],
      );
    }
    const { line } = await startDiagnosis(f, {
      labour_price_minor: 0,
      unit_price_minor: 1800000,
    });
    let d = await get(`/tickets/${f.ticket.id}`);
    const panel = d.components.find((c: any) => c.product_id === connector.id);
    expect(panel).toBeTruthy();
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [
        {
          ...line,
          labour_coverage: "covered",
          unit_price_minor: 1800000,
          coverage_reason: "Covered inverter repair; no charge for its labour",
        },
        {
          order_line_id: panel.order_line_id,
          quantity: 2,
          finding: "Two damaged solar cable connectors",
          action: "replace",
          labour_minutes: 60,
          labour_price_minor: 60000,
          callout_price_minor: 20000,
          unit_price_minor: 45000,
          coverage: "chargeable",
          labour_coverage: "chargeable",
          coverage_reason:
            "Customer approved uncovered connectors, their labour and callout",
        },
      ],
    });
    const a = await approveRepair(f);
    expect(a.payable_minor).toBe(170000);
    await repairPhoto(f.ticket.id);
    await post(`/tickets/${f.ticket.id}/resolution`, {
      resolution: "Mixed replacement tested",
    });
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.invoices[0].total_minor).toBe(170000);
    expect(d.invoices[0].lines).toHaveLength(5);
    expect(
      d.invoices[0].lines.find((l: any) => l.description.startsWith("Callout"))
        .unit_price_minor,
    ).toBe(20000);
    expect(
      d.invoices[0].lines.find((l: any) => l.quantity === 2).unit_price_minor,
    ).toBe(45000);
    expect(
      d.invoices[0].lines.find((l: any) => l.warranty_credit_minor === 1800000),
    ).toBeTruthy();
    expect(d.ticket.parts_cost_minor).toBeGreaterThan(0);
    expect(
      d.invoices[0].lines.reduce(
        (sum: number, l: any) => sum + l.quantity * l.unit_price_minor,
        0,
      ),
    ).toBe(170000);
  });
  it("[WAR-08 BIL-04] covered parts can have approved charged labour and callout, while full cover credits all three", async () => {
    for (const covered of [false, true]) {
      const f = await operationFixture();
      await startDiagnosis(f, {
        labour_price_minor: 50000,
        callout_price_minor: 20000,
        labour_coverage: covered ? "covered" : "chargeable",
        coverage_reason: covered
          ? "Full company cover includes callout"
          : "Customer agreed parts-only policy, labour and travel charges",
      });
      const approval = await approveRepair(f);
      expect(approval.payable_minor).toBe(covered ? 0 : 70000);
      await repairPhoto(f.ticket.id);
      await post(`/tickets/${f.ticket.id}/resolution`, {
        resolution: "Parts-only versus full-cover rehearsal",
      });
      const d = await get(`/tickets/${f.ticket.id}`);
      expect(d.invoices[0].total_minor).toBe(covered ? 0 : 70000);
      const callout = d.invoices[0].lines.find((l: any) =>
        l.description.startsWith("Callout"),
      );
      expect(callout.unit_price_minor).toBe(covered ? 0 : 20000);
      expect(callout.warranty_credit_minor).toBe(covered ? 20000 : 0);
    }
  });
  it("[DIA-02 DIA-03 CON-03] foreign component, excessive quantity and stale diagnosis are rejected", async () => {
    const f = await operationFixture();
    const { line } = await startDiagnosis(f);
    const d = await get(`/tickets/${f.ticket.id}`);
    const other = await delivered();
    const foreign = other.order.lines.find((l: any) => l.kind === "quantity");
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/diagnosis`, {
          version: d.ticket.version,
          lines: [{ ...line, order_line_id: foreign.id }],
        })
      ).statusCode,
    ).toBe(400);
    const panel = d.components.find((c: any) => c.kind === "quantity");
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/diagnosis`, {
          version: d.ticket.version,
          lines: [
            {
              order_line_id: panel.order_line_id,
              quantity: panel.quantity + 1,
              finding: "Too many",
              action: "repair",
              labour_minutes: 1,
              labour_price_minor: 0,
            },
          ],
        })
      ).statusCode,
    ).toBe(400);
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [line],
    });
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/diagnosis`, {
          version: d.ticket.version,
          lines: [line],
        })
      ).statusCode,
    ).toBe(409);
  });
  it("[DIA-06 BIL-06] editing diagnosis invalidates approval and unapproved work cannot create an invoice", async () => {
    const f = await operationFixture();
    const { line } = await startDiagnosis(f);
    await approveRepair(f);
    const d = await get(`/tickets/${f.ticket.id}`);
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [{ ...line, finding: "Revised finding" }],
    });
    await repairPhoto(f.ticket.id);
    const r = await req("POST", `/tickets/${f.ticket.id}/resolution`, {
      resolution: "Cannot execute unapproved work",
    });
    expect(r.statusCode).toBe(409);
    expect(r.body).toContain("approval");
    expect((await get(`/tickets/${f.ticket.id}`)).invoices).toHaveLength(0);
  });
  it("[WAR-06 WAR-10 SEC-02 SEC-05] coverage review needs authorization and reason; coordinator cannot collect money or fake field completion", async () => {
    const f = await operationFixture();
    const { line } = await startDiagnosis(f);
    let d = await get(`/tickets/${f.ticket.id}`);
    expect(
      (
        await req(
          "POST",
          `/tickets/${f.ticket.id}/diagnosis`,
          {
            version: d.ticket.version,
            lines: [
              {
                ...line,
                coverage: "chargeable",
                coverage_reason: "Unauthorized exclusion",
              },
            ],
          },
          "technician",
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req(
          "POST",
          `/tickets/${f.ticket.id}/diagnosis`,
          {
            version: d.ticket.version,
            lines: [{ ...line, coverage: "chargeable", coverage_reason: "" }],
          },
          "coordinator",
        )
      ).statusCode,
    ).toBe(400);
    await post(
      `/tickets/${f.ticket.id}/diagnosis`,
      {
        version: d.ticket.version,
        lines: [
          {
            ...line,
            coverage: "chargeable",
            coverage_reason: "Evidence reviewed: accidental damage",
          },
        ],
      },
      "coordinator",
    );
    for (const role of ["coordinator", "accounts"])
      expect(
        (
          await req(
            "POST",
            `/tickets/${f.ticket.id}/resolution`,
            { resolution: "Forbidden" },
            role,
          )
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await req(
          "POST",
          `/invoices/${f.project.invoices[0].id}/payments`,
          { amount_minor: 100, method: "cash", reference: id() },
          "coordinator",
        )
      ).statusCode,
    ).toBe(403);
  });
  it("[CON-06] database failure after replacement changes rolls back stock, original serial, invoice and ticket together", async () => {
    const f = await operationFixture();
    const { component, spare } = await startDiagnosis(f);
    await approveRepair(f);
    await repairPhoto(f.ticket.id);
    const before = (
      await db.query(
        "SELECT stock_qty,stock_value_minor FROM products WHERE id=$1",
        [component.product_id],
      )
    ).rows[0];
    await db.query(
      "CREATE FUNCTION qa_reject_invoice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected invoice line failure'; END $$; CREATE TRIGGER qa_invoice_failure BEFORE INSERT ON invoice_lines FOR EACH ROW EXECUTE FUNCTION qa_reject_invoice()",
    );
    try {
      expect(
        (
          await req("POST", `/tickets/${f.ticket.id}/resolution`, {
            resolution: "Rollback test",
          })
        ).statusCode,
      ).toBe(500);
    } finally {
      await db.query(
        "DROP TRIGGER qa_invoice_failure ON invoice_lines; DROP FUNCTION qa_reject_invoice()",
      );
    }
    expect(
      (
        await db.query(
          "SELECT stock_qty,stock_value_minor FROM products WHERE id=$1",
          [component.product_id],
        )
      ).rows[0],
    ).toEqual(before);
    expect(
      (
        await db.query("SELECT status FROM assets WHERE serial=$1", [
          spare.serial,
        ])
      ).rows[0].status,
    ).toBe("available");
    expect(
      (
        await db.query("SELECT status FROM assets WHERE id=$1", [
          component.asset_id,
        ])
      ).rows[0].status,
    ).toBe("delivered");
    expect((await get(`/tickets/${f.ticket.id}`)).invoices).toHaveLength(0);
  });
  it("[SRV-08 SRV-09 EVD-08] no access and waiting-for-parts preserve open work; a customer dispute prevents closure", async () => {
    const f = await operationFixture();
    await post(
      `/visits/${f.visit.id}/action`,
      {
        action: "no_access",
        version: 1,
        reason: "Customer absent; call to arrange new date",
      },
      "technician",
    );
    expect((await get(`/tickets/${f.ticket.id}`)).ticket.status).toBe("open");
    const v = await post("/visits", f.body, "coordinator");
    await post(
      `/visits/${v.id}/action`,
      { action: "start", version: 1 },
      "technician",
    );
    await post(
      `/visits/${v.id}/action`,
      {
        action: "diagnosis_done",
        version: 2,
        reason: "Awaiting matching replacement stock",
      },
      "technician",
    );
    expect((await get(`/tickets/${f.ticket.id}`)).ticket.status).toBe(
      "waiting_parts",
    );
    const g = await operationFixture();
    await startDiagnosis(g);
    await approveRepair(g);
    await repairPhoto(g.ticket.id);
    await post(`/tickets/${g.ticket.id}/resolution`, {
      resolution: "Repaired",
    });
    const d = await get(`/tickets/${g.ticket.id}`);
    await post(
      `/tickets/${g.ticket.id}/note`,
      {
        version: d.ticket.version,
        action: "dispute",
        note: "Customer reports problem still present",
      },
      "support",
    );
    expect(
      (
        await req(
          "POST",
          `/tickets/${g.ticket.id}/confirmation`,
          { confirmed_by: "Cannot close disputed work" },
          "support",
        )
      ).statusCode,
    ).toBe(409);
  });
});

describe("Additional acceptance boundaries", () => {
  it("[INT-07] malformed phone is rejected without creating a partial customer", async () => {
    const before = (await db.query("SELECT count(*)::int n FROM customers"))
      .rows[0].n;
    const r = await req(
      "POST",
      "/projects",
      {
        name: "Bad number",
        phone: "abc",
        address: "QA",
        capacity_kw: 1,
        system_type: "on_grid",
        source: "Phone",
        subsidy_interest: false,
      },
      "support",
    );
    expect(r.statusCode).toBe(400);
    expect(
      (await db.query("SELECT count(*)::int n FROM customers")).rows[0].n,
    ).toBe(before);
  });
  it("[CRM-01 CRM-02] phone search distinguishes customers sharing a phone by name and site", async () => {
    const phone = "9812345678";
    for (const name of ["One household", "Other household"])
      await post(
        "/projects",
        {
          name,
          phone,
          address: name + " site",
          capacity_kw: 1,
          system_type: "on_grid",
          source: "Phone",
          subsidy_interest: false,
        },
        "support",
      );
    const d = await get("/projects?search=" + phone, "support");
    expect(d.items).toHaveLength(2);
    expect(new Set(d.items.map((p: any) => p.customer_name)).size).toBe(2);
    expect(d.items.every((p: any) => !("evidence" in p))).toBe(true);
  });
  it("[SUR-02 SUR-03 SUR-04 SUR-05 SUR-06 SUR-10] survey measurements, grid suitability, revised approval and accepted-order protection", async () => {
    const p = await enquiry();
    const survey = {
      roof_area: 20,
      bill_minor: 10000,
      grid_suitable: true,
      direction: "South",
      tilt: 10,
      cable_distance: 10,
    };
    expect(
      (await req("POST", `/projects/${p.id}/surveys`, { ...survey, tilt: -1 }))
        .statusCode,
    ).toBe(400);
    await post(`/projects/${p.id}/surveys`, { ...survey, roof_area: 1 });
    expect(
      (
        await req("POST", `/projects/${p.id}/survey-approval`, {
          approved: true,
        })
      ).statusCode,
    ).toBe(409);
    await post(`/projects/${p.id}/surveys`, {
      ...survey,
      grid_suitable: false,
    });
    expect(
      (
        await req("POST", `/projects/${p.id}/survey-approval`, {
          approved: true,
        })
      ).statusCode,
    ).toBe(409);
    await post(`/projects/${p.id}/surveys`, survey);
    await post(`/projects/${p.id}/survey-approval`, { approved: true });
    await post(`/projects/${p.id}/quotes`);
    await post(`/projects/${p.id}/surveys`, { ...survey, roof_area: 30 });
    expect((await req("POST", `/projects/${p.id}/quotes`)).statusCode).toBe(
      409,
    );
    await post(`/projects/${p.id}/survey-approval`, { approved: true });
    await post(`/projects/${p.id}/quotes`);
    await post(`/projects/${p.id}/acceptance`);
    expect(
      (await req("POST", `/projects/${p.id}/surveys`, survey)).statusCode,
    ).toBe(409);
  });
  it("[QUO-01 PAY-01] package lines and totals carry through to one installation invoice", async () => {
    const d = await ordered();
    expect(d.invoices).toHaveLength(1);
    expect(d.order.lines.some((l: any) => l.kind === "service")).toBe(true);
    expect(d.order.lines.some((l: any) => l.kind === "serialized")).toBe(true);
    expect(
      d.invoices[0].lines.reduce(
        (n: number, l: any) => n + l.quantity * l.unit_price_minor,
        0,
      ),
    ).toBe(d.quotes[0].total_minor);
    expect(d.order.total_minor).toBe(d.invoices[0].total_minor);
  });
  it("[QUO-04] concurrent customer acceptance produces one order, invoice and job", async () => {
    const p = await surveyed();
    await post(`/projects/${p.id}/quotes`);
    const results = await Promise.all([
      req("POST", `/projects/${p.id}/acceptance`, {}, "admin"),
      req("POST", `/projects/${p.id}/acceptance`, {}, "sales"),
    ]);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(results[0].json().id).toBe(results[1].json().id);
    const d = await get(`/projects/${p.id}`);
    expect(d.invoices).toHaveLength(1);
    expect(
      (
        await db.query("SELECT count(*)::int n FROM jobs WHERE order_id=$1", [
          d.order.id,
        ])
      ).rows[0].n,
    ).toBe(1);
  });
  it("[QUO-10] unavailable package refuses an empty quote", async () => {
    const p = await surveyed();
    await db.query(
      "UPDATE packages SET system_type='qa_unavailable' WHERE capacity_kw=1 AND system_type='on_grid'",
    );
    try {
      expect((await req("POST", `/projects/${p.id}/quotes`)).statusCode).toBe(
        409,
      );
      expect((await get(`/projects/${p.id}`)).quotes).toHaveLength(0);
    } finally {
      await db.query(
        "UPDATE packages SET system_type='on_grid' WHERE capacity_kw=1 AND system_type='qa_unavailable'",
      );
    }
  });
  it("[PAY-03] exact required advance permits reservation", async () => {
    const d = await paid();
    expect(d.order.advance_received).toBe(true);
    expect(
      d.order.lines
        .filter((l: any) => l.kind !== "service")
        .every((l: any) => l.reserved),
    ).toBe(true);
  });
  it("[PAY-06] two cashiers cannot collect the final balance twice", async () => {
    const d = await ordered();
    const invoice = d.invoices[0];
    const results = await Promise.all(
      ["admin", "accounts"].map((role) =>
        req(
          "POST",
          `/invoices/${invoice.id}/payments`,
          {
            amount_minor: invoice.total_minor,
            method: "cash",
            reference: id(),
          },
          role,
        ),
      ),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      (await get(`/projects/${d.project.id}`)).invoices[0].paid_minor,
    ).toBe(invoice.total_minor);
  });
  it("[PAY-10] identical reference text on different invoices remains independently scoped", async () => {
    const a = await ordered(),
      b = await ordered(),
      reference = id();
    for (const d of [a, b])
      await post(`/invoices/${d.invoices[0].id}/payments`, {
        amount_minor: 100,
        method: "cash",
        reference,
      });
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM payments WHERE reference=$1",
          [reference],
        )
      ).rows[0].n,
    ).toBe(2);
  });
  it("[STK-01 STK-09] receipt creates three distinct devices and scan normalizes case and spaces", async () => {
    const p = (await db.query("SELECT * FROM products WHERE sku='INV1'"))
      .rows[0];
    const serials = Array.from({ length: 3 }, () =>
      ("normal-" + id()).toUpperCase(),
    );
    await post(
      "/receipts",
      {
        product_id: p.id,
        quantity: 3,
        unit_cost_minor: 12345,
        supplier: "Synthetic",
        reference: id(),
        serials,
      },
      "warehouse",
    );
    expect(
      (await db.query("SELECT stock_qty FROM products WHERE id=$1", [p.id]))
        .rows[0].stock_qty,
    ).toBe(p.stock_qty + 3);
    const d = await paid();
    await post(`/orders/${d.order.id}/scans`, {
      serial: " " + serials[0].toLowerCase() + " ",
    });
    expect(
      (
        await db.query("SELECT status FROM assets WHERE serial=$1", [
          serials[0],
        ])
      ).rows[0].status,
    ).toBe("allocated");
  });
  it("[STK-03] insufficient package stock leaves no hidden partial reservation", async () => {
    const d = await ordered();
    await post(`/invoices/${d.invoices[0].id}/payments`, {
      amount_minor: d.order.minimum_advance_minor,
      method: "bank",
      reference: id(),
    });
    const l = d.order.lines
      .filter((l: any) => l.kind !== "service")
      .sort((a: any, b: any) => a.product_id.localeCompare(b.product_id))
      .at(-1);
    const before = (
      await db.query(
        "SELECT id,stock_qty,stock_value_minor,reserved_qty FROM products ORDER BY id",
      )
    ).rows;
    await db.query("UPDATE products SET stock_qty=reserved_qty WHERE id=$1", [
      l.product_id,
    ]);
    try {
      expect(
        (await req("POST", `/orders/${d.order.id}/reservations`)).statusCode,
      ).toBe(409);
      expect(
        (await get(`/projects/${d.project.id}`)).order.lines.every(
          (x: any) => !x.reserved,
        ),
      ).toBe(true);
      expect(
        (await db.query("SELECT id,reserved_qty FROM products ORDER BY id"))
          .rows,
      ).toEqual(
        before.map(({ id, reserved_qty }: any) => ({ id, reserved_qty })),
      );
    } finally {
      const original = before.find((x: any) => x.id === l.product_id);
      await db.query("UPDATE products SET stock_qty=$2 WHERE id=$1", [
        l.product_id,
        original.stock_qty,
      ]);
    }
  });
  it("[INS-01 INS-02 INS-03 INS-04 INS-05 INS-07 INS-08 CON-09] installation crews have private access, lead sign-off, individual time and one completion cost", async () => {
    const member = (
      await db.query(
        "SELECT * FROM users WHERE role='technician' AND dispatch_enabled AND id<>$1 ORDER BY id LIMIT 1",
        [accounts.technician.id],
      )
    ).rows[0];
    await login("assistant", member.email);
    const d = await paid();
    const when = new Date(Date.now() + (repairDay += 7) * 86400000);
    while (when.getUTCDay() === 0) when.setUTCDate(when.getUTCDate() + 1);
    const body = {
      technician_id: accounts.technician.id,
      technician_ids: [accounts.technician.id, member.id],
      scheduled_at: when.toISOString().slice(0, 10) + "T09:00:00+05:30",
      duration_hours: 4,
    };
    await post(`/jobs/${d.job.id}/assignment`, body, "coordinator");
    expect(
      (await get(`/projects/${d.project.id}`, "assistant")).job.crew,
    ).toHaveLength(2);
    expect(
      (await req("GET", `/projects/${d.project.id}`, undefined, "other"))
        .statusCode,
    ).toBe(403);
    expect(
      (await req("POST", `/jobs/${d.job.id}/start`, {}, "technician"))
        .statusCode,
    ).toBe(409);
    await scanAll(d);
    await post(`/orders/${d.order.id}/dispatch`);
    await post(`/orders/${d.order.id}/delivery`);
    await post(`/jobs/${d.job.id}/start`, {}, "assistant");
    await repairPhoto(d.job.id, "assistant", "jobs", "photo");
    await repairPhoto(d.job.id, "technician", "jobs", "signature");
    const completion = {
      capacity_kw: 1,
      generation_kw: 0.8,
      labour_minutes: 60,
      crew_minutes: { [accounts.technician.id]: 60, [member.id]: 120 },
      signer_name: "Synthetic homeowner",
      checklist: {
        mounting: true,
        earthing: true,
        wiring: true,
        inverter: true,
        handover: true,
      },
    };
    expect(
      (
        await req(
          "POST",
          `/jobs/${d.job.id}/completion`,
          completion,
          "assistant",
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req(
          "POST",
          `/jobs/${d.job.id}/completion`,
          {
            ...completion,
            checklist: { ...completion.checklist, earthing: false },
          },
          "technician",
        )
      ).statusCode,
    ).toBe(409);
    const results = await Promise.all([
      req("POST", `/jobs/${d.job.id}/completion`, completion, "technician"),
      req("POST", `/jobs/${d.job.id}/completion`, completion, "technician"),
    ]);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    const after = await get(`/projects/${d.project.id}`);
    expect(after.job.labour_minutes).toBe(180);
    expect(after.job.labour_cost_minor).toBe(
      after.job.crew.reduce((s: number, c: any) => s + c.labour_cost_minor, 0),
    );
    expect(after.job.crew.map((c: any) => c.labour_minutes).sort()).toEqual([
      120, 60,
    ]);
  });
  it("[SRV-07] support cancellation releases appointment and records reason", async () => {
    const f = await operationFixture();
    const d = await get(`/tickets/${f.ticket.id}`);
    await post(
      `/tickets/${f.ticket.id}/note`,
      {
        version: d.ticket.version,
        action: "cancel",
        note: "Customer withdrew request before attendance",
      },
      "support",
    );
    const after = await get(`/tickets/${f.ticket.id}`);
    expect(after.ticket.status).toBe("cancelled");
    expect(after.visits[0].status).toBe("cancelled");
    expect(after.events[0].note).toContain("withdrew");
  });
  it("[WAR-01 WAR-02 WAR-04 WAR-05] coverage follows complaint instant, with exclusive expiry, even after policy expires before visit", async () => {
    const f = await operationFixture();
    await post(`/visits/${f.visit.id}/action`, { action: "start", version: 1 });
    let d = await get(`/tickets/${f.ticket.id}`);
    const c = d.components.find((c: any) => c.asset_status === "delivered");
    const base = {
      order_line_id: c.order_line_id,
      asset_id: c.asset_id,
      quantity: 1,
      finding: "Coverage boundary fixture",
      action: "repair",
      labour_minutes: 0,
      labour_price_minor: 0,
    };
    await db.query(
      "UPDATE warranties SET expires_at=$2::timestamptz+interval '1 second' WHERE id=$1",
      [c.warranty_id, d.ticket.opened_at],
    );
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [base],
    });
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.lines[0].covered).toBe(true);
    await db.query("UPDATE warranties SET expires_at=$2 WHERE id=$1", [
      c.warranty_id,
      d.ticket.opened_at,
    ]);
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [base],
    });
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.lines[0].covered).toBe(false);
    await db.query(
      "UPDATE warranties SET starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1",
      [c.warranty_id],
    );
    await db.query(
      "UPDATE tickets SET opened_at=now()-interval '36 hours' WHERE id=$1",
      [f.ticket.id],
    );
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [base],
    });
    expect((await get(`/tickets/${f.ticket.id}`)).lines[0].covered).toBe(true);
  });
  it("[RMA-02 RMA-03] replacement cannot use wrong model or device allocated to another customer", async () => {
    const f = await operationFixture();
    const { line, component } = await startDiagnosis(f);
    const d = await get(`/tickets/${f.ticket.id}`);
    const wrong = (
      await db.query(
        "SELECT serial FROM assets WHERE product_id<>$1 AND status='available' LIMIT 1",
        [component.product_id],
      )
    ).rows[0];
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/diagnosis`, {
          version: d.ticket.version,
          lines: [{ ...line, replacement_serial: wrong.serial }],
        })
      ).statusCode,
    ).toBe(409);
    const other = await paid();
    const spare = (
      await db.query(
        "SELECT serial FROM assets WHERE product_id=$1 AND status='available' LIMIT 1",
        [component.product_id],
      )
    ).rows[0];
    await post(`/orders/${other.order.id}/scans`, spare);
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/diagnosis`, {
          version: d.ticket.version,
          lines: [{ ...line, replacement_serial: spare.serial }],
        })
      ).statusCode,
    ).toBe(409);
  });
  it("[EVD-03 EVD-10] disguised executable rejected and private evidence cannot be opened anonymously", async () => {
    const f = await operationFixture();
    await startDiagnosis(f);
    const boundary = "QA-" + id();
    const invalid = await app.inject({
      method: "POST",
      url: `/api/tickets/${f.ticket.id}/evidence`,
      headers: {
        cookie: accounts.technician.cookie,
        "x-csrf-token": accounts.technician.csrf,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nphoto\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="evil.jpg"\r\nContent-Type: image/jpeg\r\n\r\nMZ fake executable\r\n--${boundary}--\r\n`,
    });
    expect(invalid.statusCode).toBe(415);
    const photo = await repairPhoto(f.ticket.id);
    expect(photo.statusCode).toBe(200);
    expect(
      (await app.inject({ url: "/api/evidence/" + photo.json().id }))
        .statusCode,
    ).toBe(401);
  });
  it("[SEC-04 SEC-07 SEC-10] admin access changes take effect on open sessions and flag assigned work", async () => {
    const f = await operationFixture();
    const old = (
      await db.query("SELECT * FROM users WHERE id=$1", [
        accounts.technician.id,
      ])
    ).rows[0];
    expect(
      (
        await req(
          "POST",
          `/projects/${f.project.project.id}/quotes`,
          {},
          "warehouse",
        )
      ).statusCode,
    ).toBe(403);
    const body = {
      role: old.role,
      active: false,
      dispatch_enabled: old.dispatch_enabled,
      skills: old.skills,
      working_days: old.working_days,
      reason: "Synthetic departure test",
    };
    await post(`/users/${old.id}/access`, body);
    expect(
      (await req("GET", "/tickets", undefined, "technician")).statusCode,
    ).toBe(401);
    expect(
      (await get("/schedule", "coordinator")).visits.find(
        (v: any) => v.id === f.visit.id,
      ).staffing_conflict,
    ).toBe(true);
    await post(`/users/${old.id}/access`, {
      ...body,
      active: true,
      reason: "Restore QA worker",
    });
    await login("technician", old.email);
    const support = (
      await db.query("SELECT * FROM users WHERE id=$1", [accounts.support.id])
    ).rows[0];
    const change = {
      role: "surveyor",
      active: true,
      dispatch_enabled: support.dispatch_enabled,
      skills: support.skills,
      working_days: support.working_days,
      reason: "Explicit permission test",
    };
    await post(`/users/${support.id}/access`, change);
    expect(
      (
        await req(
          "POST",
          "/tickets",
          {
            project_id: f.project.project.id,
            complaint: "Old form",
            fault_code: "Other",
          },
          "support",
        )
      ).statusCode,
    ).toBe(403);
    await post(`/users/${support.id}/access`, {
      ...change,
      role: "support",
      reason: "Restore support",
    });
  });
  it("[CON-10] nonexistent record yields controlled error without an orphan ticket", async () => {
    expect(
      (
        await req("POST", "/tickets", {
          project_id: id(),
          complaint: "Bad target",
          fault_code: "Other",
        })
      ).statusCode,
    ).toBe(400);
    expect((await req("GET", "/tickets/" + id())).statusCode).toBe(404);
  });
});

describe("Final concurrency and revision checks", () => {
  it("[CON-04] competing tickets cannot replace one original device twice", async () => {
    const f = await operationFixture();
    const first = await startDiagnosis(f);
    await approveRepair(f);
    await repairPhoto(f.ticket.id);
    const t = await post("/tickets", {
      project_id: f.project.project.id,
      complaint: "Second fault for same original",
      fault_code: "Other",
    });
    const v = await post(
      "/visits",
      {
        ...f.body,
        ticket_id: t.id,
        technician_ids: [accounts.assistant.id],
        lead_id: accounts.assistant.id,
      },
      "coordinator",
    );
    const second = { ticket: t, visit: v };
    const d = await get(`/tickets/${t.id}`);
    const spare = d.spares.find(
      (s: any) =>
        s.product_id === first.component.product_id &&
        s.serial !== first.spare.serial,
    );
    await startDiagnosis(
      second,
      { replacement_serial: spare.serial },
      "assistant",
    );
    await approveRepair(second);
    await repairPhoto(t.id);
    const results = await Promise.all([
      req("POST", `/tickets/${f.ticket.id}/resolution`, {
        resolution: "First competing repair",
      }),
      req("POST", `/tickets/${t.id}/resolution`, {
        resolution: "Second competing repair",
      }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM service_returns WHERE asset_id=$1",
          [first.component.asset_id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM invoices WHERE ticket_id=ANY($1::uuid[])",
          [[f.ticket.id, t.id]],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("[CON-05] last unreserved device cannot be promised to both sale and replacement", async () => {
    const f = await operationFixture();
    const { component } = await startDiagnosis(f);
    await approveRepair(f);
    await repairPhoto(f.ticket.id);
    const sale = await ordered();
    await post(`/invoices/${sale.invoices[0].id}/payments`, {
      amount_minor: sale.order.minimum_advance_minor,
      method: "bank",
      reference: id(),
    });
    const before = (
      await db.query("SELECT * FROM products WHERE id=$1", [
        component.product_id,
      ])
    ).rows[0];
    await db.query("UPDATE products SET stock_qty=reserved_qty+1 WHERE id=$1", [
      component.product_id,
    ]);
    let consumed = 0;
    try {
      const results = await Promise.all([
        req("POST", `/orders/${sale.order.id}/reservations`),
        req("POST", `/tickets/${f.ticket.id}/resolution`, {
          resolution: "Competing replacement",
        }),
      ]);
      consumed = results[1].statusCode === 200 ? 1 : 0;
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      const p = (
        await db.query(
          "SELECT stock_qty,reserved_qty FROM products WHERE id=$1",
          [component.product_id],
        )
      ).rows[0];
      expect(p.stock_qty).toBeGreaterThanOrEqual(p.reserved_qty);
    } finally {
      await db.query("UPDATE products SET stock_qty=$2 WHERE id=$1", [
        component.product_id,
        before.stock_qty - consumed,
      ]);
    }
  });
  it("[EVD-06 EVD-09 DIA-07] changed diagnosis invalidates earlier evidence and issued work cannot be edited or erased", async () => {
    const f = await operationFixture();
    const { line } = await startDiagnosis(f);
    await approveRepair(f);
    const oldPhoto = await repairPhoto(f.ticket.id);
    await repairPhoto(f.ticket.id, "admin", "tickets", "signature");
    let d = await get(`/tickets/${f.ticket.id}`);
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [{ ...line, finding: "Additional testing changed diagnosis" }],
    });
    await approveRepair(f);
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/resolution`, {
          resolution: "Old photo must not prove changed work",
        })
      ).statusCode,
    ).toBe(409);
    await repairPhoto(f.ticket.id);
    await post(`/tickets/${f.ticket.id}/resolution`, {
      resolution: "Latest repair tested with new evidence",
    });
    d = await get(`/tickets/${f.ticket.id}`);
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/diagnosis`, {
          version: d.ticket.version,
          lines: [line],
        })
      ).statusCode,
    ).toBe(409);
    expect(d.evidence.some((e: any) => e.id === oldPhoto.json().id)).toBe(true);
    expect((await repairPhoto(f.ticket.id)).statusCode).toBe(409);
    const deletion = await app.inject({
      method: "DELETE",
      url: "/api/evidence/" + oldPhoto.json().id,
      headers: {
        cookie: accounts.technician.cookie,
        "x-csrf-token": accounts.technician.csrf,
      },
    });
    expect(deletion.statusCode).toBe(404);
    expect(
      (await req("GET", "/evidence/" + oldPhoto.json().id)).statusCode,
    ).toBe(200);
  });
  it("[SUR-07 SUR-09 DSP-04] survey no-access remains explicit and leave-triggered crew reassignment preserves history", async () => {
    const f = await operationFixture();
    const v = await post(
      "/visits",
      {
        project_id: f.project.project.id,
        starts_at: f.body.starts_at.replace("09:00", "13:00"),
        duration_hours: 2,
        skill: "survey",
        technician_ids: [accounts.technician.id],
        lead_id: accounts.technician.id,
      },
      "coordinator",
    );
    await post(
      "/visits",
      {
        project_id: f.project.project.id,
        visit_id: v.id,
        version: 1,
        starts_at: f.body.starts_at.replace("09:00", "14:00"),
        duration_hours: 2,
        skill: "survey",
        technician_ids: [accounts.technician.id],
        lead_id: accounts.technician.id,
        reason: "Rain prevented roof access",
      },
      "coordinator",
    );
    await post(
      `/visits/${v.id}/action`,
      {
        action: "no_access",
        version: 2,
        reason: "Customer absent, coordinator to rearrange",
      },
      "technician",
    );
    await post(
      "/staff-leave",
      {
        user_id: accounts.technician.id,
        starts_at: f.body.starts_at,
        ends_at: f.body.starts_at.replace("09:00", "17:00"),
        reason: "Sick leave",
      },
      "coordinator",
    );
    await post(
      "/visits",
      {
        ...f.body,
        visit_id: f.visit.id,
        version: 1,
        technician_ids: [accounts.assistant.id],
        lead_id: accounts.assistant.id,
        reason: "Reassigned after sick leave; support to contact customer",
      },
      "coordinator",
    );
    const d = await get(`/tickets/${f.ticket.id}`);
    expect(d.visits[0].crew[0].id).toBe(accounts.assistant.id);
    const audit = (await get(`/projects/${f.project.project.id}`)).audit;
    expect(
      audit.filter((a: any) => a.action === "visit.rescheduled"),
    ).toHaveLength(2);
    expect(
      (await get("/schedule")).visits.find((a: any) => a.id === v.id).status,
    ).toBe("no_access");
  });
  it("[OPS-09] repair review audit retains before and after decisions with actor and time", async () => {
    const f = await operationFixture();
    const { line } = await startDiagnosis(f);
    const d = await get(`/tickets/${f.ticket.id}`);
    await post(
      `/tickets/${f.ticket.id}/diagnosis`,
      {
        version: d.ticket.version,
        lines: [
          {
            ...line,
            coverage: "chargeable",
            coverage_reason: "Reviewed accidental damage",
          },
        ],
      },
      "coordinator",
    );
    const events = (
      await get(`/projects/${f.project.project.id}`)
    ).audit.filter((a: any) => a.action === "repair.diagnosed");
    expect(events).toHaveLength(2);
    const review = events.find(
      (a: any) => a.actor_id === accounts.coordinator.id,
    );
    expect(review.created_at).toBeTruthy();
    expect(review.detail.before[0].covered).toBe(true);
    expect(review.detail.after[0].covered).toBe(false);
    expect(review.detail.after[0].reason).toContain(
      "Reviewed accidental damage",
    );
  });
});

describe("Capacity, payroll and workload verification", () => {
  it("[SCH-02 SCH-09] full working-day capacity returns explicit alternatives and Sunday is excluded", async () => {
    const f = await operationFixture();
    const day = f.body.starts_at.slice(0, 10);
    await db.query(
      "INSERT INTO staff_leave(user_id,starts_at,ends_at,reason,created_by) SELECT id,$1,$2,'Synthetic full-capacity fixture',$3 FROM users WHERE role='technician' AND dispatch_enabled",
      [day + "T00:00:00+05:30", day + "T23:59:59+05:30", accounts.admin.id],
    );
    const d = await get(
      "/schedule/availability?" +
        new URLSearchParams({
          from: day,
          to: day,
          skill: "inverter_repair",
          duration_hours: "2",
          crew_size: "1",
        }),
      "coordinator",
    );
    expect(d.slots).toHaveLength(0);
    expect(d.message).toContain("No suitable crew");
    expect(d.alternative_slots.length).toBeGreaterThan(0);
    expect(
      d.alternative_slots.every(
        (s: any) =>
          new Date(
            new Date(s.starts_at).getTime() + 330 * 60000,
          ).getUTCDay() !== 0,
      ),
    ).toBe(true);
  });
  it("[INS-08] individual crew payout does not pay the other worker or duplicate the first payment", async () => {
    const job = (
      await db.query(
        "SELECT j.id FROM jobs j JOIN job_crew c ON c.job_id=j.id WHERE j.status='completed' GROUP BY j.id HAVING count(*)=2 LIMIT 1",
      )
    ).rows[0];
    expect(job).toBeTruthy();
    const crew = (
      await db.query(
        "SELECT * FROM job_crew WHERE job_id=$1 ORDER BY user_id",
        [job.id],
      )
    ).rows;
    const body = {
      technician_id: crew[0].user_id,
      confirmed_by: "Synthetic payment ref",
    };
    await post(`/jobs/${job.id}/crew-pay`, body, "accounts");
    await post(`/jobs/${job.id}/crew-pay`, body, "accounts");
    let rows = (await get("/reports?period=all")).payroll.filter(
      (p: any) => p.id === job.id,
    );
    expect(rows).toHaveLength(2);
    expect(rows.filter((p: any) => p.paid_at)).toHaveLength(1);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM crew_payments WHERE job_id=$1",
          [job.id],
        )
      ).rows[0].n,
    ).toBe(1);
    await post(
      `/jobs/${job.id}/crew-pay`,
      { technician_id: crew[1].user_id, confirmed_by: "Second worker payment" },
      "accounts",
    );
    expect(
      (
        await db.query(
          "SELECT amount_minor FROM technician_payments WHERE job_id=$1",
          [job.id],
        )
      ).rows[0].amount_minor,
    ).toBe(crew.reduce((sum: number, c: any) => sum + c.labour_cost_minor, 0));
  });
  it("[OPS-05] work queue distinguishes new, scheduled, active, blocked and awaiting-confirmation work", async () => {
    const queue = (await get("/dashboard", "coordinator")).service_queue;
    const actual = (
      await db.query(
        "SELECT status,count(*)::int n FROM tickets WHERE status NOT IN ('closed','cancelled') GROUP BY status",
      )
    ).rows;
    expect(
      queue
        .map((q: any) => ({ status: q.status, n: q.count }))
        .sort((a: any, b: any) => a.status.localeCompare(b.status)),
    ).toEqual(
      actual.sort((a: any, b: any) => a.status.localeCompare(b.status)),
    );
    expect(queue.some((q: any) => q.status === "waiting_parts")).toBe(true);
    expect(queue.some((q: any) => q.status === "scheduled")).toBe(true);
    expect(queue.every((q: any) => Number.isInteger(q.overdue))).toBe(true);
  });
  it("[OPS-08] LOAD1 preserves all 1000 searchable projects and 200 requests with measured local response time", async () => {
    const prefix = "LOAD1-" + id().slice(0, 8);
    await db.query(
      "WITH c AS (INSERT INTO customers(name,phone) SELECT $1||'-'||g,'9800000000' FROM generate_series(1,1000) g RETURNING id,name),s AS (INSERT INTO sites(customer_id,address) SELECT id,'Synthetic load site '||name FROM c RETURNING id) INSERT INTO projects(site_id,capacity_kw,system_type,source) SELECT id,1,'on_grid','LOAD1' FROM s",
      [prefix],
    );
    const f = await operationFixture();
    await db.query(
      "INSERT INTO tickets(project_id,complaint,fault_code,coverage_reason) SELECT $1,$2||'-request-'||g,'LOAD1','Pending diagnosis' FROM generate_series(1,200) g",
      [f.project.project.id, prefix],
    );
    const ids = new Set<string>(),
      times = [];
    for (let page = 1; page <= 10; page++) {
      const start = performance.now();
      const result = await get(
        "/projects?search=" + prefix + "&page=" + page + "&limit=100",
        "support",
      );
      times.push(performance.now() - start);
      expect(result.total).toBe(1000);
      for (const p of result.items) ids.add(p.id);
    }
    expect(ids.size).toBe(1000);
    const started = performance.now();
    const tickets = await get("/tickets", "support");
    const ticketMs = performance.now() - started;
    expect(
      tickets.filter((t: any) => t.complaint.startsWith(prefix)),
    ).toHaveLength(200);
    expect(Math.max(...times, ticketMs)).toBeLessThan(2000);
    const day = f.body.starts_at.slice(0, 10);
    const concurrent = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const start = performance.now();
        const result = await get(
          "/projects?search=" + prefix + "&page=1&limit=100",
          "support",
        );
        expect(result.total).toBe(1000);
        const searchMs = performance.now() - start;
        const slotStart = performance.now();
        const slots = await get(
          "/schedule/availability?" +
            new URLSearchParams({
              from: day,
              to: day,
              skill: "inverter_repair",
              duration_hours: "2",
              crew_size: "1",
            }),
          "coordinator",
        );
        expect(Array.isArray(slots.slots)).toBe(true);
        return {
          search_ms: searchMs,
          availability_ms: performance.now() - slotStart,
        };
      }),
    );
    expect(Math.max(...concurrent.map((r) => r.search_ms))).toBeLessThan(2000);
    expect(Math.max(...concurrent.map((r) => r.availability_ms))).toBeLessThan(
      3000,
    );
    await mkdir("output/scenarios", { recursive: true });
    await writeFile(
      "output/scenarios/load1.json",
      JSON.stringify(
        {
          status: "PASS",
          projects: 1000,
          requests: 200,
          project_page_ms: times,
          ticket_list_ms: ticketMs,
          concurrent_users: 10,
          concurrent_timings: concurrent,
          target_ms: 2000,
          environment:
            "Local PostgreSQL and Fastify injection; excludes internet latency",
        },
        null,
        2,
      ),
    );
  });
  it("[OPS-10] rerunning demo setup preserves existing work, collections and evidence", async () => {
    const count = async () => {
      const result: any = {};
      for (const table of [
        "projects",
        "tickets",
        "payments",
        "evidence",
        "users",
        "visits",
      ])
        result[table] = (
          await db.query(`SELECT count(*)::int n FROM ${table}`)
        ).rows[0].n;
      return result;
    };
    const before = await count();
    execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "db/seeds/demo.ts"],
      { env: process.env, stdio: "pipe" },
    );
    expect(await count()).toEqual(before);
  });
});

describe("Customer follow-up and workflow compatibility", () => {
  it("[SRV-05 SEC-06] coordinator has explicit call intake powers and support can append a repeated call without duplicating work", async () => {
    const p = await post(
      "/projects",
      {
        name: "Coordinator call",
        phone: "9822222222",
        address: "Synthetic call site",
        capacity_kw: 1,
        system_type: "on_grid",
        source: "Phone",
        subsidy_interest: false,
      },
      "coordinator",
    );
    expect(
      (await get(`/projects/${p.id}`)).audit.some(
        (a: any) => a.actor_id === accounts.coordinator.id,
      ),
    ).toBe(true);
    expect(
      (await req("POST", `/projects/${p.id}/quotes`, {}, "coordinator"))
        .statusCode,
    ).toBe(403);
    const f = await operationFixture();
    let d = await get(`/tickets/${f.ticket.id}`);
    await post(
      `/tickets/${f.ticket.id}/note`,
      {
        version: d.ticket.version,
        action: "note",
        note: "Customer called again asking for visit confirmation",
      },
      "support",
    );
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.events).toHaveLength(1);
    expect(
      (await get("/tickets")).filter(
        (t: any) => t.project_id === f.project.project.id,
      ),
    ).toHaveLength(1);
  });
  it("[DIA-08] declined diagnosis stays disputed with no invoice or unapproved replacement", async () => {
    const f = await operationFixture();
    await startDiagnosis(f);
    let d = await get(`/tickets/${f.ticket.id}`);
    await post(
      `/tickets/${f.ticket.id}/note`,
      {
        version: d.ticket.version,
        action: "dispute",
        note: "Customer declined proposed chargeable work",
      },
      "support",
    );
    await repairPhoto(f.ticket.id);
    expect(
      (
        await req("POST", `/tickets/${f.ticket.id}/resolution`, {
          resolution: "Must not execute disputed work",
        })
      ).statusCode,
    ).toBe(409);
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.ticket.status).toBe("disputed");
    expect(d.invoices).toHaveLength(0);
    expect(d.events[0].note).toContain("declined");
  });
  it("[SRV-10 RMA-08] failed replacement follow-up retains both identities, original bill and evidence", async () => {
    const f = await operationFixture();
    const { component, spare } = await startDiagnosis(f);
    await approveRepair(f);
    await repairPhoto(f.ticket.id);
    await post(`/tickets/${f.ticket.id}/resolution`, {
      resolution: "Initial replacement completed",
    });
    await post(
      `/tickets/${f.ticket.id}/confirmation`,
      { confirmed_by: "Customer confirmed" },
      "support",
    );
    const before = await get(`/tickets/${f.ticket.id}`);
    const follow = await post(
      "/tickets",
      {
        parent_ticket_id: f.ticket.id,
        complaint: "Replacement failed again",
        fault_code: "Replacement failed",
      },
      "support",
    );
    expect(follow.parent_ticket_id).toBe(f.ticket.id);
    const next = await get(`/tickets/${follow.id}`);
    expect(
      next.components.some(
        (c: any) =>
          c.serial === component.serial && c.asset_status === "replaced",
      ),
    ).toBe(true);
    expect(
      next.components.some(
        (c: any) => c.serial === spare.serial && c.asset_status === "delivered",
      ),
    ).toBe(true);
    expect(next.history.some((h: any) => h.id === f.ticket.id)).toBe(true);
    const after = await get(`/tickets/${f.ticket.id}`);
    expect(after.invoices).toEqual(before.invoices);
    expect(after.evidence).toEqual(before.evidence);
  });
  it("[UXP-10] older repair payload cannot silently supply a charge or replacement outside approved diagnosis", async () => {
    const f = await operationFixture();
    const r = await req("POST", `/tickets/${f.ticket.id}/resolution`, {
      resolution: "Old client",
      parts_cost_minor: 123,
      labour_cost_minor: 456,
    });
    expect(r.statusCode).toBe(400);
    expect((await get(`/tickets/${f.ticket.id}`)).invoices).toHaveLength(0);
  });
  it("[DLV-10] warranty instants are invariant when database session timezones differ", async () => {
    const d = await delivered();
    const client = await db.connect();
    try {
      await client.query("SET TIME ZONE 'Asia/Kolkata'");
      const a = (
        await client.query(
          "SELECT starts_at,expires_at FROM warranties WHERE id=$1",
          [d.warranties[0].id],
        )
      ).rows[0];
      await client.query("SET TIME ZONE 'America/New_York'");
      const b = (
        await client.query(
          "SELECT starts_at,expires_at FROM warranties WHERE id=$1",
          [d.warranties[0].id],
        )
      ).rows[0];
      expect(a.starts_at.getTime()).toBe(b.starts_at.getTime());
      expect(a.expires_at.getTime()).toBe(b.expires_at.getTime());
    } finally {
      await client.query("SET TIME ZONE 'UTC'");
      client.release();
    }
  });
});

describe("Final billing and intake guards", () => {
  it("[INT-10] explicit phone-only setting blocks anonymous creation while staff intake stays usable", async () => {
    const previous = process.env.PUBLIC_INTAKE_ENABLED;
    process.env.PUBLIC_INTAKE_ENABLED = "false";
    const body = {
      name: "Phone-only caller",
      phone: "9888888888",
      address: "Synthetic site",
      capacity_kw: 1,
      system_type: "on_grid",
      source: "Phone",
      subsidy_interest: false,
    };
    try {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/enquiries/public",
            payload: body,
          })
        ).statusCode,
      ).toBe(403);
      await post("/projects", body, "support");
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_INTAKE_ENABLED;
      else process.env.PUBLIC_INTAKE_ENABLED = previous;
    }
  });
  it("[WAR-07] missing promised policy requires a reviewed decision, never silent billing", async () => {
    const f = await operationFixture();
    await post(`/visits/${f.visit.id}/action`, { action: "start", version: 1 });
    let d = await get(`/tickets/${f.ticket.id}`);
    const c = d.components.find((c: any) => c.asset_status === "delivered");
    await db.query("DELETE FROM warranties WHERE id=$1", [c.warranty_id]);
    const line = {
      order_line_id: c.order_line_id,
      asset_id: c.asset_id,
      quantity: 1,
      finding: "Imported policy dates missing",
      action: "repair",
      labour_minutes: 60,
      labour_price_minor: 50000,
    };
    const r = await req(
      "POST",
      `/tickets/${f.ticket.id}/diagnosis`,
      { version: d.ticket.version, lines: [line] },
      "technician",
    );
    expect(r.statusCode).toBe(409);
    expect(r.body).toContain("reviewer");
    expect((await get(`/tickets/${f.ticket.id}`)).invoices).toHaveLength(0);
    await post(
      `/tickets/${f.ticket.id}/diagnosis`,
      {
        version: d.ticket.version,
        lines: [
          {
            ...line,
            coverage: "covered",
            coverage_reason:
              "Company accepted goodwill pending policy recovery",
          },
        ],
      },
      "coordinator",
    );
    expect((await get(`/tickets/${f.ticket.id}`)).lines[0].covered).toBe(true);
  });
  it("[INS-10] material capacity discrepancy blocks handover for review", async () => {
    const d = await delivered();
    const when = new Date(Date.now() + (repairDay += 7) * 86400000);
    while (when.getUTCDay() === 0) when.setUTCDate(when.getUTCDate() + 1);
    await post(`/jobs/${d.job.id}/assignment`, {
      technician_id: accounts.technician.id,
      scheduled_at: when.toISOString().slice(0, 10) + "T09:00:00+05:30",
      duration_hours: 2,
    });
    await post(`/jobs/${d.job.id}/start`);
    const r = await req(
      "POST",
      `/jobs/${d.job.id}/completion`,
      {
        capacity_kw: 0.5,
        generation_kw: 0.3,
        labour_minutes: 60,
        signer_name: "Synthetic signer",
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
    expect(r.body).toContain("capacity differs");
    expect((await get(`/projects/${d.project.id}`)).job.status).toBe(
      "in_progress",
    );
  });
});
