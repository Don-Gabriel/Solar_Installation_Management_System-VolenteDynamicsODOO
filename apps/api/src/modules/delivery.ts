import { one, ensure, audit, type Db } from "../db.js";
import { openTask } from "./operational-tasks.js";
export async function incident(db: Db, actor: string, id: string, b: any) {
  const o = await one(db, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id]);
  ensure(o, "Order not found", 404);
  ensure(
    o.status === "dispatched",
    "Only an undelivered shipment can have a delivery incident.",
  );
  const r = await one(
    db,
    "INSERT INTO delivery_incidents(order_id,kind,custody,reason,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [id, b.kind, b.custody, b.reason, actor],
  );
  await openTask(
    db,
    actor,
    o.project_id,
    "reschedule",
    `Delivery ${b.kind}: ${b.reason}. Current custody: ${b.custody}. Arrange return or verified retry.`,
  );
  await openTask(
    db,
    actor,
    o.project_id,
    "customer_contact",
    "Contact customer about failed delivery and agree next steps.",
  );
  await audit(
    db,
    actor,
    "project",
    o.project_id,
    "delivery.incident_recorded",
    { ...r },
  );
  return r;
}
export async function review(db: Db, actor: string, id: string, b: any) {
  const peek = await one(
    db,
    "SELECT order_id FROM delivery_incidents WHERE id=$1",
    [id],
  );
  ensure(peek, "Incident not found", 404);
  const o = await one(db, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
    peek.order_id,
  ]);
  const r = await one(
    db,
    "SELECT * FROM delivery_incidents WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(
    r.version === b.version && ["open", "returned"].includes(r.status),
    "Incident changed. Reload first.",
  );
  if (r.kind === "transit_damage" && b.status === "retry")
    ensure(
      r.status === "returned" &&
        (await one(
          db,
          "SELECT id FROM delivery_replacements WHERE incident_id=$1",
          [id],
        )),
      "Return damaged devices and record replacements before approving another delivery.",
    );
  await db.query(
    "UPDATE delivery_incidents SET status=$2,custody=$3,outcome=$4,reviewed_by=$5,reviewed_at=now(),version=version+1 WHERE id=$1",
    [id, b.status, b.custody, b.outcome, actor],
  );
  await audit(
    db,
    actor,
    "project",
    o.project_id,
    "delivery.incident_reviewed",
    { incident_id: id, ...b },
  );
  return { id, status: b.status };
}
export async function receiveLines(
  db: Db,
  actor: string,
  id: string,
  b: any = {},
) {
  const o = await one(db, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id]);
  ensure(o, "Order not found", 404);
  if (o.status === "delivered") return o;
  ensure(
    o.status === "dispatched",
    "Dispatch the order before recording delivery.",
  );
  ensure(
    !(await one(
      db,
      "SELECT id FROM delivery_incidents WHERE order_id=$1 AND status IN ('open','returned')",
      [id],
    )),
    "Resolve the delivery incident before confirming receipt. Returned goods cannot be marked delivered.",
  );
  const lines = (
    await db.query(
      "SELECT * FROM order_lines WHERE order_id=$1 AND kind<>'service' ORDER BY id",
      [id],
    )
  ).rows;
  const wanted =
    b.line_ids || lines.filter((l) => !l.delivered_at).map((l) => l.id);
  ensure(
    wanted.length > 0 &&
      wanted.every((lineId: string) => lines.some((l) => l.id === lineId)),
    "Choose lines from this shipment.",
    400,
  );
  const now = (await one(db, "SELECT now() AS at")).at;
  for (const l of lines.filter(
    (l) => wanted.includes(l.id) && !l.delivered_at,
  )) {
    const assets = (
      await db.query(
        "SELECT * FROM assets WHERE order_line_id=$1 AND status='dispatched' ORDER BY id FOR UPDATE",
        [l.id],
      )
    ).rows;
    ensure(
      l.kind !== "serialized" || assets.length === l.quantity,
      "The dispatched serial count does not match this line.",
    );
    if (l.warranty_months > 0)
      for (const a of assets.length ? assets : [{ id: null }])
        await db.query(
          "INSERT INTO warranties(order_line_id,asset_id,quantity,starts_at,expires_at,policy_months) VALUES($1,$2,$3,$4,$4::timestamptz+make_interval(months=>$5),$5)",
          [l.id, a.id, a.id ? 1 : l.quantity, now, l.warranty_months],
        );
    await db.query("UPDATE order_lines SET delivered_at=$2 WHERE id=$1", [
      l.id,
      now,
    ]);
    await db.query(
      "UPDATE assets SET status='delivered' WHERE order_line_id=$1 AND status='dispatched'",
      [l.id],
    );
  }
  const remaining = await one(
    db,
    "SELECT count(*)::int AS n FROM order_lines WHERE order_id=$1 AND kind<>'service' AND delivered_at IS NULL",
    [id],
  );
  if (!remaining.n) {
    await db.query(
      "UPDATE orders SET status='delivered',delivered_at=$2 WHERE id=$1",
      [id, now],
    );
    await db.query("UPDATE projects SET stage='delivered' WHERE id=$1", [
      o.project_id,
    ]);
  }
  await audit(db, actor, "project", o.project_id, "delivery.confirmed", {
    line_ids: wanted,
    receiver: b.received_by || "Recorded by authorized warehouse staff",
    warranty_started_at: now,
    remaining_lines: remaining.n,
  });
  return await one(db, "SELECT * FROM orders WHERE id=$1", [id]);
}

