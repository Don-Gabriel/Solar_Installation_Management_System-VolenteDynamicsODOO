import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
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
  component: { order_line_id?: string; asset_id?: string } = {},
) {
  const boundary = "solar-test-" + id();
  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#305060" },
  })
    .png()
    .toBuffer();
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n${Object.entries(
        component,
      )
        .map(
          ([k, v]) =>
            `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
        )
        .join(
          "",
        )}--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic-test.png"\r\nContent-Type: image/png\r\n\r\n`,
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
  url.searchParams.set("application_name", schema);
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
describe("Financial corrections and settlement", () => {
  it("[QUO-06 QUO-07] stale and expired quotations require a fresh reviewed version", async () => {
    const p = await surveyed();
    const old = await post(`/projects/${p.id}/quotes`);
    const latest = await post(`/projects/${p.id}/quotes`);
    expect(
      (await req("POST", `/projects/${p.id}/acceptance`, { quote_id: old.id }))
        .statusCode,
    ).toBe(409);
    await db.query(
      "UPDATE quotes SET expires_at=now()-interval '1 second' WHERE id=$1",
      [latest.id],
    );
    expect(
      (
        await req("POST", `/projects/${p.id}/acceptance`, {
          quote_id: latest.id,
        })
      ).statusCode,
    ).toBe(409);
    const renewed = await post(`/projects/${p.id}/quotes`);
    const order = await post(`/projects/${p.id}/acceptance`, {
      quote_id: renewed.id,
    });
    expect(order.quote_id).toBe(renewed.id);
  });
  it("[PAY-07] pending receipts do not release stock and only finance can verify settlement", async () => {
    const d = await ordered(),
      invoice = d.invoices[0];
    const p = await post(
      `/invoices/${invoice.id}/payments`,
      {
        amount_minor: d.order.minimum_advance_minor,
        method: "upi",
        reference: id(),
        status: "pending",
      },
      "sales",
    );
    expect(
      (await get(`/projects/${d.project.id}`)).order.advance_received,
    ).toBe(false);
    expect(
      (await req("POST", `/orders/${d.order.id}/reservations`, {}, "warehouse"))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await req(
          "POST",
          `/payments/${p.id}/verification`,
          { approved: true, note: "Bank statement matched" },
          "sales",
        )
      ).statusCode,
    ).toBe(403);
    await post(
      `/payments/${p.id}/verification`,
      { approved: true, note: "Verified against bank statement TX-100" },
      "accounts",
    );
    expect(
      (await get(`/projects/${d.project.id}`)).order.advance_received,
    ).toBe(true);
    expect(
      (
        await req(
          "POST",
          `/payments/${p.id}/verification`,
          { approved: true, note: "Repeated verification" },
          "accounts",
        )
      ).statusCode,
    ).toBe(409);
  });
  it("[PAY-09] reversing an incorrect receipt preserves history and reopens the balance once", async () => {
    const d = await ordered(),
      invoice = d.invoices[0];
    const p = await post(`/invoices/${invoice.id}/payments`, {
      amount_minor: 10000,
      method: "cash",
      reference: id(),
    });
    const results = await Promise.all([
      req(
        "POST",
        `/payments/${p.id}/reversal`,
        { reason: "Duplicate cash entry" },
        "accounts",
      ),
      req(
        "POST",
        `/payments/${p.id}/reversal`,
        { reason: "Duplicate cash entry" },
        "accounts",
      ),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const ledger = await get(`/invoices/${invoice.id}/ledger`, "accounts");
    expect(ledger.invoice.paid_minor).toBe(0);
    expect(ledger.payments).toHaveLength(1);
    expect(ledger.payments[0].reversal_reason).toBe("Duplicate cash entry");
  });
  it("[BIL-08 DIA-07] reviewed credits and replacement invoices preserve original charges and bound refunds", async () => {
    const d = await delivered();
    const t = await post("/tickets", {
      project_id: d.project.id,
      complaint: "Billing correction fixture",
      fault_code: "inverter",
    });
    await prepareRepair(t.id, { parts: 10000, labour: 5000 });
    const ready = await get(`/tickets/${t.id}`);
    await post(`/tickets/${t.id}/resolution`, {
      version: ready.ticket.version,
      resolution: "Tested repair completed",
    });
    const detail = await get(`/tickets/${t.id}`),
      invoice = detail.invoices[0];
    expect(invoice.total_minor).toBeGreaterThan(0);
    await post(
      `/invoices/${invoice.id}/payments`,
      { amount_minor: invoice.total_minor, method: "bank", reference: id() },
      "accounts",
    );
    const c = await post(
      `/invoices/${invoice.id}/corrections`,
      {
        credit_minor: invoice.total_minor,
        reason: "Reviewed diagnosis billing correction",
        replacement_lines: [
          {
            description: "Corrected approved labour charge",
            quantity: 1,
            unit_price_minor: 1000,
          },
        ],
      },
      "accounts",
    );
    expect(
      (
        await req(
          "POST",
          `/invoice-corrections/${c.id}/review`,
          { approved: true, note: "Self approval" },
          "accounts",
        )
      ).statusCode,
    ).toBe(403);
    await post(`/invoice-corrections/${c.id}/review`, {
      approved: true,
      note: "Checked original diagnosis and customer agreement",
    });
    const ledger = await get(`/invoices/${invoice.id}/ledger`);
    expect(ledger.invoice.total_minor).toBe(invoice.total_minor);
    expect(ledger.invoice.net_total_minor).toBe(0);
    expect(ledger.credits).toHaveLength(1);
    expect(ledger.replacements[0].total_minor).toBe(1000);
    expect((await get(`/tickets/${t.id}`)).diagnosis).toEqual(detail.diagnosis);
    const refunds = await Promise.all([
      req(
        "POST",
        `/invoices/${invoice.id}/refunds`,
        {
          amount_minor: invoice.total_minor,
          reference: id(),
          reason: "Refund original receipt",
        },
        "accounts",
      ),
      req(
        "POST",
        `/invoices/${invoice.id}/refunds`,
        {
          amount_minor: invoice.total_minor,
          reference: id(),
          reason: "Concurrent refund attempt",
        },
        "accounts",
      ),
    ]);
    expect(refunds.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      (await get(`/invoices/${invoice.id}/ledger`)).invoice.paid_minor,
    ).toBe(0);
    expect(
      (
        await req(
          "GET",
          `/invoices/${invoice.id}/ledger`,
          undefined,
          "technician",
        )
      ).statusCode,
    ).toBe(403);
  });
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
    const t = (await get("/tickets")).find(
      (t: any) => !t.covered && t.status === "open",
    );
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
  if (changes.coverage === "chargeable")
    expect((await repairPhoto(f.ticket.id)).statusCode).toBe(200);
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
                coverage_reason: "Evidence reviewed: accidental damage",
              },
            ],
          },
          "coordinator",
        )
      ).statusCode,
    ).toBe(409);
    expect((await repairPhoto(f.ticket.id)).statusCode).toBe(200);
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
    expect((await repairPhoto(f.ticket.id)).statusCode).toBe(200);
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

