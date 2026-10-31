import type { FastifyInstance, FastifyRequest } from "fastify";
import type { TSchema } from "typebox";
import * as C from "../../../packages/contracts/src/index.js";
import { audit, ensure, one, pool, transaction, type Db } from "./db.js";
import { allow, digest } from "./plugins/auth.js";
import * as sales from "./modules/sales.js";
import * as stock from "./modules/inventory.js";
import * as field from "./modules/field.js";
import * as service from "./modules/service.js";
import * as read from "./modules/queries.js";
type Command = (
  db: Db,
  req: FastifyRequest,
  id: string,
  body: any,
) => Promise<unknown>;
export async function routes(app: FastifyInstance) {
  function command(
    url: string,
    roles: C.Role[],
    body: TSchema | undefined,
    fn: Command,
  ) {
    app.post(
      `/api${url}`,
      {
        schema: {
          ...(url.includes(":id") ? { params: C.Params } : {}),
          ...(body ? { body } : {}),
          tags: [url.split("/")[1]],
          description: `Roles: ${roles.join(", ")}. Requires session, X-CSRF-Token and Idempotency-Key.`,
        },
      },
      async (req) => {
        allow(req, roles);
        const key = req.headers["idempotency-key"];
        ensure(
          typeof key === "string" && key.length >= 8 && key.length <= 128,
          "An Idempotency-Key of 8–128 characters is required.",
          400,
        );
        const hash = digest(JSON.stringify(req.body || {}));
        return transaction(async (db) => {
          await db.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [`${req.user.id}:${key}`],
          );
          const old = await one(
            db,
            "SELECT * FROM idempotency WHERE user_id=$1 AND key=$2",
            [req.user.id, key],
          );
          if (old) {
            ensure(
              old.route === req.url && old.body_hash === hash,
              "This request key was already used with different details.",
            );
            return old.result;
          }
          const result = await fn(
            db,
            req,
            (req.params as any)?.id,
            req.body || {},
          );
          await db.query(
            "INSERT INTO idempotency(user_id,key,route,body_hash,result) VALUES($1,$2,$3,$4,$5)",
            [req.user.id, key, req.url, hash, JSON.stringify(result)],
          );
          return result;
        });
      },
    );
  }
  app.get("/api/dashboard", (req) => read.dashboard(req.user));
  app.get("/api/demo-tools", async () => ({
    enabled: process.env.DEMO_TOOLS === "true",
  }));
  app.get("/api/team", async (req) => {
    allow(req, ["admin"]);
    return {
      items: (
        await pool.query(
          "SELECT u.id,u.name,u.email,u.role,u.active,(SELECT count(*)::integer FROM jobs j WHERE j.technician_id=u.id AND j.status<>'completed') AS open_jobs FROM users u ORDER BY u.role,u.name",
        )
      ).rows,
    };
  });
  app.get("/api/barcodes", async (req) => {
    allow(req, ["admin", "warehouse", "accounts"]);
    return {
      items: (
        await pool.query(
          "SELECT a.id,a.serial,a.status,p.id AS product_id,p.name AS product_name,p.sku FROM assets a JOIN products p ON p.id=a.product_id ORDER BY p.sku,a.serial",
        )
      ).rows,
    };
  });
  app.get(
    "/api/orders/:id/available-serials",
    { schema: { params: C.Params } },
    async (req) => {
      allow(req, ["admin", "warehouse"]);
      ensure(
        process.env.DEMO_TOOLS === "true",
        "Test helpers are disabled.",
        404,
      );
      const rows = await pool.query(
        "SELECT a.serial,p.name AS product_name,p.sku FROM assets a JOIN products p ON p.id=a.product_id JOIN order_lines l ON l.product_id=a.product_id JOIN orders o ON o.id=l.order_id WHERE o.id=$1 AND o.status='packing' AND l.reserved AND a.status='available' ORDER BY p.sku,a.serial",
        [(req.params as any).id],
      );
      return { items: rows.rows };
    },
  );
  app.get("/api/projects", { schema: { querystring: C.ListQuery } }, (req) =>
    read.listProjects(req.user, req.query),
  );
  app.get("/api/projects/:id", { schema: { params: C.Params } }, (req) =>
    read.projectDetail(req.user, (req.params as any).id),
  );
  app.get("/api/users", async () => ({
    items: (
      await pool.query(
        "SELECT id,name,email,role,hourly_rate_minor FROM users WHERE active ORDER BY name",
      )
    ).rows.map(({ hourly_rate_minor, ...u }) => u),
  }));
  app.get(
    "/api/policy",
    async () =>
      (await one(pool, "SELECT value FROM settings WHERE key='policy'")).value,
  );
  app.get("/api/products", async (req) => {
    allow(req, ["admin", "sales", "warehouse", "accounts", "support"]);
    const rows = (await pool.query("SELECT * FROM products ORDER BY sku")).rows;
    return {
      items: rows.map((p) => {
        if (!["admin", "accounts"].includes(req.user.role))
          delete p.stock_value_minor;
        return p;
      }),
    };
  });
  app.get("/api/inventory", async (req) => {
    allow(req, ["admin", "warehouse", "accounts"]);
    return {
      products: (await pool.query("SELECT * FROM products ORDER BY sku")).rows,
      assets: (
        await pool.query(
          "SELECT a.id,a.serial,a.status,a.order_line_id,p.name AS product_name,p.sku FROM assets a JOIN products p ON p.id=a.product_id ORDER BY a.serial LIMIT 500",
        )
      ).rows,
      receipts: (
        await pool.query(
          "SELECT r.*,p.name AS product_name FROM receipts r JOIN products p ON p.id=r.product_id ORDER BY created_at DESC LIMIT 50",
        )
      ).rows,
    };
  });
  app.get("/api/jobs", async (req) => ({
    items: (
      await pool.query(
        `${read.projectSelect} WHERE j.id IS NOT NULL AND ($1::uuid IS NULL OR j.technician_id=$1) ORDER BY j.scheduled_at NULLS LAST`,
        [req.user.role === "technician" ? req.user.id : null],
      )
    ).rows,
  }));
  app.get("/api/passports", { schema: { querystring: C.ListQuery } }, (req) => {
    allow(req, ["admin", "support", "sales", "warehouse"]);
    return read.passports((req.query as any).search || "");
  });
  app.get("/api/tickets", (req) => {
    allow(req, ["admin", "support", "accounts"]);
    return read.ticketList();
  });
  app.get("/api/reports", (req) => {
    allow(req, ["admin", "accounts"]);
    return read.financeSummary((req.query as any).period || "month");
  });
  app.get("/api/reports/export", async (req, reply) => {
    allow(req, ["admin", "accounts"]);
    const report = await read.financeSummary(
      (req.query as any).period || "month",
    );
    const cell = (v: unknown) =>
      `"${String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      [
        "Project",
        "Customer",
        "Stage",
        "Invoiced INR",
        "Collected INR",
        "Direct cost INR",
        "Completed contribution INR",
      ],
      ...report.jobs.map((j) => [
        `SP-${j.number}`,
        j.customer_name,
        j.stage,
        j.invoiced_minor / 100,
        j.collected_minor / 100,
        j.direct_cost_minor / 100,
        j.contribution_minor === null ? "" : j.contribution_minor / 100,
      ]),
    ];
    return reply
      .type("text/csv")
      .header(
        "Content-Disposition",
        'attachment; filename="sunpower-report.csv"',
      )
      .send("\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n"));
  });
  app.post(
    "/api/enquiries/public",
    {
      schema: { body: C.Enquiry },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    (req) =>
      transaction((db) =>
        sales.createEnquiry(db, null, {
          ...(req.body as C.EnquiryInput),
          source: "website",
          owner_id: undefined,
        }),
      ),
  );
  command("/projects", ["admin", "sales"], C.Enquiry, (db, r, _id, b) =>
    sales.createEnquiry(db, r.user.id, b),
  );
  command(
    "/projects/:id/surveys",
    ["admin", "surveyor"],
    C.Survey,
    (db, r, id, b) => sales.saveSurvey(db, r.user.id, id, b),
  );
  command(
    "/projects/:id/survey-approval",
    ["admin", "surveyor"],
    C.Approval,
    (db, r, id, b) => sales.approveSurvey(db, r.user.id, id, b),
  );
  command("/projects/:id/quotes", ["admin", "sales"], undefined, (db, r, id) =>
    sales.issueQuote(db, r.user.id, id),
  );
  command(
    "/projects/:id/acceptance",
    ["admin", "sales"],
    undefined,
    (db, r, id) => sales.acceptQuote(db, r.user.id, id),
  );
  command(
    "/invoices/:id/payments",
    ["admin", "sales", "accounts"],
    C.Payment,
    (db, r, id, b) => sales.recordPayment(db, r.user.id, id, b),
  );
  command("/receipts", ["admin", "warehouse"], C.Receipt, (db, r, _id, b) =>
    stock.receiveStock(db, r.user.id, b),
  );
  command(
    "/orders/:id/reservations",
    ["admin", "warehouse"],
    undefined,
    (db, r, id) => stock.reserveStock(db, r.user.id, id),
  );
  command("/orders/:id/scans", ["admin", "warehouse"], C.Scan, (db, r, id, b) =>
    stock.scanAsset(db, r.user.id, id, b),
  );
  command(
    "/orders/:id/dispatch",
    ["admin", "warehouse"],
    undefined,
    (db, r, id) => stock.dispatchOrder(db, r.user.id, id),
  );
  command(
    "/orders/:id/delivery",
    ["admin", "warehouse"],
    undefined,
    (db, r, id) => stock.deliverOrder(db, r.user.id, id),
  );
  command("/jobs/:id/assignment", ["admin"], C.Assignment, (db, r, id, b) =>
    field.assignJob(db, r.user, id, b),
  );
  command("/jobs/:id/start", ["admin", "technician"], undefined, (db, r, id) =>
    field.startJob(db, r.user, id),
  );
  command(
    "/jobs/:id/completion",
    ["admin", "technician"],
    C.Completion,
    (db, r, id, b) => field.completeJob(db, r.user, id, b),
  );
  command(
    "/projects/:id/subsidy",
    ["admin", "sales", "accounts"],
    C.Subsidy,
    (db, r, id, b) => field.saveSubsidy(db, r.user, id, b),
  );
  command("/tickets", ["admin", "support"], C.Ticket, (db, r, _id, b) =>
    service.createTicket(db, r.user.id, b),
  );
  command(
    "/tickets/:id/resolution",
    ["admin", "support"],
    C.Resolution,
    (db, r, id, b) => service.resolveTicket(db, r.user.id, id, b),
  );
  command(
    "/tickets/:id/confirmation",
    ["admin", "support"],
    C.Confirmation,
    (db, r, id, b) => service.confirmTicket(db, r.user.id, id, b),
  );
  command(
    "/jobs/:id/pay",
    ["admin", "accounts"],
    C.Confirmation,
    async (db, r, id, b) => {
      const j = await one(db, "SELECT * FROM jobs WHERE id=$1 FOR UPDATE", [
        id,
      ]);
      ensure(
        j?.status === "completed",
        "Only completed jobs have a payable labour amount.",
      );
      const pay = await one(
        db,
        "INSERT INTO technician_payments(job_id,amount_minor,reference) VALUES($1,$2,$3) ON CONFLICT(job_id) DO NOTHING RETURNING *",
        [id, j.labour_cost_minor, b.confirmed_by],
      );
      await audit(db, r.user.id, "job", id, "labour.paid");
      return pay || { already_paid: true };
    },
  );
}