export async function replaceTransit(
  db: Db,
  actor: string,
  id: string,
  b: any,
) {
  const peek = await one(
    db,
    "SELECT order_id FROM delivery_incidents WHERE id=$1",
    [id],
  );
  ensure(peek, "Incident not found", 404);
  const o = await one(db, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
    peek.order_id,
  ]);
  const r = await one(
    db,
    "SELECT * FROM delivery_incidents WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(
    o.status === "dispatched" &&
      r.kind === "transit_damage" &&
      r.status === "returned",
    "Record the damaged shipment return first.",
  );
  const a = await one(
    db,
    "SELECT a.* FROM assets a JOIN order_lines l ON l.id=a.order_line_id WHERE a.id=$1 AND l.order_id=$2 AND a.status='dispatched'",
    [b.asset_id, o.id],
  );
  ensure(a, "Choose an undelivered serial from this shipment.");
  const p = await one(db, "SELECT * FROM products WHERE id=$1 FOR UPDATE", [
    a.product_id,
  ]);
  ensure(p.stock_qty > p.reserved_qty, "No unreserved replacement stock.");
  const replacement = await one(
    db,
    "SELECT * FROM assets WHERE serial=$1 AND product_id=$2 AND status='available' FOR UPDATE",
    [b.replacement_serial.trim().toUpperCase(), a.product_id],
  );
  ensure(replacement, "Choose an available serial of the same model.");
  await db.query(
    "UPDATE assets SET status='quarantined',order_line_id=NULL WHERE id=$1",
    [a.id],
  );
  await db.query(
    "UPDATE assets SET status='dispatched',order_line_id=$2 WHERE id=$1",
    [replacement.id, a.order_line_id],
  );
  await db.query(
    "UPDATE products SET stock_qty=stock_qty-1,stock_value_minor=stock_value_minor-$2 WHERE id=$1",
    [p.id, replacement.cost_minor],
  );
  await db.query(
    "UPDATE order_lines SET material_cost_minor=material_cost_minor+$2 WHERE id=$1",
    [a.order_line_id, replacement.cost_minor],
  );
  await db.query(
    "INSERT INTO stock_movements(product_id,order_id,quantity,value_minor) VALUES($1,$2,-1,$3)",
    [p.id, o.id, -replacement.cost_minor],
  );
  const result = await one(
    db,
    "INSERT INTO delivery_replacements(incident_id,original_asset_id,replacement_asset_id,note,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [id, a.id, replacement.id, b.note, actor],
  );
  await audit(
    db,
    actor,
    "project",
    o.project_id,
    "delivery.damaged_serial_replaced",
    {
      ...result,
      original_serial: a.serial,
      replacement_serial: replacement.serial,
    },
  );
  return result;
}
