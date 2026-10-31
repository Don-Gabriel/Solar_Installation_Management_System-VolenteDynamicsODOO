import { one, ensure, audit, type Db } from "../db.js";
import { accessibleTicket } from "./service.js";
import type { User } from "../../../../packages/contracts/src/index.js";
export async function approve(db: Db, u: User, id: string, b: any) {
  const t = await accessibleTicket(db, u, id, true);
  ensure(
    !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
    "Issued repair cannot change.",
  );
  const a = await one(
    db,
    "SELECT a.* FROM assets a JOIN order_lines l ON l.id=a.order_line_id JOIN orders o ON o.id=l.order_id WHERE a.id=$1 AND o.project_id=$2 AND a.status='delivered'",
    [b.asset_id, t.project_id],
  );
  ensure(a, "Choose an installed serial from this site.", 400);
  const p = await one(
    db,
    "SELECT * FROM products WHERE id=$1 AND kind='serialized'",
    [b.replacement_product_id],
  );
  ensure(
    p && p.id !== a.product_id,
    "Select a different serialized model.",
    400,
  );
  const r = await one(
    db,
    "INSERT INTO engineering_substitutes(ticket_id,asset_id,replacement_product_id,compatibility_note,customer_agreement,unit_price_minor,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [
      id,
      b.asset_id,
      b.replacement_product_id,
      b.compatibility_note,
      b.customer_agreement,
      b.unit_price_minor,
      u.id,
    ],
  );
  await audit(
    db,
    u.id,
    "project",
    t.project_id,
    "replacement.engineering_approved",
    { ...r },
  );
  return r;
}
