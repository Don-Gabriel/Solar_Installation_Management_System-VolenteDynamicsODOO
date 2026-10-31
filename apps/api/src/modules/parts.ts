import { one, ensure, audit, type Db } from "../db.js";
import { accessibleTicket } from "./service.js";
import { openTask } from "./operational-tasks.js";
import type { User } from "../../../../packages/contracts/src/index.js";
export async function request(db: Db, u: User, id: string, b: any) {
  const t = await accessibleTicket(db, u, id, true);
  ensure(
    !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
    "This request is no longer open.",
  );
  ensure(
    await one(db, "SELECT id FROM products WHERE id=$1 AND kind<>'service'", [
      b.product_id,
    ]),
    "Select a stocked component.",
    400,
  );
  const r = await one(
    db,
    "INSERT INTO service_parts_requests(ticket_id,product_id,quantity,expected_on,note,requested_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [id, b.product_id, b.quantity, b.expected_on || null, b.note, u.id],
  );
  await openTask(
    db,
    u.id,
    t.project_id,
    "parts",
    "Obtain parts and confirm readiness before promising a repair date.",
    id,
  );
  await audit(db, u.id, "project", t.project_id, "parts.requested", { ...r });
  return r;
}
export async function ready(db: Db, u: User, id: string, b: any) {
  const peek = await one(
    db,
    "SELECT ticket_id FROM service_parts_requests WHERE id=$1",
    [id],
  );
  ensure(peek, "Parts request not found", 404);
  const t = await accessibleTicket(db, u, peek.ticket_id, true);
  ensure(
    !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
    "Ticket is no longer open.",
  );
  const r = await one(
    db,
    "SELECT * FROM service_parts_requests WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(
    r.version === b.version && r.status === "waiting",
    "Parts request changed. Reload first.",
  );
  const p = await one(db, "SELECT * FROM products WHERE id=$1 FOR UPDATE", [
    r.product_id,
  ]);
  ensure(
    p.stock_qty - p.reserved_qty >= r.quantity,
    "Receive sufficient unreserved stock before confirming readiness.",
  );
  if (p.kind === "serialized")
    ensure(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM assets WHERE product_id=$1 AND status='available'",
          [p.id],
        )
      ).n >= r.quantity,
      "Available serials are insufficient.",
    );
  await db.query(
    "UPDATE service_parts_requests SET status='ready',ready_by=$2,ready_at=now(),note=note||$3,version=version+1 WHERE id=$1",
    [id, u.id, " | Ready: " + b.outcome],
  );
  await audit(db, u.id, "project", t.project_id, "parts.ready", {
    request_id: id,
    note: b.outcome,
  });
  return { id, status: "ready" };
}
export async function checkReady(db: Db, ticketId: string) {
  const rows = (
    await db.query(
      "SELECT r.*,p.stock_qty,p.reserved_qty,p.name FROM service_parts_requests r JOIN products p ON p.id=r.product_id WHERE r.ticket_id=$1 AND r.status<>'cancelled' ORDER BY r.product_id FOR UPDATE OF p",
      [ticketId],
    )
  ).rows;
  ensure(
    rows.every((r) => r.status === "ready"),
    "Parts are still waiting. Record a supplier estimate, not a confirmed completion appointment.",
  );
  const required = new Map<string, number>();
  for (const r of rows)
    required.set(r.product_id, (required.get(r.product_id) || 0) + r.quantity);
  for (const r of rows)
    ensure(
      r.stock_qty - r.reserved_qty >= required.get(r.product_id)!,
      `${r.name} is no longer available. Replenish stock before confirming the return visit.`,
    );
}
