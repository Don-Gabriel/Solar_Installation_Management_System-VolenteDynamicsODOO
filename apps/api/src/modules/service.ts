import { audit, ensure, one, type Db } from "../db.js";
export async function createTicket(db: Db, userId: string, b: any) {
  const w = await one(
    db,
    "SELECT w.*,o.project_id,(now()>=w.starts_at AND now()<w.expires_at) AS covered FROM warranties w JOIN order_lines l ON l.id=w.order_line_id JOIN orders o ON o.id=l.order_id WHERE w.id=$1",
    [b.warranty_id],
  );
  ensure(w, "Warranty or asset not found", 404);
  if (w.asset_id) {
    const a = await one(db, "SELECT status FROM assets WHERE id=$1", [
      w.asset_id,
    ]);
    ensure(
      a?.status === "delivered",
      "This device has been replaced. Open the ticket against its replacement serial.",
    );
  }
  const ticket = await one(
    db,
    "INSERT INTO tickets(warranty_id,complaint,fault_code,assigned_to,covered,coverage_reason) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [
      w.id,
      b.complaint,
      b.fault_code,
      b.assigned_to || null,
      w.covered,
      w.covered
        ? "Within delivery-based warranty at ticket opening."
        : "Outside delivery-based warranty at ticket opening.",
    ],
  );
  await audit(db, userId, "project", w.project_id, "ticket.opened", {
    number: ticket.number,
    covered: w.covered,
  });
  return ticket;
}
export async function resolveTicket(
  db: Db,
  userId: string,
  id: string,
  b: any,
) {
  const t = await one(
    db,
    "SELECT t.*,w.asset_id,w.order_line_id,l.order_id,l.product_id,o.project_id FROM tickets t JOIN warranties w ON w.id=t.warranty_id JOIN order_lines l ON l.id=w.order_line_id JOIN orders o ON o.id=l.order_id WHERE t.id=$1 FOR UPDATE OF t",
    [id],
  );
  ensure(t, "Ticket not found", 404);
  ensure(t.status === "open", "This ticket is already resolved.");
  let replacement = null;
  let partsCost = b.parts_cost_minor;
  if (b.replacement_serial) {
    ensure(t.asset_id, "Only serialized hardware can be replaced by serial.");
    const p = await one(db, "SELECT * FROM products WHERE id=$1 FOR UPDATE", [
      t.product_id,
    ]);
    ensure(
      p.stock_qty > p.reserved_qty,
      "No unreserved replacement stock is available.",
    );
    const original = await one(
      db,
      "SELECT * FROM assets WHERE id=$1 FOR UPDATE",
      [t.asset_id],
    );
    ensure(
      original.status === "delivered",
      "This device has already been replaced.",
    );
    const asset = await one(
      db,
      "SELECT * FROM assets WHERE serial=$1 FOR UPDATE",
      [b.replacement_serial.trim().toUpperCase()],
    );
    ensure(
      asset?.status === "available" && asset.product_id === t.product_id,
      "Replacement must be an available device of the same product.",
    );
    replacement = asset.id;
    partsCost = asset.cost_minor;
    await db.query(
      "UPDATE assets SET status='delivered',order_line_id=$2 WHERE id=$1",
      [asset.id, t.order_line_id],
    );
    await db.query("UPDATE assets SET status='replaced' WHERE id=$1", [
      t.asset_id,
    ]);
    await db.query(
      "UPDATE products SET stock_qty=stock_qty-1,stock_value_minor=stock_value_minor-$2 WHERE id=$1",
      [t.product_id, asset.cost_minor],
    );
    await db.query(
      "INSERT INTO stock_movements(product_id,order_id,quantity,value_minor) VALUES($1,$2,-1,$3)",
      [t.product_id, t.order_id, -asset.cost_minor],
    );
    // Explicit demo policy: replacements inherit the original warranty dates.
    await db.query(
      "INSERT INTO warranties(order_line_id,asset_id,quantity,starts_at,expires_at,policy_months) SELECT order_line_id,$2,1,starts_at,expires_at,policy_months FROM warranties WHERE id=$1",
      [t.warranty_id, asset.id],
    );
  }
  const charge = t.covered ? 0 : partsCost + b.labour_cost_minor;
  await db.query(
    "UPDATE tickets SET status='awaiting_confirmation',resolution=$2,parts_cost_minor=$3,labour_cost_minor=$4,customer_charge_minor=$5,replacement_asset_id=$6 WHERE id=$1",
    [id, b.resolution, partsCost, b.labour_cost_minor, charge, replacement],
  );
  if (charge) {
    const invoice = await one(
      db,
      "INSERT INTO invoices(order_id,ticket_id,kind,total_minor) VALUES($1,$2,'service',$3) RETURNING *",
      [t.order_id, id, charge],
    );
    await db.query(
      "INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor) VALUES($1,$2,1,$3),($1,$4,1,$5)",
      [
        invoice.id,
        "Repair parts",
        partsCost,
        "Service labour",
        b.labour_cost_minor,
      ],
    );
  }
  await audit(db, userId, "project", t.project_id, "ticket.resolved", {
    ticket_number: t.number,
    covered: t.covered,
    customer_charge_minor: charge,
    internal_cost_minor: partsCost + b.labour_cost_minor,
  });
  return { status: "awaiting_confirmation", customer_charge_minor: charge };
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
    "Resolve the ticket before recording customer confirmation.",
  );
  await db.query(
    "UPDATE tickets SET status='closed',confirmed_by=$2,confirmed_at=now() WHERE id=$1",
    [id, b.confirmed_by],
  );
  await audit(db, userId, "ticket", id, "customer.confirmed", {
    name: b.confirmed_by,
  });
  return { status: "closed" };
}