describe("Operational exceptions and follow-through", () => {
  it("[SCH-02 SCH-09] full holiday window creates one persisted capacity task and returns working-day alternatives", async () => {
    const f = await operationFixture(),
      day = f.body.starts_at.slice(0, 10);
    await post(
      "/holidays",
      { day, reason: "Synthetic company closure" },
      "coordinator",
    );
    const b = {
      from: day,
      to: day,
      skill: "inverter_repair",
      duration_hours: 2,
      crew_size: 1,
      ticket_id: f.ticket.id,
    };
    const r = await post("/schedule/search", b, "coordinator");
    expect(r.slots).toHaveLength(0);
    expect(r.alternative_slots.length).toBeGreaterThan(0);
    expect(r.escalation.kind).toBe("capacity");
    const again = await post("/schedule/search", b, "coordinator");
    expect(again.escalation.id).toBe(r.escalation.id);
    expect(
      (await get("/operational-tasks", "coordinator")).items.filter(
        (t: any) => t.ticket_id === f.ticket.id && t.kind === "capacity",
      ),
    ).toHaveLength(1);
    const attempted = await req(
      "POST",
      "/visits",
      {
        ...f.body,
        ticket_id: (
          await post("/tickets", {
            project_id: f.project.project.id,
            complaint: "Holiday attempt",
            fault_code: "Other",
          })
        ).id,
      },
      "coordinator",
    );
    expect(attempted.statusCode).toBe(409);
  });
  it("[SUR-07] surveyor no-access creates a real reschedule and customer-contact task without completing the visit", async () => {
    await login("surveyor");
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
      "/visits/" + v.id + "/action",
      {
        action: "no_access",
        version: v.version,
        reason: "Customer gate locked; call before return",
      },
      "surveyor",
    );
    const tasks = (await get("/operational-tasks", "support")).items.filter(
      (t: any) => t.visit_id === v.id,
    );
    expect(tasks.map((t: any) => t.kind).sort()).toEqual([
      "customer_contact",
      "reschedule",
    ]);
    expect(
      (await db.query("SELECT status FROM visits WHERE id=$1", [v.id])).rows[0]
        .status,
    ).toBe("no_access");
    expect(
      (
        await req(
          "POST",
          "/visits/" + f.visit.id + "/action",
          {
            action: "no_access",
            version: f.visit.version,
            reason: "Unauthorized repair action",
          },
          "surveyor",
        )
      ).statusCode,
    ).toBe(403);
  });
  it("[DSP-04] sick-worker reassignment retains a tracked customer-contact task with an audited outcome", async () => {
    const f = await operationFixture();
    await post(
      "/staff-leave",
      {
        user_id: accounts.technician.id,
        starts_at: f.body.starts_at,
        ends_at: f.body.starts_at.replace("09:00", "17:00"),
        reason: "Worker reported sickness",
      },
      "coordinator",
    );
    const alt = (
      await db.query(
        "SELECT id FROM users WHERE role='technician' AND dispatch_enabled AND id<>$1 ORDER BY name LIMIT 1",
        [accounts.technician.id],
      )
    ).rows[0];
    await post(
      "/visits",
      {
        ...f.body,
        visit_id: f.visit.id,
        version: f.visit.version,
        technician_ids: [alt.id],
        lead_id: alt.id,
        reason: "Reassigned after sickness",
      },
      "coordinator",
    );
    const task = (await get("/operational-tasks", "support")).items.find(
      (t: any) => t.visit_id === f.visit.id && t.kind === "customer_contact",
    );
    expect(task).toBeTruthy();
    await post(
      "/operational-tasks/" + task.id + "/completion",
      {
        version: task.version,
        outcome: "Customer called and accepted replacement worker",
      },
      "support",
    );
    expect(
      (
        await db.query(
          "SELECT status,outcome,completed_by FROM operational_tasks WHERE id=$1",
          [task.id],
        )
      ).rows[0],
    ).toMatchObject({ status: "done", completed_by: accounts.support.id });
  });
  it("[DSP-07 DSP-08] overdue acknowledgement is actionable, acknowledgement clears it, and decline returns work to dispatch", async () => {
    const f = await operationFixture();
    await db.query(
      "UPDATE visits SET acknowledgement_due_at=now()-interval '1 minute' WHERE id=$1",
      [f.visit.id],
    );
    expect(
      (await get("/operational-tasks", "coordinator")).unacknowledged.some(
        (v: any) => v.visit_id === f.visit.id,
      ),
    ).toBe(true);
    await post(
      "/visits/" + f.visit.id + "/action",
      { action: "acknowledge", version: f.visit.version },
      "technician",
    );
    expect(
      (await get("/operational-tasks", "coordinator")).unacknowledged.some(
        (v: any) => v.visit_id === f.visit.id,
      ),
    ).toBe(false);
    await post(
      "/visits/" + f.visit.id + "/action",
      {
        action: "decline",
        version: f.visit.version + 1,
        reason: "Cannot safely access this roof",
      },
      "technician",
    );
    const d = await get("/tickets/" + f.ticket.id);
    expect(d.ticket.status).toBe("open");
    expect(d.ticket.assigned_to).toBeNull();
    expect(
      (await get("/operational-tasks", "coordinator")).items.some(
        (t: any) =>
          t.visit_id === f.visit.id &&
          t.kind === "reschedule" &&
          t.status === "open",
      ),
    ).toBe(true);
  });
  it("[DSP-06] an actual overrun flags downstream appointments and customer contact without silently moving them", async () => {
    const f = await operationFixture();
    const t = await post("/tickets", {
      project_id: f.project.project.id,
      complaint: "Independent later appointment",
      fault_code: "Other",
    });
    const next = await post(
      "/visits",
      {
        ...f.body,
        ticket_id: t.id,
        starts_at: f.body.starts_at.replace("09:00", "11:30"),
      },
      "coordinator",
    );
    await post(
      "/visits/" + f.visit.id + "/action",
      { action: "start", version: f.visit.version },
      "technician",
    );
    const result = await post(
      "/visits/" + f.visit.id + "/extension",
      {
        version: f.visit.version + 1,
        ends_at: f.body.starts_at.replace("09:00", "12:30"),
        reason: "Additional testing required onsite",
      },
      "technician",
    );
    expect(result.affected_visits).toContain(next.id);
    const saved = (
      await db.query("SELECT starts_at,status FROM visits WHERE id=$1", [
        next.id,
      ])
    ).rows[0];
    expect(new Date(saved.starts_at).toISOString()).toBe(
      new Date(next.starts_at).toISOString(),
    );
    expect(saved.status).toBe("scheduled");
    expect(
      (await get("/operational-tasks", "coordinator")).items
        .filter((x: any) => x.visit_id === next.id)
        .map((x: any) => x.kind)
        .sort(),
    ).toEqual(["customer_contact", "overrun"]);
  });
});

