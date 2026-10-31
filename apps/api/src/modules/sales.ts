import { openTask } from "./operational-tasks.js";
import { audit, ensure, one, type Db } from "../db.js";
import type { EnquiryInput } from "../../../../packages/contracts/src/index.js";
export async function createEnquiry(
  db: Db,
  userId: string | null,
  body: EnquiryInput,
) {
  ensure(
    userId || (!body.customer_id && !body.site_id),
    "Existing records require staff access.",
    403,
  );
  const customer = body.customer_id
    ? await one(
        db,
        "SELECT * FROM customers WHERE id=$1 AND merged_into IS NULL FOR UPDATE",
        [body.customer_id],
      )
    : await one(
        db,
        "INSERT INTO customers(name,phone,billing_address) VALUES($1,$2,$3) RETURNING *",
        [body.name.trim(), body.phone.trim(), body.billing_address || ""],
      );
  ensure(customer, "Customer not found", 404);
  const site = body.site_id
    ? await one(db, "SELECT * FROM sites WHERE id=$1 AND customer_id=$2", [
        body.site_id,
        customer.id,
      ])
    : await one(
        db,
        "INSERT INTO sites(customer_id,address,access_notes) VALUES($1,$2,$3) RETURNING *",
        [customer.id, body.address.trim(), body.access_notes || ""],
      );
  ensure(site, "Site does not belong to the selected customer.", 404);
  const project = await one(
    db,
    `INSERT INTO projects(site_id,capacity_kw,system_type,source,notes,subsidy_interest,owner_id,follow_up) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      site.id,
      body.capacity_kw,
      body.system_type,
      body.source,
      body.notes || "",
      body.subsidy_interest,
      body.owner_id || userId,
      body.follow_up || null,
    ],
  );
  await db.query(
    "UPDATE projects SET preferred_date=$2,preferred_window=$3,hazard_notes=$4 WHERE id=$1",
    [
      project.id,
      body.preferred_date || null,
      body.preferred_window || "any",
      body.hazard_notes || "",
    ],
  );
  if (userId && body.hazard_notes)
    await openTask(
      db,
      userId,
      project.id,
      "hazard",
      "Customer reported hazard; coordinator must arrange qualified review: " +
        body.hazard_notes,
    );
  if (body.subsidy_interest)
    await db.query("INSERT INTO subsidies(project_id,owner_id) VALUES($1,$2)", [
      project.id,
      userId,
    ]);
  if (userId) await audit(db, userId, "project", project.id, "enquiry.created");
  return project;
}
export async function saveSurvey(db: Db, userId: string, id: string, b: any) {
  const p = await one(db, "SELECT * FROM projects WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(p, "Project not found", 404);
  ensure(!p.cancelled_at, "This enquiry was cancelled.");
  ensure(
    ["enquiry", "survey", "quoted"].includes(p.stage),
    "An accepted order cannot be resurveyed in this workflow.",
  );
  if (b.capacity_kw)
    await db.query("UPDATE projects SET capacity_kw=$2 WHERE id=$1", [
      id,
      b.capacity_kw,
    ]);
  const survey = await one(
    db,
    `INSERT INTO surveys(project_id,roof_area,bill_minor,grid_suitable,direction,tilt,cable_distance,notes,status,surveyed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9) RETURNING *`,
    [
      id,
      b.roof_area,
      b.bill_minor,
      b.grid_suitable,
      b.direction,
      b.tilt,
      b.cable_distance,
      b.notes || "",
      userId,
    ],
  );
  await db.query("UPDATE projects SET stage='survey' WHERE id=$1", [id]);
  await audit(db, userId, "project", id, "survey.recorded");
  return survey;
}
export async function approveSurvey(
  db: Db,
  userId: string,
  id: string,
  b: any,
) {
  const project = await one(
    db,
    "SELECT * FROM projects WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(project, "Project not found", 404);
  ensure(!project.cancelled_at, "This enquiry was cancelled.");
  ensure(
    ["enquiry", "survey", "quoted"].includes(project.stage),
    "Order already accepted.",
  );
  const survey = await one(
    db,
    "SELECT * FROM surveys WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",
    [id],
  );
  ensure(survey, "Record a site survey first.");
  ensure(
    survey.status === "pending",
    "Survey already reviewed. Record a new survey to change the decision.",
  );
  if (b.approved) {
    ensure(
      project.capacity_kw,
      "Record the surveyed system capacity before approval.",
    );
    ensure(
      Number(survey.roof_area) >= project.capacity_kw * 8,
      "Usable roof area must be at least 8 m² per kW under the demo qualification policy.",
    );
    ensure(
      project.system_type !== "on_grid" || survey.grid_suitable,
      "On-grid installation needs a suitable grid connection.",
    );
  }
  await db.query("UPDATE surveys SET status=$2,approved_by=$3 WHERE id=$1", [
    survey.id,
    b.approved ? "approved" : "rejected",
    userId,
  ]);
  await audit(
    db,
    userId,
    "project",
    id,
    b.approved ? "survey.approved" : "survey.rejected",
  );
  return { id: survey.id, status: b.approved ? "approved" : "rejected" };
}
export async function issueQuote(db: Db, userId: string, id: string) {
  const p = await one(db, "SELECT * FROM projects WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(p, "Project not found", 404);
  ensure(!p.cancelled_at, "This enquiry was cancelled.");
  ensure(
    !(await one(db, "SELECT id FROM orders WHERE project_id=$1", [id])),
    "An accepted quotation cannot be replaced.",
  );
  const survey = await one(
    db,
    "SELECT * FROM surveys WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",
    [id],
  );
  ensure(
    survey?.status === "approved",
    "Approve the latest site survey before issuing a quotation.",
  );
  const recipe = await one(
    db,
    "SELECT * FROM packages WHERE system_type=$1 AND capacity_kw=$2 ORDER BY version DESC LIMIT 1",
    [p.system_type, p.capacity_kw],
  );
  ensure(recipe, "No package recipe configured.");
  const lines = (
    await db.query(
      p.parent_project_id
        ? "SELECT p.*,l.quantity FROM change_order_lines l JOIN products p ON p.id=l.product_id WHERE l.project_id=$1 ORDER BY p.sku"
        : "SELECT p.*,l.quantity FROM package_lines l JOIN products p ON p.id=l.product_id WHERE l.package_id=$1 ORDER BY p.sku",
      [p.parent_project_id ? p.id : recipe.id],
    )
  ).rows;
  ensure(lines.length, "The package has no bill of materials.");
  const total = lines.reduce((sum, l) => sum + l.price_minor * l.quantity, 0);
  const q = await one(
    db,
    `INSERT INTO quotes(project_id,package_id,survey_id,version,total_minor) SELECT $1,$2,$3,coalesce(max(version),0)+1,$4 FROM quotes WHERE project_id=$1 RETURNING *`,
    [id, recipe.id, survey.id, total],
  );
  for (const l of lines)
    await db.query(
      "INSERT INTO quote_lines(quote_id,product_id,description,kind,quantity,unit_price_minor,warranty_months) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        q.id,
        l.id,
        l.name,
        l.kind,
        l.quantity,
        l.price_minor,
        l.warranty_months,
      ],
    );
  await db.query("UPDATE projects SET stage='quoted' WHERE id=$1", [id]);
  await audit(db, userId, "project", id, "quote.issued", {
    version: q.version,
    total_minor: total,
  });
  return q;
}
export async function acceptQuote(
  db: Db,
  userId: string,
  id: string,
  b: any = {},
) {
  const p = await one(db, "SELECT * FROM projects WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(p, "Project not found", 404);
  ensure(!p.cancelled_at, "This enquiry was cancelled.");
  const existing = await one(db, "SELECT * FROM orders WHERE project_id=$1", [
    id,
  ]);
  if (existing) {
    ensure(
      !b.quote_id || existing.quote_id === b.quote_id,
      "A different quotation has already been accepted.",
    );
    return existing;
  }
  const quote = await one(
    db,
    "SELECT * FROM quotes WHERE project_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE",
    [id],
  );
  ensure(quote, "Issue a quotation first.");
  ensure(
    !b.quote_id || b.quote_id === quote.id,
    "A newer quotation is available. Review it before acceptance.",
  );
  ensure(
    new Date(quote.expires_at).getTime() > Date.now(),
    "Quotation expired. Issue and review a renewed quotation.",
  );
  const survey = await one(
    db,
    "SELECT * FROM surveys WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",
    [id],
  );
  ensure(
    survey?.status === "approved" && survey.id === quote.survey_id,
    "The quotation must reference the latest approved survey.",
  );
  const { value: policy } = await one(
    db,
    "SELECT value FROM settings WHERE key='policy'",
  );
  const order = await one(
    db,
    "INSERT INTO orders(project_id,quote_id,total_minor,minimum_advance_minor) VALUES($1,$2,$3,$4) RETURNING *",
    [
      id,
      quote.id,
      quote.total_minor,
      Math.ceil((quote.total_minor * policy.advance_percent) / 100),
    ],
  );
  await db.query(
    "INSERT INTO order_lines(order_id,quote_line_id,product_id,description,kind,quantity,unit_price_minor,warranty_months) SELECT $1,id,product_id,description,kind,quantity,unit_price_minor,warranty_months FROM quote_lines WHERE quote_id=$2",
    [order.id, quote.id],
  );
  const invoice = await one(
    db,
    "INSERT INTO invoices(order_id,kind,total_minor) VALUES($1,'installation',$2) RETURNING *",
    [order.id, quote.total_minor],
  );
  await db.query(
    "INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor) SELECT $1,description,quantity,unit_price_minor FROM quote_lines WHERE quote_id=$2",
    [invoice.id, quote.id],
  );
  await db.query("UPDATE quotes SET status='accepted' WHERE id=$1", [quote.id]);
  await db.query("INSERT INTO jobs(order_id) VALUES($1)", [order.id]);
  await db.query("UPDATE projects SET stage='confirmed' WHERE id=$1", [id]);
  await audit(db, userId, "project", id, "order.confirmed", {
    order_id: order.id,
  });
  return order;
}
export async function recordPayment(
  db: Db,
  userId: string,
  id: string,
  b: any,
) {
  const invoice = await one(
    db,
    "SELECT * FROM invoices WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(invoice, "Invoice not found", 404);
  const duplicate = await one(
    db,
    "SELECT * FROM payments WHERE invoice_id=$1 AND reference=$2",
    [id, b.reference],
  );
  if (duplicate) {
    ensure(
      duplicate.amount_minor === b.amount_minor &&
        duplicate.method === b.method,
      "This payment reference already has different details.",
    );
    return duplicate;
  }
  const paid = await one(
    db,
    "SELECT paid_minor AS total,net_total_minor FROM invoice_balances WHERE id=$1",
    [id],
  );
  ensure(
    b.amount_minor <= paid.net_total_minor - paid.total,
    "Payment exceeds the outstanding invoice balance.",
  );
  const payment = await one(
    db,
    "INSERT INTO payments(invoice_id,amount_minor,method,reference,created_by,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [id, b.amount_minor, b.method, b.reference, userId, b.status || "verified"],
  );
  const order = await one(db, "SELECT project_id FROM orders WHERE id=$1", [
    invoice.order_id,
  ]);
  await audit(db, userId, "project", order.project_id, "payment.recorded", {
    amount_minor: b.amount_minor,
    reference: b.reference,
  });
  return payment;
}
