import { one, ensure, audit, type Db } from "../db.js";
async function latest(db: Db, id: string) {
  const peek = await one(db, "SELECT project_id FROM quotes WHERE id=$1", [id]);
  ensure(peek, "Quote not found", 404);
  const p = await one(db, "SELECT * FROM projects WHERE id=$1 FOR UPDATE", [
    peek.project_id,
  ]);
  ensure(!p.cancelled_at, "Project cancelled.");
  ensure(
    !(await one(db, "SELECT id FROM orders WHERE project_id=$1", [p.id])),
    "Accepted terms cannot be discounted.",
  );
  const q = await one(
    db,
    "SELECT * FROM quotes WHERE project_id=$1 ORDER BY version DESC LIMIT 1",
    [p.id],
  );
  ensure(
    q.id === id,
    "A newer quotation exists. Request against the latest version.",
  );
  return q;
}
export async function request(db: Db, actor: string, id: string, b: any) {
  const q = await latest(db, id);
  ensure(
    !(await one(
      db,
      "SELECT id FROM quote_discounts WHERE result_quote_id=$1 AND status='approved'",
      [id],
    )),
    "Discounts cannot be stacked. Issue a fresh standard quotation first.",
  );
  const r = await one(
    db,
    "INSERT INTO quote_discounts(quote_id,percent,reason,requested_by) VALUES($1,$2,$3,$4) RETURNING *",
    [id, b.percent, b.reason, actor],
  );
  await audit(db, actor, "project", q.project_id, "discount.requested", {
    ...r,
  });
  return r;
}
export async function review(db: Db, actor: string, id: string, b: any) {
  const peek = await one(
    db,
    "SELECT quote_id FROM quote_discounts WHERE id=$1",
    [id],
  );
  ensure(peek, "Discount not found", 404);
  const q = await latest(db, peek.quote_id);
  const r = await one(
    db,
    "SELECT * FROM quote_discounts WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(r.status === "pending", "Already reviewed.");
  ensure(
    r.requested_by !== actor,
    "A separate administrator must review the discount.",
    403,
  );
  let result = null;
  if (b.approved) {
    const lines = (
      await db.query(
        "SELECT * FROM quote_lines WHERE quote_id=$1 ORDER BY id",
        [q.id],
      )
    ).rows;
    const total = lines.reduce(
      (sum, l) =>
        sum +
        Math.floor((l.unit_price_minor * (100 - r.percent)) / 100) * l.quantity,
      0,
    );
    result = await one(
      db,
      "INSERT INTO quotes(project_id,package_id,survey_id,version,total_minor) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [q.project_id, q.package_id, q.survey_id, q.version + 1, total],
    );
    for (const l of lines)
      await db.query(
        "INSERT INTO quote_lines(quote_id,product_id,description,kind,quantity,unit_price_minor,warranty_months) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          result.id,
          l.product_id,
          l.description,
          l.kind,
          l.quantity,
          Math.floor((l.unit_price_minor * (100 - r.percent)) / 100),
          l.warranty_months,
        ],
      );
  }
  await db.query(
    "UPDATE quote_discounts SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now(),result_quote_id=$5 WHERE id=$1",
    [
      id,
      b.approved ? "approved" : "rejected",
      actor,
      b.note,
      result?.id || null,
    ],
  );
  await audit(db, actor, "project", q.project_id, "discount.reviewed", {
    request_id: id,
    ...b,
    result_quote_id: result?.id,
  });
  return { id, result };
}
