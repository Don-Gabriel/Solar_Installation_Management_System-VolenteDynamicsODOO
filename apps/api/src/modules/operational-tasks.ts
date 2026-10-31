import { audit, ensure, one, pool, type Db } from "../db.js";
import type { User } from "../../../../packages/contracts/src/index.js";

export async function openTask(
  db: Db,
  userId: string,
  projectId: string,
  kind: string,
  summary: string,
  ticketId: string | null = null,
  visitId: string | null = null,
) {
  const r = await one(
    db,
    `INSERT INTO operational_tasks(project_id,ticket_id,visit_id,kind,summary,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,
    [projectId, ticketId, visitId, kind, summary, userId],
  );
  if (r)
    await audit(db, userId, "project", projectId, "task.opened", {
      task_id: r.id,
      kind,
      summary,
      ticket_id: ticketId,
      visit_id: visitId,
    });
  return (
    r ||
    (await one(
      db,
      "SELECT * FROM operational_tasks WHERE project_id=$1 AND kind=$2 AND ticket_id IS NOT DISTINCT FROM $3::uuid AND visit_id IS NOT DISTINCT FROM $4::uuid AND status='open'",
      [projectId, kind, ticketId, visitId],
    ))
  );
}
export async function taskList(user: User) {
  const tech = user.role === "technician" ? user.id : null;
  const items = (
    await pool.query(
      `SELECT ot.*,c.name AS customer_name FROM operational_tasks ot JOIN projects p ON p.id=ot.project_id JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id WHERE ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM visit_crew vc WHERE vc.visit_id=ot.visit_id AND vc.user_id=$1)) ORDER BY ot.status,CASE WHEN ot.kind='hazard' THEN 0 ELSE 1 END,ot.created_at`,
      [tech],
    )
  ).rows;
  const overdue = (
    await pool.query(
      `SELECT v.id AS visit_id,v.project_id,v.ticket_id,v.starts_at,v.acknowledgement_due_at,u.name AS worker_name,u.id AS worker_id,c.name AS customer_name FROM visits v JOIN visit_crew vc ON vc.visit_id=v.id JOIN users u ON u.id=vc.user_id JOIN projects p ON p.id=v.project_id JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id WHERE v.status='scheduled' AND vc.acknowledged_at IS NULL AND v.acknowledgement_due_at<now() AND ($1::uuid IS NULL OR vc.user_id=$1) ORDER BY v.acknowledgement_due_at`,
      [tech],
    )
  ).rows;
  return {
    items,
    unacknowledged: overdue,
    holidays: (
      await pool.query(
        "SELECT day::text,reason FROM company_holidays ORDER BY day",
      )
    ).rows,
  };
}
export async function finishTask(db: Db, user: User, id: string, b: any) {
  const t = await one(
    db,
    "SELECT * FROM operational_tasks WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(t, "Task not found", 404);
  ensure(
    user.role !== "support" || t.kind === "customer_contact",
    "Only a coordinator can close this operational task.",
    403,
  );
  ensure(
    t.version === b.version && t.status === "open",
    "This task changed. Reload before recording the outcome.",
  );
  await db.query(
    "UPDATE operational_tasks SET status='done',outcome=$2,completed_by=$3,completed_at=now(),version=version+1 WHERE id=$1",
    [id, b.outcome, user.id],
  );
  await audit(db, user.id, "project", t.project_id, "task.completed", {
    task_id: id,
    outcome: b.outcome,
  });
  return { saved: true };
}
export async function holiday(db: Db, user: User, b: any) {
  await db.query("SELECT pg_advisory_xact_lock(902636)");
  await db.query(
    "INSERT INTO company_holidays(day,reason,created_by) VALUES($1,$2,$3) ON CONFLICT(day) DO UPDATE SET reason=excluded.reason",
    [b.day, b.reason, user.id],
  );
  const visits = (
    await db.query(
      "SELECT * FROM visits WHERE status='scheduled' AND (starts_at AT TIME ZONE 'Asia/Kolkata')::date=$1::date",
      [b.day],
    )
  ).rows;
  for (const v of visits)
    await openTask(
      db,
      user.id,
      v.project_id,
      "reschedule",
      "Company holiday: " + b.reason,
      v.ticket_id,
      v.id,
    );
  await audit(db, user.id, "user", user.id, "calendar.holiday_recorded", b);
  return { saved: true, affected_visits: visits.length };
}
