import { audit, ensure, one, pool, type Db } from "../db.js";
import type { User } from "../../../../packages/contracts/src/index.js";

export async function createTicket(db: Db, userId: string, b: any) {
  let w: any = null;
  if (b.warranty_id) {
    w = await one(
      db,
      "SELECT w.*,o.project_id,(now()>=w.starts_at AND now()<w.expires_at) AS covered FROM warranties w JOIN order_lines l ON l.id=w.order_line_id JOIN orders o ON o.id=l.order_id WHERE w.id=$1",
      [b.warranty_id],
    );
    ensure(w, "Warranty or asset not found", 404);
    if (w.asset_id)
      ensure(
        (await one(db, "SELECT status FROM assets WHERE id=$1", [w.asset_id]))
          ?.status === "delivered",
        "This device has been replaced. Choose its replacement serial.",
      );
  }
  const parent = b.parent_ticket_id
    ? await one(db, "SELECT id,project_id FROM tickets WHERE id=$1", [
        b.parent_ticket_id,
      ])
    : null;
  if (b.parent_ticket_id) ensure(parent, "Original request not found", 404);
  const projectId = w?.project_id || b.project_id || parent?.project_id;
  if (parent)
    ensure(
      parent.project_id === projectId,
      "Follow-up must use the original customer installation.",
      400,
    );
  ensure(projectId, "Select a customer installation.", 400);
  if (w && b.project_id)
    ensure(
      w.project_id === b.project_id,
      "Device belongs to another site.",
      400,
    );
  ensure(
    await one(
      db,
      "SELECT id FROM orders WHERE project_id=$1 AND status='delivered'",
      [projectId],
    ),
    "Choose an installation whose equipment has been delivered.",
    400,
  );
  if (b.assigned_to) {
    ensure(
      ["admin", "coordinator"].includes(
        (await one(db, "SELECT role FROM users WHERE id=$1", [userId]))?.role,
      ),
      "Only a coordinator or administrator can assign workers.",
      403,
    );
    ensure(
      await one(
        db,
        "SELECT id FROM users WHERE id=$1 AND role='technician' AND active",
        [b.assigned_to],
      ),
      "Choose an active technician.",
      400,
    );
  }
  const t = await one(
    db,
    "INSERT INTO tickets(project_id,warranty_id,complaint,fault_code,assigned_to,covered,coverage_reason,priority,parent_ticket_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [
      projectId,
      w?.id || null,
      b.complaint.trim(),
      b.fault_code,
      b.assigned_to || null,
      w?.covered ?? null,
      w
        ? w.covered
          ? "Within delivery-based warranty at ticket opening."
          : "Outside delivery-based warranty at ticket opening."
        : "Pending component diagnosis",
      b.priority || "routine",
      parent?.id || null,
    ],
  );
  await audit(db, userId, "project", projectId, "ticket.opened", {
    number: t.number,
    priority: t.priority,
    parent_ticket_id: parent?.id || null,
  });
  return t;
}
export async function accessibleTicket(
  db: Pick<Db, "query">,
  user: User,
  id: string,
  lock = false,
) {
  const t = await one(
    db,
    "SELECT * FROM tickets WHERE id=$1" + (lock ? " FOR UPDATE" : ""),
    [id],
  );
  ensure(t, "Ticket not found", 404);
  if (user.role === "technician")
    ensure(
      t.assigned_to === user.id ||
        (await one(
          db,
          "SELECT 1 FROM visits v JOIN visit_crew c ON c.visit_id=v.id WHERE v.ticket_id=$1 AND c.user_id=$2 AND v.status<>'cancelled'",
          [id, user.id],
        )),
      "This repair is assigned to another technician.",
      403,
    );
  return t;
}
export async function ticketList(user?: User) {
  const rows = (
    await pool.query(
      `SELECT t.*,c.name AS customer_name,c.phone,s.address,p.number AS project_number,u.name AS technician_name FROM tickets t JOIN projects p ON p.id=t.project_id JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=t.assigned_to WHERE ($1::uuid IS NULL OR t.assigned_to=$1 OR EXISTS(SELECT 1 FROM visits v JOIN visit_crew vc ON vc.visit_id=v.id WHERE v.ticket_id=t.id AND vc.user_id=$1 AND v.status<>'cancelled')) ORDER BY CASE WHEN t.priority='urgent' THEN 0 ELSE 1 END,t.opened_at DESC`,
      [user?.role === "technician" ? user.id : null],
    )
  ).rows;
  if (user && !["admin", "accounts"].includes(user.role))
    for (const t of rows) {
      delete t.parts_cost_minor;
      delete t.labour_cost_minor;
    }
  return rows;
}
export async function detail(user: User, id: string) {
  const ticket = await accessibleTicket(pool, user, id);
  const history = (
    await pool.query(
      "SELECT id,number,status,complaint,opened_at,parent_ticket_id FROM tickets WHERE project_id=$1 AND id<>$2 ORDER BY opened_at DESC",
      [ticket.project_id, id],
    )
  ).rows;
  const project = await one(
    pool,
    "SELECT p.*,c.name AS customer_name,c.phone,s.address,o.id AS order_id FROM projects p JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id JOIN orders o ON o.project_id=p.id WHERE p.id=$1",
    [ticket.project_id],
  );
  const components = (
    await pool.query(
      `SELECT l.id AS order_line_id,l.quantity,l.description,l.kind,l.product_id,p.price_minor,a.id AS asset_id,a.serial,a.status AS asset_status,w.id AS warranty_id,w.starts_at,w.expires_at,(w.starts_at<=$2 AND w.expires_at>$2) AS covered FROM order_lines l JOIN products p ON p.id=l.product_id LEFT JOIN assets a ON a.order_line_id=l.id LEFT JOIN warranties w ON w.order_line_id=l.id AND (w.asset_id=a.id OR (w.asset_id IS NULL AND a.id IS NULL)) WHERE l.order_id=$1 AND l.kind<>'service' ORDER BY l.description,a.serial`,
      [project.order_id, ticket.opened_at],
    )
  ).rows;
  const lines = (
    await pool.query(
      "SELECT * FROM diagnosis_lines WHERE ticket_id=$1 ORDER BY description,id",
      [id],
    )
  ).rows;
  const visits = (
    await pool.query(
      "SELECT v.*,coalesce((SELECT json_agg(json_build_object('id',u.id,'name',u.name,'is_lead',c.is_lead)) FROM visit_crew c JOIN users u ON u.id=c.user_id WHERE c.visit_id=v.id),'[]') AS crew FROM visits v WHERE ticket_id=$1 ORDER BY starts_at DESC",
      [id],
    )
  ).rows;
  const evidence = (
    await pool.query(
      "SELECT id,kind,visit_id,diagnosis_revision,created_at FROM evidence WHERE ticket_id=$1 ORDER BY created_at",
      [id],
    )
  ).rows;
  const invoices = (
    await pool.query(
      "SELECT i.*,coalesce((SELECT json_agg(l ORDER BY l.id) FROM invoice_lines l WHERE l.invoice_id=i.id),'[]') AS lines,coalesce((SELECT sum(amount_minor) FROM payments WHERE invoice_id=i.id),0)::bigint AS paid_minor FROM invoices i WHERE ticket_id=$1",
      [id],
    )
  ).rows;
  const returns = (
    await pool.query(
      "SELECT r.*,a.serial AS original_serial,n.serial AS replacement_serial FROM service_returns r JOIN assets a ON a.id=r.asset_id JOIN assets n ON n.id=r.replacement_asset_id WHERE r.ticket_id=$1",
      [id],
    )
  ).rows;
  const events = (
    await pool.query(
      "SELECT e.*,u.name AS actor_name FROM ticket_events e JOIN users u ON u.id=e.actor_id WHERE ticket_id=$1 ORDER BY created_at",
      [id],
    )
  ).rows;
  const spares = (
    await pool.query(
      "SELECT a.serial,a.product_id,p.name FROM assets a JOIN products p ON p.id=a.product_id WHERE a.status='available' AND a.product_id IN(SELECT product_id FROM order_lines WHERE order_id=$1)",
      [project.order_id],
    )
  ).rows;
  if (!["admin", "accounts"].includes(user.role)) {
    delete ticket.parts_cost_minor;
    delete ticket.labour_cost_minor;
    for (const l of lines) {
      delete l.unit_cost_minor;
      delete l.labour_cost_minor;
    }
  }
  return {
    history,
    ticket,
    project,
    components,
    lines,
    visits,
    evidence,
    invoices,
    returns,
    events,
    spares,
  };
}
async function activeVisit(db: Db, user: User, t: any, lead = false) {
  const v = await one(
    db,
    "SELECT * FROM visits WHERE ticket_id=$1 AND status='in_progress' ORDER BY starts_at DESC LIMIT 1 FOR UPDATE",
    [t.id],
  );
  ensure(v, "Start the assigned repair visit first.");
  if (user.role === "technician")
    ensure(
      await one(
        db,
        `SELECT 1 FROM visit_crew WHERE visit_id=$1 AND user_id=$2 ${lead ? "AND is_lead" : ""}`,
        [v.id, user.id],
      ),
      lead
        ? "Only the assigned lead can complete this repair."
        : "You are not on this visit crew.",
      403,
    );
  return v;
}
export async function saveDiagnosis(db: Db, user: User, id: string, b: any) {
  const t = await accessibleTicket(db, user, id, true);
  ensure(
    !(await one(db, "SELECT id FROM invoices WHERE ticket_id=$1", [id])),
    "Issued work cannot be changed. Open a linked follow-up request.",
  );
  ensure(
    !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
    "Issued or closed work cannot be edited.",
  );
  ensure(t.version === b.version, "This repair changed. Reload before saving.");
  await activeVisit(db, user, t);
  const rate =
    (
      await one(db, "SELECT hourly_rate_minor FROM users WHERE id=$1", [
        t.assigned_to,
      ])
    )?.hourly_rate_minor || 35000;
  const previous = (
    await db.query(
      "SELECT * FROM diagnosis_lines WHERE ticket_id=$1 ORDER BY id",
      [id],
    )
  ).rows;
  const rows = [];
  const seen = new Set<string>();
  for (const line of b.lines) {
    const l = await one(
      db,
      "SELECT l.*,p.price_minor,p.stock_qty,p.stock_value_minor FROM order_lines l JOIN orders o ON o.id=l.order_id JOIN products p ON p.id=l.product_id WHERE l.id=$1 AND o.project_id=$2 AND l.kind<>'service'",
      [line.order_line_id, t.project_id],
    );
    ensure(l, "Component does not belong to this installation.", 400);
    const key = l.id + ":" + (line.asset_id || "");
    ensure(!seen.has(key), "Select a component only once.", 400);
    seen.add(key);
    let a = null;
    if (l.kind === "serialized") {
      a = await one(
        db,
        "SELECT * FROM assets WHERE id=$1 AND order_line_id=$2 AND status='delivered'",
        [line.asset_id || null, l.id],
      );
      ensure(a, "Select a currently installed serial from this site.", 400);
      ensure(line.quantity === 1, "A serialized device has quantity one.", 400);
    } else
      ensure(
        !line.asset_id && line.quantity <= l.quantity,
        "Quantity exceeds installed quantity.",
        400,
      );
    const w = await one(
      db,
      "SELECT * FROM warranties WHERE order_line_id=$1 AND (asset_id=$2 OR (asset_id IS NULL AND $2::uuid IS NULL))",
      [l.id, a?.id || null],
    );
    ensure(
      w ||
        l.warranty_months === 0 ||
        (line.coverage && line.coverage !== "auto"),
      "Warranty dates are missing. An authorized reviewer must record a coverage decision before this work can be billed.",
    );
    let covered =
        !!w &&
        new Date(w.starts_at) <= new Date(t.opened_at) &&
        new Date(w.expires_at) > new Date(t.opened_at),
      reason = w
        ? covered
          ? "Covered at complaint opening under delivery-based policy"
          : "Warranty expired at complaint opening"
        : "No warranty on this installed item";
    if (line.coverage && line.coverage !== "auto") {
      ensure(
        ["admin", "coordinator"].includes(user.role),
        "Only an authorized reviewer can change coverage.",
        403,
      );
      ensure(
        line.coverage_reason?.trim(),
        "Give the coverage decision reason.",
        400,
      );
      covered = line.coverage === "covered";
      reason += "; reviewer decision: " + line.coverage_reason;
    }
    let labourCovered = covered;
    if (line.labour_coverage && line.labour_coverage !== "auto") {
      ensure(
        ["admin", "coordinator"].includes(user.role),
        "Only an authorized reviewer can change labour coverage.",
        403,
      );
      ensure(
        line.coverage_reason?.trim(),
        "Give the coverage decision reason.",
        400,
      );
      labourCovered = line.labour_coverage === "covered";
      reason +=
        "; labour " + line.labour_coverage + ": " + line.coverage_reason;
    }
    let cost = 0,
      price = 0;
    if (line.action === "repair" && line.unit_cost_minor !== undefined) {
      ensure(
        ["admin", "coordinator", "accounts"].includes(user.role),
        "Only an authorized reviewer can record repair material cost.",
        403,
      );
      cost = line.unit_cost_minor;
    }
    if (line.action === "replace") {
      price = l.price_minor;
      if (a) {
        ensure(
          line.replacement_serial?.trim(),
          "Select the replacement serial.",
          400,
        );
        const replacement = await one(
          db,
          "SELECT * FROM assets WHERE serial=$1 AND product_id=$2 AND status='available'",
          [line.replacement_serial.trim().toUpperCase(), l.product_id],
        );
        ensure(
          replacement,
          "Replacement must be available and the same product.",
        );
        cost = replacement.cost_minor;
      } else
        cost = l.stock_qty ? Math.round(l.stock_value_minor / l.stock_qty) : 0;
    }
    if (line.unit_price_minor !== undefined) {
      ensure(
        ["admin", "coordinator", "accounts"].includes(user.role),
        "Only an authorized reviewer can set a selling price.",
        403,
      );
      price = line.unit_price_minor;
    }
    rows.push({
      line,
      l,
      a,
      w,
      covered,
      labourCovered,
      reason,
      cost,
      price,
      labourCost: Math.round((line.labour_minutes * rate) / 60),
    });
  }
  await db.query("DELETE FROM diagnosis_lines WHERE ticket_id=$1", [id]);
  for (const r of rows)
    await db.query(
      `INSERT INTO diagnosis_lines(ticket_id,order_line_id,asset_id,warranty_id,product_id,description,finding,quantity,action,replacement_serial,covered,coverage_reason,unit_price_minor,unit_cost_minor,labour_price_minor,labour_cost_minor,labour_minutes,labour_covered,coverage_override,labour_coverage_override,callout_price_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        id,
        r.l.id,
        r.a?.id || null,
        r.w?.id || null,
        r.l.product_id,
        r.l.description,
        r.line.finding,
        r.line.quantity,
        r.line.action,
        r.line.replacement_serial?.trim().toUpperCase() || null,
        r.covered,
        r.reason,
        r.price,
        r.cost,
        r.line.labour_price_minor,
        r.labourCost,
        r.line.labour_minutes,
        r.labourCovered,
        r.line.coverage || "auto",
        r.line.labour_coverage || "auto",
        r.line.callout_price_minor || 0,
      ],
    );
  await db.query(
    "UPDATE tickets SET status='diagnosed',diagnosis_revision=diagnosis_revision+1,estimate_status='draft',approved_by=NULL,customer_approval=NULL,version=version+1 WHERE id=$1",
    [id],
  );
  await audit(db, user.id, "project", t.project_id, "repair.diagnosed", {
    ticket_id: id,
    before: previous,
    after: rows.map((r) => ({
      component: r.l.id,
      asset: r.a?.id,
      quantity: r.line.quantity,
      covered: r.covered,
      labour_covered: r.labourCovered,
      reason: r.reason,
      price_minor: r.price,
      labour_price_minor: r.line.labour_price_minor,
      callout_price_minor: r.line.callout_price_minor || 0,
      finding: r.line.finding,
    })),
    revision: t.version + 1,
  });
  return { saved: true };
}
export async function approveEstimate(db: Db, user: User, id: string, b: any) {
  const t = await accessibleTicket(db, user, id, true);
  ensure(
    t.status === "diagnosed" && t.version === b.version,
    "Diagnosis changed or is not ready. Reload and review.",
  );
  const lines = (
    await db.query("SELECT * FROM diagnosis_lines WHERE ticket_id=$1", [id])
  ).rows;
  ensure(lines.length, "Select the faulty components first.");
  const payable = lines.reduce(
    (s, l) =>
      s +
      (l.covered ? 0 : l.unit_price_minor * l.quantity) +
      (l.labour_covered ? 0 : l.labour_price_minor + l.callout_price_minor),
    0,
  );
  ensure(
    Number.isSafeInteger(payable) && payable <= 1000000000000,
    "Estimate exceeds the supported monetary limit.",
    400,
  );
  ensure(
    b.confirmed_by?.trim(),
    "Record customer approval or covered-work review.",
    400,
  );
  await db.query(
    "UPDATE tickets SET estimate_status='approved',approved_by=$2,customer_approval=$3,version=version+1 WHERE id=$1",
    [id, user.id, b.confirmed_by],
  );
  await audit(
    db,
    user.id,
    "project",
    t.project_id,
    "repair.estimate_approved",
    {
      ticket_id: id,
      customer_approval: b.confirmed_by,
      payable_minor: payable,
    },
  );
  return { approved: true, payable_minor: payable };
}
export async function resolveTicket(
  db: Db,
  userOrId: User | string,
  id: string,
  b: any,
) {
  const user =
    typeof userOrId === "string"
      ? await one(db, "SELECT id,role,name FROM users WHERE id=$1", [userOrId])
      : userOrId;
  const t = await accessibleTicket(db, user, id, true);
  ensure(
    ["admin", "technician"].includes(user.role),
    "Only the assigned technician or administrator can complete physical repair.",
    403,
  );
  if (["awaiting_confirmation", "closed"].includes(t.status))
    return { status: t.status, customer_charge_minor: t.customer_charge_minor };
  const visit = await activeVisit(db, user, t, true);
  ensure(
    await one(
      db,
      "SELECT id FROM evidence WHERE ticket_id=$1 AND visit_id=$2 AND kind='photo' AND diagnosis_revision=$3",
      [id, visit.id, t.diagnosis_revision],
    ),
    "Save an after-repair photo for the current diagnosis before completing this visit.",
  );
  ensure(
    t.estimate_status === "approved",
    "Review the diagnosis and record approval before completion.",
  );
  if (b.version !== undefined)
    ensure(
      t.version === b.version,
      "This repair changed. Reload before completion.",
    );
  const lines = (
    await db.query(
      "SELECT * FROM diagnosis_lines WHERE ticket_id=$1 ORDER BY product_id,id FOR UPDATE",
      [id],
    )
  ).rows;
  ensure(lines.length, "Select the faulty components first.");
  let partsCost = 0,
    labourCost = 0,
    total = 0;
  const order = await one(db, "SELECT id FROM orders WHERE project_id=$1", [
    t.project_id,
  ]);
  const invoice = await one(
    db,
    "INSERT INTO invoices(order_id,ticket_id,kind,total_minor) VALUES($1,$2,'service',0) RETURNING *",
    [order.id, id],
  );
  for (const l of lines) {
    let replacement: any = null,
      original: any = null;
    if (l.action === "replace") {
      const p = await one(db, "SELECT * FROM products WHERE id=$1 FOR UPDATE", [
        l.product_id,
      ]);
      ensure(
        p.stock_qty - p.reserved_qty >= l.quantity,
        "Insufficient unreserved replacement stock.",
      );
      if (l.asset_id) {
        original = await one(
          db,
          "SELECT * FROM assets WHERE id=$1 FOR UPDATE",
          [l.asset_id],
        );
        ensure(
          original.status === "delivered",
          "The original device has already been replaced.",
        );
        replacement = await one(
          db,
          "SELECT * FROM assets WHERE serial=$1 FOR UPDATE",
          [l.replacement_serial],
        );
        ensure(
          replacement?.status === "available" &&
            replacement.product_id === l.product_id,
          "Replacement is no longer available. Review the diagnosis again.",
        );
        l.unit_cost_minor = replacement.cost_minor;
        await db.query("UPDATE assets SET status='replaced' WHERE id=$1", [
          original.id,
        ]);
        await db.query(
          "UPDATE assets SET status='delivered',order_line_id=$2 WHERE id=$1",
          [replacement.id, l.order_line_id],
        );
        await db.query(
          "INSERT INTO warranties(order_line_id,asset_id,quantity,starts_at,expires_at,policy_months) SELECT order_line_id,$2,1,starts_at,expires_at,policy_months FROM warranties WHERE id=$1",
          [l.warranty_id, replacement.id],
        );
        await db.query(
          "INSERT INTO service_returns(ticket_id,asset_id,replacement_asset_id) VALUES($1,$2,$3)",
          [id, original.id, replacement.id],
        );
        await db.query(
          "UPDATE diagnosis_lines SET replacement_asset_id=$2,unit_cost_minor=$3 WHERE id=$1",
          [l.id, replacement.id, l.unit_cost_minor],
        );
      } else {
        l.unit_cost_minor = p.stock_qty
          ? Math.round(p.stock_value_minor / p.stock_qty)
          : 0;
        await db.query(
          "UPDATE diagnosis_lines SET unit_cost_minor=$2 WHERE id=$1",
          [l.id, l.unit_cost_minor],
        );
      }
      await db.query(
        "UPDATE products SET stock_qty=stock_qty-$2,stock_value_minor=stock_value_minor-$3 WHERE id=$1",
        [l.product_id, l.quantity, l.unit_cost_minor * l.quantity],
      );
      await db.query(
        "INSERT INTO stock_movements(product_id,order_id,quantity,value_minor) VALUES($1,$2,$3,$4)",
        [l.product_id, order.id, -l.quantity, -l.unit_cost_minor * l.quantity],
      );
    }
    const net = l.covered ? 0 : l.unit_price_minor,
      labourNet = l.labour_covered ? 0 : l.labour_price_minor;
    await db.query(
      "INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,gross_unit_price_minor,warranty_credit_minor,coverage_reason,original_serial,replacement_serial) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        invoice.id,
        l.description + " — " + l.action,
        l.quantity,
        net,
        l.unit_price_minor,
        l.covered ? l.unit_price_minor : 0,
        l.coverage_reason,
        original?.serial || null,
        replacement?.serial || null,
      ],
    );
    await db.query(
      "INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,gross_unit_price_minor,warranty_credit_minor,coverage_reason) VALUES($1,$2,1,$3,$4,$5,$6)",
      [
        invoice.id,
        "Labour — " + l.description,
        labourNet,
        l.labour_price_minor,
        l.labour_covered ? l.labour_price_minor : 0,
        l.coverage_reason,
      ],
    );
    partsCost += l.unit_cost_minor * l.quantity;
    labourCost += l.labour_cost_minor;
    const calloutNet = l.labour_covered ? 0 : l.callout_price_minor;
    if (l.callout_price_minor > 0)
      await db.query(
        "INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,gross_unit_price_minor,warranty_credit_minor,coverage_reason) VALUES($1,$2,1,$3,$4,$5,$6)",
        [
          invoice.id,
          "Callout — " + l.description,
          calloutNet,
          l.callout_price_minor,
          l.labour_covered ? l.callout_price_minor : 0,
          l.coverage_reason,
        ],
      );
    total += net * l.quantity + labourNet + calloutNet;
  }
  ensure(
    [total, partsCost, labourCost].every(
      (n) => Number.isSafeInteger(n) && n <= 1000000000000,
    ),
    "Repair total exceeds the supported monetary limit.",
    400,
  );
  await db.query("UPDATE invoices SET total_minor=$2 WHERE id=$1", [
    invoice.id,
    total,
  ]);
  await db.query(
    "UPDATE tickets SET status='awaiting_confirmation',resolution=$2,parts_cost_minor=$3,labour_cost_minor=$4,customer_charge_minor=$5,covered=$6,version=version+1,replacement_asset_id=(SELECT replacement_asset_id FROM diagnosis_lines WHERE ticket_id=$1 AND replacement_asset_id IS NOT NULL ORDER BY id LIMIT 1) WHERE id=$1",
    [
      id,
      b.resolution,
      partsCost,
      labourCost,
      total,
      lines.every((l) => l.covered && l.labour_covered),
    ],
  );
  await db.query(
    "UPDATE visits SET status='completed',completed_at=now(),version=version+1 WHERE id=$1",
    [visit.id],
  );
  await audit(db, user.id, "project", t.project_id, "ticket.resolved", {
    ticket_id: id,
    invoice_id: invoice.id,
    customer_charge_minor: total,
    internal_cost_minor: partsCost + labourCost,
  });
  return {
    status: "awaiting_confirmation",
    customer_charge_minor: total,
    invoice_id: invoice.id,
  };
}
export async function confirmTicket(
  db: Db,
  userId: string,
  id: string,
  b: any,
) {
  const t = await one(db, "SELECT * FROM tickets WHERE id=$1 FOR UPDATE", [id]);
  ensure(t, "Ticket not found", 404);
  if (t.status === "closed") return t;
  ensure(
    t.status === "awaiting_confirmation",
    "Complete the repair before recording customer confirmation.",
  );
  await db.query(
    "UPDATE tickets SET status='closed',confirmed_by=$2,confirmed_at=now(),version=version+1 WHERE id=$1",
    [id, b.confirmed_by],
  );
  await audit(db, userId, "project", t.project_id, "customer.confirmed", {
    ticket_id: id,
    name: b.confirmed_by,
    method: "recorded_by_staff",
  });
  return { status: "closed" };
}
export async function noteTicket(db: Db, user: User, id: string, b: any) {
  const t = await accessibleTicket(db, user, id, true);
  ensure(t.version === b.version, "This request changed. Reload first.");
  if (b.action === "cancel") {
    ensure(
      !["closed", "awaiting_confirmation"].includes(t.status),
      "Issued or closed work needs a reviewed correction.",
    );
    await db.query(
      "UPDATE tickets SET status='cancelled',version=version+1 WHERE id=$1",
      [id],
    );
    await db.query(
      "UPDATE visits SET status='cancelled',reason=$2,version=version+1 WHERE ticket_id=$1 AND status IN ('scheduled','in_progress')",
      [id, b.note],
    );
  } else if (b.action === "dispute") {
    ensure(
      ["awaiting_confirmation", "diagnosed"].includes(t.status),
      "Only a reviewed diagnosis or completed work can be disputed.",
    );
    await db.query(
      "UPDATE tickets SET status='disputed',estimate_status='draft',approved_by=NULL,customer_approval=NULL,version=version+1 WHERE id=$1",
      [id],
    );
  } else
    await db.query("UPDATE tickets SET version=version+1 WHERE id=$1", [id]);
  await db.query(
    "INSERT INTO ticket_events(ticket_id,actor_id,note) VALUES($1,$2,$3)",
    [id, user.id, b.note],
  );
  await audit(db, user.id, "project", t.project_id, "ticket." + b.action, {
    ticket_id: id,
    note: b.note,
  });
  return { saved: true };
}