describe("Customer intake and contact history", () => {
  it("[INT-02 INT-05 INT-06] unknown capacity stays explicit, survey sizes it, and hazard creates tracked review", async () => {
    const p = await post(
      "/projects",
      {
        name: "Unknown size caller",
        phone: "9876543210",
        address: "Synthetic locked roof",
        capacity_kw: null,
        system_type: "on_grid",
        source: "Phone",
        subsidy_interest: false,
        preferred_date: "2027-02-10",
        preferred_window: "afternoon",
        hazard_notes: "Customer reports sparking equipment",
      },
      "support",
    );
    let d = await get(`/projects/${p.id}`);
    expect(d.project.capacity_kw).toBeNull();
    expect(d.project.preferred_window).toBe("afternoon");
    expect(
      (await get("/operational-tasks", "coordinator")).items.some(
        (t: any) => t.project_id === p.id && t.kind === "hazard",
      ),
    ).toBe(true);
    const survey = {
      roof_area: 30,
      bill_minor: 200000,
      grid_suitable: true,
      direction: "South",
      tilt: 12,
      cable_distance: 15,
    };
    await post(`/projects/${p.id}/surveys`, survey, "surveyor");
    expect(
      (
        await req(
          "POST",
          `/projects/${p.id}/survey-approval`,
          { approved: true },
          "surveyor",
        )
      ).statusCode,
    ).toBe(409);
    await post(
      `/projects/${p.id}/surveys`,
      { ...survey, capacity_kw: 3 },
      "surveyor",
    );
    await post(
      `/projects/${p.id}/survey-approval`,
      { approved: true },
      "surveyor",
    );
    d = await get(`/projects/${p.id}`);
    expect(d.project.capacity_kw).toBe(3);
    expect(
      (await db.query("SELECT id FROM visits WHERE project_id=$1", [p.id]))
        .rowCount,
    ).toBe(0);
  });
  it("[INT-03 INT-04 CRM-03] returning customer can add a site or another system while repeated calls append to one request", async () => {
    const p = await enquiry(),
      d = await get(`/projects/${p.id}`);
    const body = {
      name: d.project.customer_name,
      phone: d.project.phone,
      address: "Second customer site",
      capacity_kw: 2,
      system_type: "on_grid",
      source: "Phone",
      subsidy_interest: false,
      customer_id: d.project.customer_id,
    };
    const second = await post("/projects", body, "support");
    const third = await post(
      "/projects",
      { ...body, site_id: p.site_id },
      "support",
    );
    const matches = await get(
      "/customers?search=" + encodeURIComponent(d.project.customer_name),
      "support",
    );
    const c = matches.items.find((c: any) => c.id === d.project.customer_id);
    expect(c.sites).toHaveLength(2);
    expect(c.sites.find((s: any) => s.id === p.site_id).projects).toHaveLength(
      2,
    );
    await post(
      `/projects/${p.id}/contact-notes`,
      { note: "Repeated call; customer asks for survey update" },
      "support",
    );
    const detail = await get(`/projects/${p.id}`, "support");
    expect(detail.contacts).toHaveLength(1);
    expect(detail.related_systems.map((x: any) => x.id).sort()).toEqual(
      [p.id, second.id, third.id].sort(),
    );
    const anonymous = await app.inject({
      method: "POST",
      url: "/api/enquiries/public",
      payload: { ...body, site_id: p.site_id },
    });
    expect(anonymous.statusCode).toBe(403);
  });
  it("[CRM-04 CRM-05 CRM-07 CRM-10] verified optimistic contact edits preserve issued name/address and restrict old phone history", async () => {
    const d = await ordered(),
      p = d.project,
      invoice = d.invoices[0];
    const body = {
      version: p.customer_version,
      name: "Corrected Customer",
      phone: "9998887776",
      phone_verified: false,
      billing_address: "Accounts office, Kochi",
      reason: "Customer verified contact correction",
    };
    expect(
      (
        await req(
          "POST",
          `/customers/${p.customer_id}/contact`,
          body,
          "support",
        )
      ).statusCode,
    ).toBe(409);
    const results = await Promise.all([
      req(
        "POST",
        `/customers/${p.customer_id}/contact`,
        { ...body, phone_verified: true },
        "support",
      ),
      req(
        "POST",
        `/customers/${p.customer_id}/contact`,
        { ...body, phone_verified: true, name: "Conflicting name" },
        "support",
      ),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = await get(`/projects/${p.id}`);
    expect(current.project.phone).toBe(body.phone);
    expect(current.invoices[0].customer_name_snapshot).toBe(
      invoice.customer_name_snapshot,
    );
    expect(current.invoices[0].billing_address_snapshot).toBe(
      invoice.billing_address_snapshot,
    );
    expect(
      (await get(`/customers/${p.customer_id}/history`, "support")).items[0]
        .before_value.phone,
    ).toBe(p.phone);
    expect(
      (
        await req(
          "GET",
          `/customers/${p.customer_id}/history`,
          undefined,
          "coordinator",
        )
      ).statusCode,
    ).toBe(403);
    const newProject = await post("/projects", {
      name: current.project.customer_name,
      phone: body.phone,
      address: "Separate service site",
      capacity_kw: 1,
      system_type: "on_grid",
      source: "Phone",
      subsidy_interest: false,
      customer_id: p.customer_id,
    });
    await post(`/projects/${newProject.id}/surveys`, {
      roof_area: 20,
      bill_minor: 100000,
      grid_suitable: true,
      direction: "South",
      tilt: 10,
      cable_distance: 5,
    });
    await post(`/projects/${newProject.id}/survey-approval`, {
      approved: true,
    });
    await post(`/projects/${newProject.id}/quotes`);
    await post(`/projects/${newProject.id}/acceptance`);
    const newer = await get(`/projects/${newProject.id}`);
    expect(newer.invoices[0].billing_address_snapshot).toBe(
      body.billing_address,
    );
    expect(newer.invoices[0].service_address_snapshot).toBe(
      "Separate service site",
    );
  });
  it("[CRM-06] assigned technician receives versioned site access instructions", async () => {
    const f = await operationFixture();
    const d = await get(`/projects/${f.ticket.project_id}`);
    await post(
      `/sites/${d.project.site_id}/access`,
      {
        version: d.project.site_version,
        access_notes: "Collect gate key at reception before roof access",
        reason: "Customer instructions",
      },
      "support",
    );
    expect(
      (await get(`/tickets/${f.ticket.id}`, "technician")).project.access_notes,
    ).toContain("gate key");
  });
  it("[CRM-08] reviewed administrator merge preserves project and all invoice identifiers", async () => {
    const d = await ordered(),
      other = await enquiry(),
      target = (await get(`/projects/${other.id}`)).project;
    const body = {
      version: d.project.customer_version,
      target_id: target.customer_id,
      target_version: target.customer_version,
      confirmed_same_customer: true,
      reason: "Reviewed duplicate identity and both sites",
    };
    expect(
      (
        await req(
          "POST",
          `/customers/${d.project.customer_id}/merge`,
          body,
          "support",
        )
      ).statusCode,
    ).toBe(403);
    await post(`/customers/${d.project.customer_id}/merge`, body);
    const after = await get(`/projects/${d.project.id}`);
    expect(after.project.customer_id).toBe(target.customer_id);
    expect(after.invoices.map((i: any) => i.id)).toEqual(
      d.invoices.map((i: any) => i.id),
    );
    expect(after.invoices[0].customer_name_snapshot).toBe(
      d.invoices[0].customer_name_snapshot,
    );
    expect(
      (
        await db.query("SELECT merged_into FROM customers WHERE id=$1", [
          d.project.customer_id,
        ])
      ).rows[0].merged_into,
    ).toBe(target.customer_id);
  });
  it("[INT-08] cancellation preserves enquiry history and releases the future survey appointment", async () => {
    const p = await enquiry();
    const day = new Date(Date.now() + 470 * 86400000);
    while (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
    const v = await post(
      "/visits",
      {
        project_id: p.id,
        starts_at: day.toISOString().slice(0, 10) + "T09:00:00+05:30",
        duration_hours: 2,
        skill: "survey",
        technician_ids: [accounts.technician.id],
        lead_id: accounts.technician.id,
      },
      "coordinator",
    );
    await post(
      `/projects/${p.id}/cancellation`,
      { reason: "Customer cancelled before site survey" },
      "support",
    );
    expect(
      (await db.query("SELECT status FROM visits WHERE id=$1", [v.id])).rows[0]
        .status,
    ).toBe("cancelled");
    expect((await get(`/projects/${p.id}`)).project.cancelled_at).toBeTruthy();
    expect((await req("POST", `/projects/${p.id}/quotes`, {})).statusCode).toBe(
      409,
    );
  });
});

describe("Component photo evidence", () => {
  it("[EVD-02 EVD-04] component-linked uploads reject foreign assets and concurrent retries store one private image", async () => {
    const f = await operationFixture();
    const { line } = await startDiagnosis(f);
    const before = (
      await db.query(
        "SELECT count(*)::int AS n FROM evidence WHERE ticket_id=$1",
        [f.ticket.id],
      )
    ).rows[0].n;
    const results = await Promise.all([
      repairPhoto(f.ticket.id, "technician", "tickets", "photo", {
        order_line_id: line.order_line_id,
        asset_id: line.asset_id,
      }),
      repairPhoto(f.ticket.id, "technician", "tickets", "photo", {
        order_line_id: line.order_line_id,
        asset_id: line.asset_id,
      }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(results[0].json().id).toBe(results[1].json().id);
    const detail = await get(`/tickets/${f.ticket.id}`);
    expect(detail.evidence).toHaveLength(before + 1);
    expect(detail.evidence.at(-1).order_line_id).toBe(line.order_line_id);
    const foreign = await operationFixture();
    const other = (await get(`/tickets/${foreign.ticket.id}`)).components.find(
      (c: any) => c.asset_id,
    );
    expect(
      (
        await repairPhoto(f.ticket.id, "technician", "tickets", "photo", {
          order_line_id: other.order_line_id,
          asset_id: other.asset_id,
        })
      ).statusCode,
    ).toBe(400);
  });
});

describe("Storage and transport failures", () => {
  it("[OPS-02] a real database connection loss rolls back intake and the same retry creates one record", async () => {
    const name = "Connection-loss " + id(),
      key = id(),
      body = {
        name,
        phone: "9876543211",
        address: "Synthetic outage site",
        capacity_kw: 1,
        system_type: "on_grid",
        source: "Phone",
        subsidy_interest: false,
      };
    await db.query(
      "CREATE FUNCTION pause_test_intake() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(5); RETURN NEW; END $$; CREATE TRIGGER pause_test_intake AFTER INSERT ON projects FOR EACH ROW EXECUTE FUNCTION pause_test_intake()",
    );
    try {
      const pending = req("POST", "/projects", body, "support", key);
      let pid = null;
      for (let n = 0; n < 40 && !pid; n++) {
        const r = await adminDb.query(
          "SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event='PgSleep'",
          [schema],
        );
        pid = r.rows[0]?.pid;
        if (!pid) await new Promise((r) => setTimeout(r, 50));
      }
      expect(pid).toBeTruthy();
      await adminDb.query("SELECT pg_terminate_backend($1)", [pid]);
      expect((await pending).statusCode).toBe(500);
    } finally {
      await db.query(
        "DROP TRIGGER pause_test_intake ON projects; DROP FUNCTION pause_test_intake()",
      );
    }
    expect(
      (await db.query("SELECT id FROM customers WHERE name=$1", [name]))
        .rowCount,
    ).toBe(0);
    const recovered = await post("/projects", body, "support", key),
      repeated = await post("/projects", body, "support", key);
    expect(repeated.id).toBe(recovered.id);
    expect(
      (await db.query("SELECT id FROM customers WHERE name=$1", [name]))
        .rowCount,
    ).toBe(1);
  });
  it("[OPS-03] injected disk-full write removes a partial file and never creates evidence metadata", async () => {
    const f = await operationFixture();
    await startDiagnosis(f);
    const files = await import("../../apps/api/src/plugins/files.js");
    const before = (await readdir(files.uploadDir)).sort(),
      count = (await get(`/tickets/${f.ticket.id}`)).evidence.length;
    const fault = vi
      .spyOn(files.evidenceStorage, "writeFile")
      .mockImplementationOnce(async (path: any) => {
        await writeFile(path, Buffer.from("partial"));
        throw Object.assign(new Error("Injected disk full"), {
          code: "ENOSPC",
        });
      });
    try {
      const failed = await repairPhoto(f.ticket.id);
      expect(failed.statusCode).toBe(503);
      expect(failed.json().error.message).toContain("Nothing was saved");
    } finally {
      fault.mockRestore();
    }
    expect((await readdir(files.uploadDir)).sort()).toEqual(before);
    expect((await get(`/tickets/${f.ticket.id}`)).evidence).toHaveLength(count);
    expect((await repairPhoto(f.ticket.id)).statusCode).toBe(200);
  });
  it("[EVD-04] an interrupted HTTP upload creates no evidence and a complete retry stores one usable photo", async () => {
    const f = await operationFixture();
    await startDiagnosis(f);
    const existing = app.server.address();
    const base =
      existing && typeof existing !== "string"
        ? `http://127.0.0.1:${existing.port}`
        : await app.listen({ port: 0, host: "127.0.0.1" });
    const { request } = await import("node:http");
    const boundary = "broken-upload-" + id();
    const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nphoto\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="interrupted.png"\r\nContent-Type: image/png\r\n\r\n`;
    await new Promise<void>((resolve) => {
      const upload = request(
        base + `/api/tickets/${f.ticket.id}/evidence`,
        {
          method: "POST",
          headers: {
            cookie: accounts.technician.cookie,
            "x-csrf-token": accounts.technician.csrf,
            "content-type": `multipart/form-data; boundary=${boundary}`,
            "content-length": 100000,
          },
        },
        () => {},
      );
      upload.on("error", () => resolve());
      upload.on("close", () => resolve());
      upload.write(prefix);
      upload.write(Buffer.from([137, 80, 78, 71]));
      setTimeout(() => upload.destroy(), 50);
    });
    expect((await get(`/tickets/${f.ticket.id}`)).evidence).toHaveLength(0);
    const retry = await repairPhoto(f.ticket.id, "technician");
    expect(retry.statusCode).toBe(200);
    const again = await repairPhoto(f.ticket.id, "technician");
    expect(again.json().id).toBe(retry.json().id);
    expect((await get(`/tickets/${f.ticket.id}`)).evidence).toHaveLength(1);
    expect(
      (
        await req(
          "GET",
          `/evidence/${retry.json().id}`,
          undefined,
          "technician",
        )
      ).statusCode,
    ).toBe(200);
  });
});

describe("Reviewed service exceptions", () => {
  it("[SRV-06] reviewed safe remote resolution records customer confirmation without onsite work or charges", async () => {
    const d = await delivered();
    const t = await post(
      "/tickets",
      {
        project_id: d.project.id,
        complaint: "Monitoring account display is confusing",
        fault_code: "Monitoring app",
      },
      "support",
    );
    const r = await post(
      `/tickets/${t.id}/outcome-review`,
      {
        version: t.version,
        kind: "remote",
        observations:
          "Explained the monitoring display; customer confirmed normal reading",
        customer_confirmation: "Synthetic customer confirmed by phone",
      },
      "support",
    );
    expect(
      (
        await req(
          "POST",
          `/service-reviews/${r.id}/decision`,
          { approved: true, note: "Self approval" },
          "support",
        )
      ).statusCode,
    ).toBe(403);
    await post(
      `/service-reviews/${r.id}/decision`,
      {
        approved: true,
        note: "Reviewed permitted remote category and customer confirmation",
      },
      "coordinator",
    );
    const saved = await get(`/tickets/${t.id}`);
    expect(saved.ticket.status).toBe("closed");
    expect(saved.visits).toHaveLength(0);
    expect(saved.evidence).toHaveLength(0);
    expect(saved.invoices).toHaveLength(0);
    expect(saved.ticket.labour_cost_minor).toBe(0);
    const urgent = await post(
      "/tickets",
      {
        project_id: d.project.id,
        complaint: "Sparks reported",
        fault_code: "Wiring or connection",
        priority: "urgent",
      },
      "support",
    );
    expect(
      (
        await req(
          "POST",
          `/tickets/${urgent.id}/outcome-review`,
          {
            version: urgent.version,
            kind: "remote",
            observations: "Should not be allowed",
            customer_confirmation: "Caller",
          },
          "support",
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (await get("/operational-tasks", "coordinator")).items.some(
        (t: any) => t.ticket_id === urgent.id && t.kind === "hazard",
      ),
    ).toBe(true);
  });
  it("[DIA-05] no-fault onsite findings need a photo and separate review, with zero charge and no replacement", async () => {
    const f = await operationFixture();
    await post(
      `/visits/${f.visit.id}/action`,
      { action: "start", version: f.visit.version },
      "technician",
    );
    const t = (await get(`/tickets/${f.ticket.id}`)).ticket,
      body = {
        version: t.version,
        kind: "no_fault",
        observations:
          "Generation and fault indicators tested normal; no faulty component identified",
        minutes: 35,
      };
    expect(
      (await req("POST", `/tickets/${t.id}/outcome-review`, body, "technician"))
        .statusCode,
    ).toBe(409);
    expect((await repairPhoto(t.id, "technician")).statusCode).toBe(200);
    const r = await post(`/tickets/${t.id}/outcome-review`, body, "technician");
    await post(
      `/service-reviews/${r.id}/decision`,
      {
        approved: true,
        note: "Reviewed diagnostic observations and test photo",
      },
      "coordinator",
    );
    const saved = await get(`/tickets/${t.id}`);
    expect(saved.lines).toHaveLength(0);
    expect(saved.ticket.status).toBe("awaiting_confirmation");
    expect(saved.visits[0].status).toBe("completed");
    expect(saved.invoices[0].total_minor).toBe(0);
    expect(saved.returns).toHaveLength(0);
    expect(saved.ticket.labour_cost_minor).toBeGreaterThan(0);
  });
  it("[INS-09] disputed installation handover creates review and cannot complete using an invented signature", async () => {
    const d = await delivered();
    const when = new Date(Date.now() + 760 * 86400000);
    while (when.getUTCDay() === 0) when.setUTCDate(when.getUTCDate() + 1);
    await post(`/jobs/${d.job.id}/assignment`, {
      technician_id: accounts.technician.id,
      scheduled_at: when.toISOString().slice(0, 10) + "T09:00:00+05:30",
      duration_hours: 2,
    });
    await post(`/jobs/${d.job.id}/start`, {}, "technician");
    await post(
      `/jobs/${d.job.id}/dispute`,
      { reason: "Customer asks for output review before signing" },
      "technician",
    );
    const body = {
      capacity_kw: 1,
      generation_kw: 0.8,
      labour_minutes: 60,
      signer_name: "Must not be accepted without evidence",
      checklist: {
        mounting: true,
        earthing: true,
        wiring: true,
        inverter: true,
        handover: true,
      },
    };
    const blocked = await req(
      "POST",
      `/jobs/${d.job.id}/completion`,
      body,
      "technician",
    );
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.message).toContain("dispute");
    expect(
      (await get("/operational-tasks", "coordinator")).items.some(
        (t: any) =>
          t.project_id === d.project.id && t.kind === "installation_dispute",
      ),
    ).toBe(true);
    await post(
      `/jobs/${d.job.id}/dispute-review`,
      { reason: "Customer reviewed output and agrees to resume handover" },
      "coordinator",
    );
    expect(
      (await req("POST", `/jobs/${d.job.id}/completion`, body, "technician"))
        .statusCode,
    ).toBe(409);
    expect((await get(`/projects/${d.project.id}`)).job.status).toBe(
      "in_progress",
    );
  });
  it("[DIA-09] cumulative quantity replacements require explicit coordinator entitlement review beyond installed count", async () => {
    const f = await operationFixture();
    await post(
      `/visits/${f.visit.id}/action`,
      { action: "start", version: f.visit.version },
      "technician",
    );
    let d = await get(`/tickets/${f.ticket.id}`);
    const c = d.components.find((c: any) => c.kind === "quantity");
    const line = {
      order_line_id: c.order_line_id,
      quantity: c.quantity,
      action: "replace",
      finding: "Test fixture: all quantity-tracked panels defective",
      labour_minutes: 30,
      labour_price_minor: 0,
    };
    await post(`/tickets/${f.ticket.id}/diagnosis`, {
      version: d.ticket.version,
      lines: [line],
    });
    await approveRepair(f);
    await repairPhoto(f.ticket.id);
    d = await get(`/tickets/${f.ticket.id}`);
    await post(`/tickets/${f.ticket.id}/resolution`, {
      version: d.ticket.version,
      resolution: "Quantity replacement completed",
    });
    const t = await post("/tickets", {
      project_id: f.project.project.id,
      complaint: "Repeated quantity fault after prior replacements",
      fault_code: "Physical damage",
    });
    const start = new Date(
      new Date(f.body.starts_at).getTime() + 7 * 86400000,
    ).toISOString();
    const v = await post("/visits", {
      ...f.body,
      ticket_id: t.id,
      starts_at: start,
    });
    await post(
      `/visits/${v.id}/action`,
      { version: v.version, action: "start" },
      "technician",
    );
    const current = (await get(`/tickets/${t.id}`)).ticket;
    expect(
      (
        await req(
          "POST",
          `/tickets/${t.id}/diagnosis`,
          { version: current.version, lines: [{ ...line, quantity: 1 }] },
          "technician",
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await req(
          "POST",
          `/tickets/${t.id}/diagnosis`,
          {
            version: current.version,
            lines: [
              {
                ...line,
                quantity: 1,
                entitlement_review: "Unauthorized override",
              },
            ],
          },
          "technician",
        )
      ).statusCode,
    ).toBe(409);
    await post(
      `/tickets/${t.id}/diagnosis`,
      {
        version: current.version,
        lines: [
          {
            ...line,
            quantity: 1,
            entitlement_review:
              "Reviewed prior replacements and identified a newly failed replacement panel",
          },
        ],
      },
      "coordinator",
    );
    expect(
      (await get(`/tickets/${t.id}`)).lines[0].entitlement_review,
    ).toContain("newly failed");
  });
});

describe("External equipment and independent supplier claims", () => {
  it("[DIA-04] third-party equipment is recorded without creating company entitlement", async () => {
    repairDay += 7;
    const f = await operationFixture();
    await post(
      `/visits/${f.visit.id}/action`,
      { action: "start", version: f.visit.version },
      "technician",
    );
    const before = await get(`/tickets/${f.ticket.id}`);
    const payload = {
      name: "Third party UPS",
      serial: "EXT-" + id(),
      findings: "Customer-owned UPS alarm; outside supplied system",
    };
    expect(
      (
        await req(
          "POST",
          `/tickets/${f.ticket.id}/external-equipment`,
          payload,
          "support",
        )
      ).statusCode,
    ).toBe(403);
    await post(
      `/tickets/${f.ticket.id}/external-equipment`,
      payload,
      "technician",
    );
    const after = await get(`/tickets/${f.ticket.id}`);
    expect(after.external_equipment[0].findings).toBe(payload.findings);
    expect(after.components).toEqual(before.components);
    expect(after.lines).toHaveLength(0);
  });
  it("[WAR-09 RMA-09] supplier custody, disputed decisions and bounded recoveries do not change customer cover or invoices", async () => {
    const f = await operationFixture();
    await startDiagnosis(f, { labour_price_minor: 0 });
    await approveRepair(f);
    await repairPhoto(f.ticket.id);
    await post(`/tickets/${f.ticket.id}/resolution`, {
      resolution: "Covered replacement tested",
    });
    let d = await get(`/tickets/${f.ticket.id}`);
    const original = JSON.stringify({
        invoices: d.invoices,
        components: d.components,
      }),
      r = d.returns[0];
    const shipment = {
      supplier: "Synthetic manufacturer",
      reference: id(),
      tracking_reference: "SHIP-" + id(),
      requested_minor: 50000,
    };
    expect(
      (
        await req(
          "POST",
          `/service-returns/${r.id}/supplier-claim`,
          shipment,
          "warehouse",
        )
      ).statusCode,
    ).toBe(409);
    await post(
      `/service-returns/${r.id}/receive`,
      { confirmed_by: "Warehouse received faulty unit" },
      "warehouse",
    );
    const c = await post(
      `/service-returns/${r.id}/supplier-claim`,
      shipment,
      "warehouse",
    );
    expect((await get(`/tickets/${f.ticket.id}`)).returns[0].status).toBe(
      "sent_to_supplier",
    );
    expect(
      (
        await req(
          "POST",
          `/supplier-claims/${c.id}/decision`,
          {
            version: 1,
            status: "approved",
            amount_minor: 40000,
            note: "Manufacturer approval",
          },
          "warehouse",
        )
      ).statusCode,
    ).toBe(403);
    await post(
      `/supplier-claims/${c.id}/decision`,
      {
        version: 1,
        status: "disputed",
        amount_minor: 0,
        note: "Manufacturer requested test results",
      },
      "accounts",
    );
    await post(
      `/supplier-claims/${c.id}/decision`,
      {
        version: 2,
        status: "approved",
        amount_minor: 40000,
        note: "Manufacturer accepted revised claim",
      },
      "accounts",
    );
    const attempts = await Promise.all([
      req(
        "POST",
        `/supplier-claims/${c.id}/recoveries`,
        { amount_minor: 30000, reference: id() },
        "accounts",
      ),
      req(
        "POST",
        `/supplier-claims/${c.id}/recoveries`,
        { amount_minor: 30000, reference: id() },
        "accounts",
      ),
    ]);
    expect(attempts.map((x) => x.statusCode).sort()).toEqual([200, 409]);
    await post(
      `/supplier-claims/${c.id}/recoveries`,
      { amount_minor: 10000, reference: id() },
      "accounts",
    );
    const claim = (await get("/supplier-claims", "accounts")).items.find(
      (x: any) => x.id === c.id,
    );
    expect(claim.status).toBe("paid");
    expect(claim.recovered_minor).toBe(40000);
    d = await get(`/tickets/${f.ticket.id}`);
    expect(d.returns[0].status).toBe("closed");
    expect(
      JSON.stringify({ invoices: d.invoices, components: d.components }),
    ).toBe(original);
  });
});

it("[RMA-07 SRV-08] unavailable parts block a promised return visit until replenishment and warehouse readiness", async () => {
  const f = await operationFixture();
  await startDiagnosis(f, { action: "repair", replacement_serial: "" });
  const d = await get(`/tickets/${f.ticket.id}`),
    component = d.components.find((c: any) => c.kind === "quantity");
  const stock = (
    await db.query("SELECT * FROM products WHERE id=$1", [component.product_id])
  ).rows[0];
  const request = await post(
    `/tickets/${f.ticket.id}/parts-requests`,
    {
      product_id: component.product_id,
      quantity: stock.stock_qty + 1,
      note: "Supplier checking availability",
    },
    "technician",
  );
  await post(
    `/visits/${f.visit.id}/action`,
    {
      action: "diagnosis_done",
      version: d.visits[0].version,
      reason: "Parts unavailable; diagnosis visit complete",
    },
    "technician",
  );
  const next = {
    ...f.body,
    starts_at: new Date(
      +new Date(f.body.starts_at) + 86400000 * 14,
    ).toISOString(),
  };
  expect((await req("POST", "/visits", next, "coordinator")).statusCode).toBe(
    409,
  );
  expect(
    (
      await req(
        "POST",
        `/parts-requests/${request.id}/readiness`,
        { version: 1, outcome: "Supplier only promised stock" },
        "warehouse",
      )
    ).statusCode,
  ).toBe(409);
  await post(
    "/receipts",
    {
      product_id: component.product_id,
      supplier: "QA parts supplier",
      reference: id(),
      quantity: stock.reserved_qty + 2,
      unit_cost_minor: 100,
      serials: [],
    },
    "warehouse",
  );
  await post(
    `/parts-requests/${request.id}/readiness`,
    { version: 1, outcome: "Warehouse physically received stock" },
    "warehouse",
  );
  const v = await post("/visits", next, "coordinator");
  expect(v.status).toBe("scheduled");
  expect(
    (await get("/operational-tasks", "coordinator")).items.some(
      (x: any) => x.ticket_id === f.ticket.id && x.kind === "parts",
    ),
  ).toBe(true);
  repairDay += 14;
});

it("[DLV-06] separate line receipts start only received-component warranties and retain dates on retry", async () => {
  const d = await paid();
  await scanAll(d);
  await post(`/orders/${d.order.id}/dispatch`);
  const lines = d.order.lines.filter((l: any) => l.kind !== "service");
  await post(`/orders/${d.order.id}/delivery`, {
    line_ids: [lines[0].id],
    received_by: "Customer accepts this line only",
  });
  let current = await get(`/projects/${d.project.id}`);
  expect(current.order.status).toBe("dispatched");
  expect(current.order.lines.filter((l: any) => l.delivered_at)).toHaveLength(
    1,
  );
  expect(
    current.warranties.every((w: any) => w.order_line_id === lines[0].id),
  ).toBe(true);
  const original = JSON.stringify(current.warranties);
  await post(`/orders/${d.order.id}/delivery`, {
    line_ids: [lines[0].id],
    received_by: "Retry same receipt",
  });
  expect(
    JSON.stringify((await get(`/projects/${d.project.id}`)).warranties),
  ).toBe(original);
  await post(`/orders/${d.order.id}/delivery`);
  current = await get(`/projects/${d.project.id}`);
  expect(current.order.status).toBe("delivered");
  expect(
    current.order.lines
      .filter((l: any) => l.kind !== "service")
      .every((l: any) => l.delivered_at),
  ).toBe(true);
});
it("[DLV-07 DLV-09] failed destination and customer refusal preserve custody, block warranty and create follow-up tasks", async () => {
  const d = await paid();
  await scanAll(d);
  await post(`/orders/${d.order.id}/dispatch`);
  const wrong = await post(
    `/orders/${d.order.id}/delivery-incidents`,
    {
      kind: "wrong_destination",
      custody: "Driver QA, truck at wrong gate",
      reason: "Address could not be verified",
    },
    "warehouse",
  );
  expect(
    (await req("POST", `/orders/${d.order.id}/delivery`, {}, "warehouse"))
      .statusCode,
  ).toBe(409);
  expect((await get(`/projects/${d.project.id}`)).warranties).toHaveLength(0);
  await post(
    `/delivery-incidents/${wrong.id}/review`,
    {
      version: 1,
      status: "retry",
      custody: "Driver returning to verified address",
      outcome: "Customer confirmed correct gate",
    },
    "coordinator",
  );
  const refusal = await post(
    `/orders/${d.order.id}/delivery-incidents`,
    {
      kind: "refused",
      custody: "Driver QA retaining unopened shipment",
      reason: "Customer requested return",
    },
    "warehouse",
  );
  await post(
    `/delivery-incidents/${refusal.id}/review`,
    {
      version: 1,
      status: "returned",
      custody: "Warehouse return bay; not saleable stock",
      outcome: "Return received for review",
    },
    "coordinator",
  );
  expect(
    (await req("POST", `/orders/${d.order.id}/delivery`, {}, "warehouse"))
      .statusCode,
  ).toBe(409);
  const tasks = (await get("/operational-tasks", "coordinator")).items.filter(
    (t: any) => t.project_id === d.project.id,
  );
  expect(tasks.some((t: any) => t.kind === "reschedule")).toBe(true);
  expect(tasks.some((t: any) => t.kind === "customer_contact")).toBe(true);
});

it("[STK-08] damaged allocated serial is quarantined and a substitute must be scanned before dispatch", async () => {
  const d = await paid();
  await scanAll(d);
  let current = await get(`/projects/${d.project.id}`);
  const a = (
    await db.query("SELECT * FROM assets WHERE id=$1", [current.assets[0].id])
  ).rows[0];
  await post(
    `/assets/${a.id}/quarantine`,
    { reason: "Cracked case found while packing; isolated bin Q1" },
    "warehouse",
  );
  expect(
    (await req("POST", `/orders/${d.order.id}/dispatch`, {}, "warehouse"))
      .statusCode,
  ).toBe(409);
  expect(
    (
      await req(
        "POST",
        `/orders/${d.order.id}/scans`,
        { serial: a.serial },
        "warehouse",
      )
    ).statusCode,
  ).toBe(409);
  const spare = (
    await db.query(
      "SELECT serial FROM assets WHERE product_id=$1 AND status='available' LIMIT 1",
      [a.product_id],
    )
  ).rows[0];
  await post(
    `/orders/${d.order.id}/scans`,
    { serial: spare.serial },
    "warehouse",
  );
  await post(`/orders/${d.order.id}/dispatch`, {}, "warehouse");
  expect(
    (await db.query("SELECT status FROM assets WHERE id=$1", [a.id])).rows[0]
      .status,
  ).toBe("quarantined");
});
it("[STK-10] stock count needs a second reviewer, preserves reservations and rejects stale counts", async () => {
  const p = (
    await db.query(
      "SELECT * FROM products WHERE kind='quantity' AND stock_qty>reserved_qty+2 LIMIT 1",
    )
  ).rows[0];
  const count = await post(
    "/stock-counts",
    {
      product_id: p.id,
      counted_quantity: p.stock_qty - 1,
      reason: "Physical count found one damaged quantity unit",
    },
    "warehouse",
  );
  expect(
    (
      await req(
        "POST",
        `/stock-counts/${count.id}/review`,
        { approved: true, note: "Self approval" },
        "warehouse",
      )
    ).statusCode,
  ).toBe(403);
  await post(
    `/stock-counts/${count.id}/review`,
    { approved: true, note: "Verified physical count independently" },
    "accounts",
  );
  expect(
    (await db.query("SELECT stock_qty FROM products WHERE id=$1", [p.id]))
      .rows[0].stock_qty,
  ).toBe(p.stock_qty - 1);
  const stale = await post(
    "/stock-counts",
    {
      product_id: p.id,
      counted_quantity: p.stock_qty - 1,
      reason: "Second count",
    },
    "warehouse",
  );
  await post(
    "/receipts",
    {
      product_id: p.id,
      supplier: "QA",
      reference: id(),
      quantity: 1,
      unit_cost_minor: 100,
      serials: [],
    },
    "warehouse",
  );
  expect(
    (
      await req(
        "POST",
        `/stock-counts/${stale.id}/review`,
        { approved: true, note: "Stale review" },
        "accounts",
      )
    ).statusCode,
  ).toBe(409);
});

it("[QUO-08] reviewed paid-order cancellation releases stock, credits the retained invoice and permits only the actual refundable amount", async () => {
  const d = await paid();
  await scanAll(d);
  const c = await post(
    `/orders/${d.order.id}/cancellation`,
    { reason: "Customer cancelled before shipment" },
    "sales",
  );
  await post(
    `/order-cancellations/${c.id}/review`,
    { approved: true, note: "Verified customer withdrawal before dispatch" },
    "accounts",
  );
  const after = await get(`/projects/${d.project.id}`);
  expect(after.order.status).toBe("cancelled");
  expect(after.job.status).toBe("cancelled");
  expect(after.assets).toHaveLength(0);
  expect(after.order.lines.every((l: any) => !l.reserved)).toBe(true);
  expect(
    (
      await req(
        "POST",
        `/orders/${d.order.id}/scans`,
        { serial: "NONE" },
        "warehouse",
      )
    ).statusCode,
  ).toBe(409);
  const ledger = await get(`/invoices/${d.invoices[0].id}/ledger`, "accounts");
  expect(ledger.invoice.net_total_minor).toBe(0);
  expect(ledger.invoice.total_minor).toBe(d.invoices[0].total_minor);
  await post(
    `/invoices/${d.invoices[0].id}/refunds`,
    {
      amount_minor: d.order.minimum_advance_minor,
      reference: id(),
      reason: "Cancellation advance returned",
    },
    "accounts",
  );
  expect(
    (
      await req(
        "POST",
        `/invoices/${d.invoices[0].id}/refunds`,
        { amount_minor: 1, reference: id(), reason: "Duplicate refund" },
        "accounts",
      )
    ).statusCode,
  ).toBe(409);
});

it("[QUO-05] discount ceiling and independent approval create a fresh quote without rewriting the original", async () => {
  const p = await surveyed(),
    q = await post(`/projects/${p.id}/quotes`);
  expect(
    (
      await req(
        "POST",
        `/quotes/${q.id}/discount`,
        { percent: 21, reason: "Too large" },
        "sales",
      )
    ).statusCode,
  ).toBe(400);
  const r = await post(
    `/quotes/${q.id}/discount`,
    { percent: 10, reason: "Customer negotiated campaign offer" },
    "sales",
  );
  expect(
    (
      await req(
        "POST",
        `/quote-discounts/${r.id}/review`,
        { approved: true, note: "Sales self approval" },
        "sales",
      )
    ).statusCode,
  ).toBe(403);
  const approved = await post(
    `/quote-discounts/${r.id}/review`,
    { approved: true, note: "Within demo discount policy" },
    "admin",
  );
  const d = await get(`/projects/${p.id}`);
  expect(d.quotes[0].id).toBe(approved.result.id);
  expect(d.quotes[0].total_minor).toBeLessThan(q.total_minor);
  expect(d.quotes.find((x: any) => x.id === q.id).total_minor).toBe(
    q.total_minor,
  );
  expect(
    (
      await req(
        "POST",
        `/projects/${p.id}/acceptance`,
        { quote_id: q.id },
        "sales",
      )
    ).statusCode,
  ).toBe(409);
  await post(
    `/projects/${p.id}/acceptance`,
    { quote_id: approved.result.id },
    "sales",
  );
});

it("[RMA-04] different-model replacement needs engineering and customer agreement and preserves the original warranty", async () => {
  const f = await operationFixture();
  await post(
    `/visits/${f.visit.id}/action`,
    { action: "start", version: f.visit.version },
    "technician",
  );
  let d = await get(`/tickets/${f.ticket.id}`);
  const component = d.components.find(
    (c: any) => c.asset_status === "delivered",
  );
  const model = (
      await db.query(
        "SELECT * FROM products WHERE kind='serialized' AND id<>$1 LIMIT 1",
        [component.product_id],
      )
    ).rows[0],
    serial = ("COMPAT-" + id()).toUpperCase();
  await post(
    "/receipts",
    {
      product_id: model.id,
      supplier: "QA engineering supplier",
      reference: id(),
      quantity: 1,
      unit_cost_minor: 45000,
      serials: [serial],
    },
    "warehouse",
  );
  const line = {
    order_line_id: component.order_line_id,
    asset_id: component.asset_id,
    quantity: 1,
    finding: "Original model discontinued; replacement engineered",
    action: "replace",
    replacement_serial: serial,
    labour_minutes: 30,
    labour_price_minor: 0,
  };
  expect(
    (
      await req(
        "POST",
        `/tickets/${f.ticket.id}/diagnosis`,
        { version: d.ticket.version, lines: [line] },
        "technician",
      )
    ).statusCode,
  ).toBe(409);
  const approval = {
    asset_id: component.asset_id,
    replacement_product_id: model.id,
    compatibility_note:
      "Synthetic engineering sign-off: ratings, connectors and protection checked for this test configuration",
    customer_agreement: "Customer agreed to substitute and stated retail value",
    unit_price_minor: 60000,
  };
  expect(
    (
      await req(
        "POST",
        `/tickets/${f.ticket.id}/engineering-substitutes`,
        approval,
        "technician",
      )
    ).statusCode,
  ).toBe(403);
  await post(
    `/tickets/${f.ticket.id}/engineering-substitutes`,
    approval,
    "coordinator",
  );
  await post(
    `/tickets/${f.ticket.id}/diagnosis`,
    { version: d.ticket.version, lines: [line] },
    "technician",
  );
  await approveRepair(f);
  await repairPhoto(f.ticket.id);
  await post(`/tickets/${f.ticket.id}/resolution`, {
    resolution: "Approved substitute commissioned and tested",
  });
  d = await get(`/tickets/${f.ticket.id}`);
  const replacement = d.components.find((c: any) => c.serial === serial);
  expect(replacement.product_id).toBe(model.id);
  expect(replacement.expires_at).toBe(component.expires_at);
  expect(
    d.invoices[0].lines.some(
      (l: any) =>
        l.replacement_serial === serial && l.gross_unit_price_minor === 60000,
    ),
  ).toBe(true);
});

it("[QUO-09 SUR-10] accepted-order additions use a linked survey-approved change order and bill only approved extras", async () => {
  const original = await delivered(),
    before = JSON.stringify(original.invoices),
    battery = (
      await db.query(
        "SELECT * FROM products WHERE kind='serialized' AND name ILIKE '%battery%' LIMIT 1",
      )
    ).rows[0];
  const change = await post(
    `/projects/${original.project.id}/change-orders`,
    {
      reason:
        "Customer requests an additional battery after initial acceptance",
      lines: [{ product_id: battery.id, quantity: 1 }],
    },
    "sales",
  );
  expect(
    (await req("POST", `/projects/${change.id}/quotes`, {}, "sales"))
      .statusCode,
  ).toBe(409);
  await post(
    `/projects/${change.id}/surveys`,
    {
      roof_area: 50,
      bill_minor: 100000,
      grid_suitable: true,
      direction: "South",
      tilt: 15,
      cable_distance: 10,
      notes: "Additional battery compatibility and location checked",
    },
    "surveyor",
  );
  await post(
    `/projects/${change.id}/survey-approval`,
    { approved: true },
    "surveyor",
  );
  await post(`/projects/${change.id}/quotes`, {}, "sales");
  const pending = await get(`/projects/${change.id}`);
  expect(pending.quotes[0].lines).toHaveLength(1);
  expect(pending.quotes[0].total_minor).toBe(battery.price_minor);
  await post(
    `/projects/${change.id}/acceptance`,
    { quote_id: pending.quotes[0].id },
    "sales",
  );
  const after = await get(`/projects/${original.project.id}`);
  expect(JSON.stringify(after.invoices)).toBe(before);
  expect(after.change_orders[0].id).toBe(change.id);
});

it("[DLV-08] transit-damaged device is quarantined, replacement shipment is reviewed and only the received replacement gains warranty", async () => {
  const d = await paid();
  await scanAll(d);
  await post(`/orders/${d.order.id}/dispatch`);
  const a = (
    await db.query(
      "SELECT a.* FROM assets a JOIN order_lines l ON l.id=a.order_line_id WHERE l.order_id=$1 LIMIT 1",
      [d.order.id],
    )
  ).rows[0];
  const r = await post(
    `/orders/${d.order.id}/delivery-incidents`,
    {
      kind: "transit_damage",
      custody: "Returned truck, bay Q2",
      reason: "Impact damage to device case",
    },
    "warehouse",
  );
  await post(
    `/delivery-incidents/${r.id}/review`,
    {
      version: 1,
      status: "returned",
      custody: "Quarantine inspection bay",
      outcome: "Customer refused damaged device",
    },
    "coordinator",
  );
  expect(
    (
      await req(
        "POST",
        `/delivery-incidents/${r.id}/review`,
        {
          version: 2,
          status: "retry",
          custody: "Truck",
          outcome: "No replacement yet",
        },
        "coordinator",
      )
    ).statusCode,
  ).toBe(409);
  const spare = (
    await db.query(
      "SELECT serial FROM assets WHERE product_id=$1 AND status='available' LIMIT 1",
      [a.product_id],
    )
  ).rows[0];
  await post(
    `/delivery-incidents/${r.id}/replacements`,
    {
      asset_id: a.id,
      replacement_serial: spare.serial,
      note: "Replacement inspected and loaded; original isolated",
    },
    "warehouse",
  );
  await post(
    `/delivery-incidents/${r.id}/review`,
    {
      version: 2,
      status: "retry",
      custody: "Driver with replacement shipment",
      outcome: "Inspected replacement and customer agreed new delivery",
    },
    "coordinator",
  );
  await post(`/orders/${d.order.id}/delivery`, {}, "warehouse");
  expect(
    (await db.query("SELECT status FROM assets WHERE id=$1", [a.id])).rows[0]
      .status,
  ).toBe("quarantined");
  expect(
    (await db.query("SELECT id FROM warranties WHERE asset_id=$1", [a.id]))
      .rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "SELECT w.id FROM warranties w JOIN assets a ON a.id=w.asset_id WHERE a.serial=$1",
        [spare.serial],
      )
    ).rows,
  ).toHaveLength(1);
});

it("[OPS-10] named isolated training reset replays only its selected dataset and refuses nontraining names", async () => {
  const { trainingWorkspace } =
    await import("../../scripts/training-workspace.mjs");
  const name = "qa_" + id().replaceAll("-", "").slice(0, 12);
  const before = (await db.query("SELECT count(*)::int AS n FROM projects"))
    .rows[0].n;
  await expect(trainingWorkspace(baseUrl, "../public", true)).rejects.toThrow();
  const result = await trainingWorkspace(baseUrl, name);
  const scoped = new Pool({ connectionString: result.url });
  try {
    const count = (
      await scoped.query("SELECT count(*)::int AS n FROM projects")
    ).rows[0].n;
    await scoped.query("UPDATE customers SET name='Training edit'");
    await trainingWorkspace(baseUrl, name, true);
    expect(
      (await scoped.query("SELECT count(*)::int AS n FROM projects")).rows[0].n,
    ).toBe(count);
    expect(
      (
        await scoped.query(
          "SELECT count(*)::int AS n FROM customers WHERE name='Training edit'",
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (await db.query("SELECT count(*)::int AS n FROM projects")).rows[0].n,
    ).toBe(before);
  } finally {
    await scoped.end();
    await adminDb.query(`DROP SCHEMA ${result.schema} CASCADE`);
  }
});
it("[DSP-02] dispatch ranks aged requests and urgent targets, then suggests qualified crews by workload with travel and stable tie reasons", async () => {
  const f = await operationFixture();
  const old = await post(
    "/tickets",
    {
      project_id: f.project.project.id,
      complaint: "Long-waiting routine customer",
      fault_code: "Low generation",
    },
    "support",
  );
  await db.query(
    "UPDATE tickets SET opened_at=now()-interval '9 days' WHERE id=$1",
    [old.id],
  );
  const urgent = await post(
    "/tickets",
    {
      project_id: f.project.project.id,
      complaint: "Reported smoke; isolate and escalate",
      fault_code: "Electrical hazard",
      priority: "urgent",
    },
    "support",
  );
  const rows = await get("/tickets", "coordinator");
  expect(rows.findIndex((t: any) => t.id === old.id)).toBeLessThan(
    rows.findIndex((t: any) => t.id === urgent.id),
  );
  expect(rows.find((t: any) => t.id === old.id).dispatch_reason).toContain(
    "starvation",
  );
  const day = f.body.starts_at.slice(0, 10);
  const available = await get(
    `/schedule/availability?from=${day}&to=${day}&skill=inverter_repair&duration_hours=1&crew_size=1`,
    "coordinator",
  );
  expect(available.slots.length).toBeGreaterThan(0);
  for (const slot of available.slots) {
    const hours = slot.candidates.map((c: any) => c.booked_hours);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    expect(
      slot.candidates.every((c: any) =>
        c.reason.includes("30-minute travel buffer"),
      ),
    ).toBe(true);
  }
});
it("[DSP-03] urgent fault creates human hazard escalation and displaced customers get explicit rescheduling and contact tasks", async () => {
  const f = await operationFixture();
  await post(
    "/tickets",
    {
      project_id: f.project.project.id,
      complaint: "Smoke reported at inverter",
      fault_code: "Electrical hazard",
      priority: "urgent",
    },
    "support",
  );
  const tasks = await get("/operational-tasks", "coordinator");
  expect(
    tasks.items.some(
      (t: any) => t.project_id === f.project.project.id && t.kind === "hazard",
    ),
  ).toBe(true);
  const next = {
    ...f.body,
    visit_id: f.visit.id,
    version: f.visit.version,
    starts_at: new Date(
      +new Date(f.body.starts_at) + 14 * 86400000,
    ).toISOString(),
    reason: "Customer agreed new date after urgent dispatch review",
  };
  await post("/visits", next, "coordinator");
  expect(
    (await get("/operational-tasks", "coordinator")).items.some(
      (t: any) =>
        t.project_id === f.project.project.id && t.kind === "customer_contact",
    ),
  ).toBe(true);
  repairDay += 14;
});
