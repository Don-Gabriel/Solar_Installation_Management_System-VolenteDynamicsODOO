import { audit, ensure, one, pool, type Db } from "../db.js";
import { openTask } from "./operational-tasks.js";

export async function search(q: any) {
  return {
    items: (
      await pool.query(
        `SELECT c.id,c.name,c.phone,c.version,c.billing_address,coalesce((SELECT json_agg(json_build_object('id',s.id,'address',s.address,'projects',(SELECT coalesce(json_agg(json_build_object('id',p.id,'number',p.number,'stage',p.stage,'cancelled_at',p.cancelled_at)),'[]') FROM projects p WHERE p.site_id=s.id))) FROM sites s WHERE s.customer_id=c.id),'[]') AS sites FROM customers c WHERE c.merged_into IS NULL AND (c.name ILIKE $1 OR c.phone ILIKE $1) ORDER BY c.name LIMIT 50`,
        ["%" + (q.search || "") + "%"],
      )
    ).rows,
  };
}
export async function editCustomer(db: Db, actor: string, id: string, b: any) {
  const c = await one(db, "SELECT * FROM customers WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(c && !c.merged_into, "Active customer not found", 404);
  ensure(c.version === b.version, "Contact changed. Reload before saving.");
  ensure(
    c.phone === b.phone || b.phone_verified,
    "Verify the new phone number with the customer before saving.",
  );
  const updated = await one(
    db,
    "UPDATE customers SET name=$2,phone=$3,billing_address=$4,version=version+1 WHERE id=$1 RETURNING *",
    [id, b.name.trim(), b.phone.trim(), b.billing_address || ""],
  );
  await db.query(
    "INSERT INTO customer_history(customer_id,actor_id,before_value,after_value,reason) VALUES($1,$2,$3,$4,$5)",
    [id, actor, JSON.stringify(c), JSON.stringify(updated), b.reason],
  );
  await audit(db, actor, "customer", id, "contact.updated", {
    version: updated.version,
    reason: b.reason,
  });
  return updated;
}
export async function siteEdit(db: Db, actor: string, id: string, b: any) {
  const s = await one(db, "SELECT * FROM sites WHERE id=$1 FOR UPDATE", [id]);
  ensure(s, "Site not found", 404);
  ensure(s.version === b.version, "Site changed. Reload before saving.");
  const updated = await one(
    db,
    "UPDATE sites SET access_notes=$2,version=version+1 WHERE id=$1 RETURNING *",
    [id, b.access_notes],
  );
  await audit(db, actor, "site", id, "access.updated", {
    before: s.access_notes,
    after: b.access_notes,
    reason: b.reason,
  });
  return updated;
}
export async function contact(db: Db, actor: string, id: string, b: any) {
  ensure(
    await one(db, "SELECT id FROM projects WHERE id=$1", [id]),
    "Project not found",
    404,
  );
  const r = await one(
    db,
    "INSERT INTO project_contacts(project_id,actor_id,note) VALUES($1,$2,$3) RETURNING *",
    [id, actor, b.note],
  );
  await audit(db, actor, "project", id, "customer.call_recorded", {
    contact_id: r.id,
  });
  return r;
}
export async function merge(db: Db, actor: string, id: string, b: any) {
  ensure(id !== b.target_id, "Choose a different customer.");
  await db.query(
    "SELECT id FROM customers WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [[id, b.target_id]],
  );
  const source = await one(db, "SELECT * FROM customers WHERE id=$1", [id]),
    target = await one(db, "SELECT * FROM customers WHERE id=$1", [
      b.target_id,
    ]);
  ensure(
    source && target && !source.merged_into && !target.merged_into,
    "Choose two active customers.",
    404,
  );
  ensure(
    source.version === b.version && target.version === b.target_version,
    "Customer changed. Review both records again.",
  );
  ensure(
    b.confirmed_same_customer,
    "Confirm that these records represent the same customer.",
  );
  await db.query(
    "UPDATE sites SET customer_id=$2,version=version+1 WHERE customer_id=$1",
    [id, b.target_id],
  );
  await db.query(
    "UPDATE customers SET merged_into=$2,version=version+1 WHERE id=$1",
    [id, b.target_id],
  );
  await db.query("UPDATE customers SET version=version+1 WHERE id=$1", [
    b.target_id,
  ]);
  await db.query(
    "INSERT INTO customer_history(customer_id,actor_id,before_value,after_value,reason) VALUES($1,$2,$3,$4,$5)",
    [
      id,
      actor,
      JSON.stringify(source),
      JSON.stringify({ merged_into: b.target_id }),
      b.reason,
    ],
  );
  await audit(db, actor, "customer", id, "customer.merged", {
    target_id: b.target_id,
    reason: b.reason,
  });
  return { id, merged_into: b.target_id };
}
export async function cancelEnquiry(db: Db, actor: string, id: string, b: any) {
  await db.query("SELECT pg_advisory_xact_lock(902636)");
  const p = await one(db, "SELECT * FROM projects WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(p, "Project not found", 404);
  ensure(!p.cancelled_at, "Enquiry already cancelled.");
  ensure(
    !(await one(db, "SELECT id FROM orders WHERE project_id=$1", [id])),
    "An accepted order needs financial cancellation review.",
  );
  ensure(
    !(await one(
      db,
      "SELECT id FROM visits WHERE project_id=$1 AND status='in_progress'",
      [id],
    )),
    "Coordinate with the onsite worker before cancellation.",
  );
  await db.query(
    "UPDATE projects SET cancelled_at=now(),cancellation_reason=$2 WHERE id=$1",
    [id, b.reason],
  );
  await db.query(
    "UPDATE visits SET status='cancelled',reason=$2,version=version+1 WHERE project_id=$1 AND status='scheduled'",
    [id, b.reason],
  );
  await openTask(
    db,
    actor,
    id,
    "customer_contact",
    "Confirm enquiry cancellation with customer: " + b.reason,
  );
  await audit(db, actor, "project", id, "enquiry.cancelled", {
    reason: b.reason,
  });
  return { id, cancelled: true };
}
