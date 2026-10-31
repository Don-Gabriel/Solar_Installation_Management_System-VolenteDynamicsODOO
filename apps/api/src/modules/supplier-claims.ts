import { one, pool, ensure, audit, type Db } from "../db.js";
import { accessibleTicket } from "./service.js";
import type { User } from "../../../../packages/contracts/src/index.js";

export async function external(db: Db, user: User, id: string, b: any) {
  const t = await accessibleTicket(db, user, id, true);
  ensure(
    !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
    "Issued work is immutable. Open a follow-up request.",
  );
  ensure(
    await one(
      db,
      "SELECT id FROM visits WHERE ticket_id=$1 AND status='in_progress'",
      [id],
    ),
    "Start the assigned visit first.",
  );
  const r = await one(
    db,
    "INSERT INTO external_equipment(ticket_id,name,serial,findings,recorded_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [id, b.name, b.serial || "", b.findings, user.id],
  );
  await audit(
    db,
    user.id,
    "project",
    t.project_id,
    "external_equipment.recorded",
    {
      ticket_id: id,
      external_id: r.id,
      name: b.name,
      findings: b.findings,
      company_warranty: false,
    },
  );
  return r;
}
export async function list() {
  return {
    items: (
      await pool.query(
        `SELECT c.*,r.ticket_id,a.serial AS original_serial,coalesce((SELECT sum(amount_minor) FROM supplier_recoveries p WHERE p.claim_id=c.id),0)::bigint AS recovered_minor,coalesce((SELECT json_agg(p ORDER BY received_at) FROM supplier_recoveries p WHERE p.claim_id=c.id),'[]') AS recoveries FROM supplier_claims c JOIN service_returns r ON r.id=c.return_id JOIN assets a ON a.id=r.asset_id ORDER BY c.created_at DESC`,
      )
    ).rows,
  };
}
export async function send(db: Db, user: User, id: string, b: any) {
  const r = await one(
    db,
    "SELECT r.*,t.project_id FROM service_returns r JOIN tickets t ON t.id=r.ticket_id WHERE r.id=$1 FOR UPDATE OF r",
    [id],
  );
  ensure(r, "Return not found", 404);
  ensure(
    r.status === "quarantined",
    "Receive the faulty device into quarantine before sending it to the supplier.",
  );
  const c = await one(
    db,
    "INSERT INTO supplier_claims(return_id,supplier,reference,tracking_reference,requested_minor,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [
      id,
      b.supplier,
      b.reference,
      b.tracking_reference,
      b.requested_minor,
      user.id,
    ],
  );
  await db.query(
    "UPDATE service_returns SET status='sent_to_supplier',note=note||$2 WHERE id=$1",
    [id, " | Supplier shipment " + b.tracking_reference],
  );
  await audit(db, user.id, "project", r.project_id, "supplier.claim_sent", {
    claim_id: c.id,
    return_id: id,
    ...b,
  });
  return c;
}
export async function decision(db: Db, user: User, id: string, b: any) {
  const c = await one(
    db,
    "SELECT * FROM supplier_claims WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(c, "Claim not found", 404);
  ensure(c.version === b.version, "Claim changed. Reload first.");
  ensure(
    ["submitted", "disputed"].includes(c.status),
    "This claim already has a financial decision.",
  );
  ensure(
    b.status !== "approved" || b.amount_minor > 0,
    "Approved recovery must be positive; otherwise decline the claim.",
    400,
  );
  ensure(
    b.amount_minor <= c.requested_minor,
    "Approval exceeds requested recovery.",
  );
  ensure(
    b.status === "approved" || b.amount_minor === 0,
    "Only an approved claim has an approved amount.",
    400,
  );
  await db.query(
    "UPDATE supplier_claims SET status=$2,approved_minor=$3,decision_note=$4,reviewed_by=$5,reviewed_at=now(),version=version+1 WHERE id=$1",
    [id, b.status, b.amount_minor, b.note, user.id],
  );
  if (b.status === "declined")
    await db.query(
      "UPDATE service_returns SET status='closed',note=note||$2 WHERE id=$1",
      [c.return_id, " | Supplier declined: " + b.note],
    );
  await audit(db, user.id, "supplier_claim", id, "supplier.decision_recorded", {
    before: c,
    ...b,
  });
  return { id, status: b.status };
}
export async function recovery(db: Db, user: User, id: string, b: any) {
  const c = await one(
    db,
    "SELECT * FROM supplier_claims WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(c, "Claim not found", 404);
  ensure(
    c.status === "approved",
    "Supplier must approve this claim before recovery is recorded.",
  );
  const paid = await one(
    db,
    "SELECT coalesce(sum(amount_minor),0)::bigint AS total FROM supplier_recoveries WHERE claim_id=$1",
    [id],
  );
  ensure(
    b.amount_minor <= c.approved_minor - paid.total,
    "Recovery exceeds the remaining approved amount.",
  );
  const r = await one(
    db,
    "INSERT INTO supplier_recoveries(claim_id,amount_minor,reference,recorded_by) VALUES($1,$2,$3,$4) RETURNING *",
    [id, b.amount_minor, b.reference, user.id],
  );
  if (paid.total + b.amount_minor === c.approved_minor) {
    await db.query(
      "UPDATE supplier_claims SET status='paid',version=version+1 WHERE id=$1",
      [id],
    );
    await db.query("UPDATE service_returns SET status='closed' WHERE id=$1", [
      c.return_id,
    ]);
  }
  await audit(db, user.id, "supplier_claim", id, "supplier.recovery_recorded", {
    ...b,
    recovery_id: r.id,
  });
  return r;
}
