import { one, ensure, audit, pool, type Db } from "../db.js";
export async function damage(db: Db, actor: string, id: string, b: any) {
  const peek = await one(
    db,
    "SELECT a.*,l.order_id FROM assets a LEFT JOIN order_lines l ON l.id=a.order_line_id WHERE a.id=$1",
    [id],
  );
  ensure(peek, "Serial not found", 404);
  const order = peek.order_id
    ? await one(db, "SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        peek.order_id,
      ])
    : null;
  ensure(
    !order || order.status === "packing",
    "Use a delivery or repair return for goods that already left the warehouse.",
  );
  const p = await one(db, "SELECT * FROM products WHERE id=$1 FOR UPDATE", [
    peek.product_id,
  ]);
  const a = await one(db, "SELECT * FROM assets WHERE id=$1 FOR UPDATE", [id]);
  ensure(
    a.order_line_id === peek.order_line_id &&
      ["available", "allocated"].includes(a.status),
    "Serial changed or is not warehouse stock.",
  );
  let released = 0;
  if (order) {
    const l = await one(
      db,
      "SELECT * FROM order_lines WHERE id=$1 FOR UPDATE",
      [a.order_line_id],
    );
    if (p.stock_qty - 1 < p.reserved_qty) {
      released = l.reserved ? l.quantity : 0;
      await db.query("UPDATE order_lines SET reserved=false WHERE id=$1", [
        l.id,
      ]);
      await db.query(
        "UPDATE assets SET status='available',order_line_id=NULL WHERE order_line_id=$1 AND status='allocated' AND id<>$2",
        [l.id, id],
      );
    }
  }
  ensure(
    p.stock_qty - 1 >= p.reserved_qty - released,
    "This stock is reserved for another order. Resolve that reservation before quarantine.",
  );
  await db.query(
    "UPDATE assets SET status='quarantined',order_line_id=NULL WHERE id=$1",
    [id],
  );
  await db.query(
    "UPDATE products SET stock_qty=stock_qty-1,reserved_qty=reserved_qty-$2,stock_value_minor=stock_value_minor-$3 WHERE id=$1",
    [p.id, released, a.cost_minor],
  );
  await db.query(
    "INSERT INTO stock_movements(product_id,order_id,quantity,value_minor) VALUES($1,$2,-1,$3)",
    [p.id, order?.id || null, -a.cost_minor],
  );
  const r = await one(
    db,
    "INSERT INTO stock_damage(asset_id,order_id,reason,created_by) VALUES($1,$2,$3,$4) RETURNING *",
    [id, order?.id || null, b.reason, actor],
  );
  await audit(
    db,
    actor,
    order ? "project" : "asset",
    order?.project_id || id,
    "stock.quarantined",
    {
      serial: a.serial,
      reason: b.reason,
      reservation_released: released,
      damage_id: r.id,
    },
  );
  return r;
}
export async function counts() {
  return {
    items: (
      await pool.query(
        "SELECT c.*,p.name AS product_name FROM stock_counts c JOIN products p ON p.id=c.product_id ORDER BY c.created_at DESC",
      )
    ).rows,
  };
}
export async function requestCount(db: Db, actor: string, b: any) {
  const p = await one(db, "SELECT * FROM products WHERE id=$1 FOR UPDATE", [
    b.product_id,
  ]);
  ensure(
    p && p.kind === "quantity",
    "Use serial receipts and serial quarantine for serialized equipment. This count adjustment is for quantity-tracked materials.",
    400,
  );
  const r = await one(
    db,
    "INSERT INTO stock_counts(product_id,expected_quantity,counted_quantity,reason,requested_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [p.id, p.stock_qty, b.counted_quantity, b.reason, actor],
  );
  await audit(db, actor, "product", p.id, "stock.count_requested", { ...r });
  return r;
}
export async function reviewCount(db: Db, actor: string, id: string, b: any) {
  const peek = await one(
    db,
    "SELECT product_id FROM stock_counts WHERE id=$1",
    [id],
  );
  ensure(peek, "Count not found", 404);
  const p = await one(db, "SELECT * FROM products WHERE id=$1 FOR UPDATE", [
    peek.product_id,
  ]);
  const c = await one(db, "SELECT * FROM stock_counts WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(c.status === "pending", "Count already reviewed.");
  ensure(
    c.requested_by !== actor,
    "Another administrator or accounts officer must review this count.",
    403,
  );
  if (b.approved) {
    ensure(
      p.stock_qty === c.expected_quantity,
      "Stock moved after counting. Record a fresh count.",
    );
    ensure(
      c.counted_quantity >= p.reserved_qty,
      "Count would invalidate reserved orders. Resolve reservations first.",
    );
    ensure(
      p.stock_qty > 0 || c.counted_quantity === 0,
      "Use a purchase receipt to establish the acquisition cost of newly found stock.",
    );
    const delta = c.counted_quantity - p.stock_qty,
      value = p.stock_qty
        ? Math.round((p.stock_value_minor * delta) / p.stock_qty)
        : 0;
    await db.query(
      "UPDATE products SET stock_qty=$2,stock_value_minor=stock_value_minor+$3 WHERE id=$1",
      [p.id, c.counted_quantity, value],
    );
    if (delta)
      await db.query(
        "INSERT INTO stock_movements(product_id,quantity,value_minor) VALUES($1,$2,$3)",
        [p.id, delta, value],
      );
  }
  await db.query(
    "UPDATE stock_counts SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now() WHERE id=$1",
    [id, b.approved ? "approved" : "rejected", actor, b.note],
  );
  await audit(db, actor, "product", p.id, "stock.count_reviewed", {
    count_id: id,
    ...b,
  });
  return { saved: true };
}
