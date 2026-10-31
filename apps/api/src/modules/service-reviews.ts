import { audit, ensure, one, type Db } from "../db.js";
import { accessibleTicket } from "./service.js";
import { accessibleJob } from "./field.js";
import { openTask } from "./operational-tasks.js";
import type { User } from "../../../../packages/contracts/src/index.js";

const remoteCategories = [
  "Monitoring app",
  "Display reading",
  "Account connection",
];
export async function requestReview(db: Db, user: User, id: string, b: any) {
  const t = await accessibleTicket(db, user, id, true);
  ensure(t.version === b.version, "Request changed. Reload first.");
  ensure(
    !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
    "This request is already issued or closed.",
  );
  ensure(
    !(await one(db, "SELECT id FROM diagnosis_lines WHERE ticket_id=$1", [id])),
    "Use the component repair workflow for an existing diagnosis.",
  );
  let visit = null;
  if (b.kind === "remote") {
    ensure(
      ["admin", "support", "coordinator"].includes(user.role),
      "Only the support team can record remote support.",
      403,
    );
    ensure(
      remoteCategories.includes(t.fault_code) && t.priority !== "urgent",
      "Only nonhazardous monitoring, display or account-connection issues permit remote resolution.",
    );
    ensure(
      b.customer_confirmation?.trim(),
      "Record customer confirmation of the remote fix.",
      400,
    );
    ensure(
      !(await one(
        db,
        "SELECT id FROM visits WHERE ticket_id=$1 AND status IN ('scheduled','in_progress')",
        [id],
      )),
      "Release or finish the existing appointment before remote closure.",
    );
  } else {
    ensure(
      ["admin", "technician"].includes(user.role),
      "The assigned technician must record onsite findings.",
      403,
    );
    visit = await one(
      db,
      "SELECT v.* FROM visits v WHERE ticket_id=$1 AND status='in_progress' AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM visit_crew c WHERE c.visit_id=v.id AND c.user_id=$2)) FOR UPDATE",
      [id, user.role === "technician" ? user.id : null],
    );
    ensure(visit, "Start the assigned visit first.");
    ensure(b.minutes > 0, "Record actual diagnostic minutes.", 400);
    ensure(
      await one(
        db,
        "SELECT id FROM evidence WHERE ticket_id=$1 AND visit_id=$2 AND kind='photo'",
        [id, visit.id],
      ),
      "Save the diagnostic test photo before requesting no-fault review.",
    );
  }
  const r = await one(
    db,
    "INSERT INTO service_reviews(ticket_id,ticket_version,kind,observations,customer_confirmation,minutes,visit_id,requested_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [
      id,
      t.version + 1,
      b.kind,
      b.observations,
      b.customer_confirmation || "",
      b.kind === "remote" ? 0 : b.minutes,
      visit?.id || null,
      user.id,
    ],
  );
  await db.query("UPDATE tickets SET version=version+1 WHERE id=$1", [id]);
  await audit(
    db,
    user.id,
    "project",
    t.project_id,
    "service.review_requested",
    { review_id: r.id, kind: b.kind, observations: b.observations },
  );
  return r;
}
export async function decide(db: Db, user: User, id: string, b: any) {
  const peek = await one(
    db,
    "SELECT ticket_id FROM service_reviews WHERE id=$1",
    [id],
  );
  ensure(peek, "Review not found", 404);
  const t = await accessibleTicket(db, user, peek.ticket_id, true),
    r = await one(db, "SELECT * FROM service_reviews WHERE id=$1 FOR UPDATE", [
      id,
    ]);
  ensure(r.status === "pending", "Already reviewed.");
  ensure(
    r.requested_by !== user.id,
    "Another coordinator or administrator must review this outcome.",
    403,
  );
  if (b.approved) {
    ensure(
      t.version === r.ticket_version,
      "Request changed after these observations. Reject and request a fresh review.",
    );
    ensure(
      !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
      "Request already issued or closed.",
    );
    ensure(
      !(await one(db, "SELECT id FROM diagnosis_lines WHERE ticket_id=$1", [
        t.id,
      ])),
      "Component diagnosis now exists. Review the component workflow.",
    );
    if (r.kind === "remote") {
      ensure(
        remoteCategories.includes(t.fault_code) && t.priority !== "urgent",
        "Remote resolution is not allowed for this problem.",
      );
      ensure(
        !(await one(
          db,
          "SELECT id FROM visits WHERE ticket_id=$1 AND status IN ('scheduled','in_progress')",
          [t.id],
        )),
        "An appointment now exists. Coordinate before closing.",
      );
      await db.query(
        "UPDATE tickets SET status='closed',resolution=$2,confirmed_by=$3,confirmed_at=now(),version=version+1 WHERE id=$1",
        [t.id, r.observations, r.customer_confirmation],
      );
    } else {
      const visit = await one(
        db,
        "SELECT * FROM visits WHERE id=$1 AND status='in_progress' FOR UPDATE",
        [r.visit_id],
      );
      ensure(visit, "Visit is no longer active.");
      const worker = await one(
        db,
        "SELECT hourly_rate_minor FROM users WHERE id=$1",
        [r.requested_by],
      );
      const order = await one(db, "SELECT id FROM orders WHERE project_id=$1", [
        t.project_id,
      ]);
      const invoice = await one(
        db,
        "INSERT INTO invoices(order_id,ticket_id,kind,total_minor) VALUES($1,$2,'service',0) RETURNING *",
        [order.id, t.id],
      );
      await db.query(
        "INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,coverage_reason) VALUES($1,'Reviewed diagnostic visit: no fault found',1,0,'Demo no-fault policy: no customer charge')",
        [invoice.id],
      );
      await db.query(
        "UPDATE visits SET status='completed',completed_at=now(),version=version+1 WHERE id=$1",
        [visit.id],
      );
      await db.query(
        "UPDATE tickets SET status='awaiting_confirmation',resolution=$2,labour_cost_minor=$3,customer_charge_minor=0,version=version+1 WHERE id=$1",
        [
          t.id,
          r.observations,
          Math.round((r.minutes * worker.hourly_rate_minor) / 60),
        ],
      );
    }
  }
  await db.query(
    "UPDATE service_reviews SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now() WHERE id=$1",
    [id, b.approved ? "approved" : "rejected", user.id, b.note],
  );
  await audit(db, user.id, "project", t.project_id, "service.review_decided", {
    review_id: id,
    ...b,
  });
  return { id, status: b.approved ? "approved" : "rejected" };
}
export async function installationDispute(
  db: Db,
  user: User,
  id: string,
  b: any,
  review = false,
) {
  const job = await accessibleJob(db, user, id);
  ensure(
    job.status === "in_progress",
    "Only an active installation can be reviewed.",
  );
  if (review) {
    ensure(job.review_required, "No open handover dispute.");
    await db.query(
      "UPDATE jobs SET review_required=false,review_reason=$2 WHERE id=$1",
      [id, b.reason],
    );
    await db.query(
      "UPDATE operational_tasks SET status='done',completed_by=$2,completed_at=now(),outcome=$3,version=version+1 WHERE project_id=$1 AND kind='installation_dispute' AND status='open'",
      [job.project_id, user.id, b.reason],
    );
  } else {
    await db.query(
      "UPDATE jobs SET review_required=true,review_reason=$2 WHERE id=$1",
      [id, b.reason],
    );
    await openTask(
      db,
      user.id,
      job.project_id,
      "installation_dispute",
      "Customer handover dispute: " + b.reason,
    );
  }
  await audit(
    db,
    user.id,
    "project",
    job.project_id,
    review ? "installation.dispute_reviewed" : "installation.disputed",
    { job_id: id, reason: b.reason },
  );
  return { id, review_required: !review };
}
