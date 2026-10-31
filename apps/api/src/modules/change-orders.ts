import { one, ensure, audit, type Db } from "../db.js";
export async function create(db: Db, actor: string, id: string, b: any) {
  const p = await one(db, "SELECT * FROM projects WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(p && !p.cancelled_at, "Active parent project not found", 404);
  ensure(
    await one(
      db,
      "SELECT id FROM orders WHERE project_id=$1 AND status<>'cancelled'",
      [id],
    ),
    "Accept the original order before requesting additional work.",
  );
  ensure(
    new Set(b.lines.map((l: any) => l.product_id)).size === b.lines.length,
    "Each additional product must appear once.",
    400,
  );
  const c = await one(
    db,
    "INSERT INTO projects(site_id,capacity_kw,system_type,source,notes,subsidy_interest,owner_id,parent_project_id) VALUES($1,$2,$3,'Change order',$4,false,$5,$6) RETURNING *",
    [p.site_id, p.capacity_kw, p.system_type, b.reason, actor, id],
  );
  for (const l of b.lines) {
    ensure(
      await one(db, "SELECT id FROM products WHERE id=$1", [l.product_id]),
      "Unknown additional product.",
      400,
    );
    await db.query(
      "INSERT INTO change_order_lines(project_id,product_id,quantity) VALUES($1,$2,$3)",
      [c.id, l.product_id, l.quantity],
    );
  }
  await audit(db, actor, "project", id, "change_order.requested", {
    change_project_id: c.id,
    reason: b.reason,
    lines: b.lines,
  });
  await audit(db, actor, "project", c.id, "change_order.created", {
    parent_project_id: id,
    reason: b.reason,
  });
  return c;
}
