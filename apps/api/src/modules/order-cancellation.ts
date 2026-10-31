import { one, ensure, audit, type Db } from "../db.js";
import { requestCorrection, reviewCorrection } from "./finance.js";
export async function request(db: Db, actor: string, id: string, b: any) {
  const o = await one(db, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id]);
  ensure(o, "Order not found", 404);
  ensure(
    o.status === "packing",
    "Cancellation is available before dispatch; use delivery returns after shipment.",
  );
  const r = await one(
    db,
    "INSERT INTO order_cancellations(order_id,reason,requested_by) VALUES($1,$2,$3) RETURNING *",
    [id, b.reason, actor],
  );
  await audit(
    db,
    actor,
    "project",
    o.project_id,
    "order.cancellation_requested",
    { ...r },
  );
  return r;
}
export async function review(db: Db, actor: string, id: string, b: any) {
  await db.query("SELECT pg_advisory_xact_lock(902636)");
  const peek = await one(
    db,
    "SELECT order_id FROM order_cancellations WHERE id=$1",
    [id],
  );
  ensure(peek, "Cancellation not found", 404);
  const o = await one(db, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
    peek.order_id,
  ]);
  const c = await one(
    db,
    "SELECT * FROM order_cancellations WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(c.status === "pending", "Cancellation already reviewed.");
  ensure(
    c.requested_by !== actor,
    "Another accounts officer or administrator must review this cancellation.",
    403,
  );
  if (b.approved) {
    ensure(
      o.status === "packing",
      "Order already left the warehouse; use a delivery return.",
    );
    const invoice = await one(
      db,
      "SELECT * FROM invoice_balances WHERE order_id=$1 AND kind='installation'",
      [o.id],
    );
    if (invoice.net_total_minor > 0) {
      const credit = await requestCorrection(db, c.requested_by, invoice.id, {
        reason: "Order cancellation: " + c.reason,
        credit_minor: invoice.net_total_minor,
      });
      await reviewCorrection(db, actor, credit.id, {
        approved: true,
        note: b.note,
      });
    }
    const lines = (
      await db.query(
        "SELECT * FROM order_lines WHERE order_id=$1 ORDER BY product_id",
        [o.id],
      )
    ).rows;
    for (const l of lines) {
      if (l.reserved) {
        await db.query(
          "UPDATE products SET reserved_qty=reserved_qty-$2 WHERE id=$1",
          [l.product_id, l.quantity],
        );
        await db.query("UPDATE order_lines SET reserved=false WHERE id=$1", [
          l.id,
        ]);
      }
      await db.query(
        "UPDATE assets SET status='available',order_line_id=NULL WHERE order_line_id=$1 AND status='allocated'",
        [l.id],
      );
    }
    await db.query("UPDATE orders SET status='cancelled' WHERE id=$1", [o.id]);
    await db.query(
      "UPDATE jobs SET status='cancelled',scheduled_at=NULL,technician_id=NULL WHERE order_id=$1",
      [o.id],
    );
    await db.query(
      "UPDATE visits SET status='cancelled',reason=$2,version=version+1 WHERE project_id=$1 AND status='scheduled'",
      [o.project_id, "Order cancelled: " + c.reason],
    );
    await db.query(
      "UPDATE projects SET cancelled_at=now(),cancellation_reason=$2 WHERE id=$1",
      [o.project_id, c.reason],
    );
  }
  await db.query(
    "UPDATE order_cancellations SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now() WHERE id=$1",
    [id, b.approved ? "approved" : "rejected", actor, b.note],
  );
  await audit(
    db,
    actor,
    "project",
    o.project_id,
    "order.cancellation_reviewed",
    { request_id: id, ...b },
  );
  return { saved: true };
}
