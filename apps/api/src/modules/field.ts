import { audit, ensure, one, type Db } from "../db.js";
import type { User } from "../../../../packages/contracts/src/index.js";
export async function accessibleJob(db: Db, user: User, id: string) {
  const job = await one(
    db,
    "SELECT j.*,o.project_id,o.status AS delivery_status FROM jobs j JOIN orders o ON o.id=j.order_id WHERE j.id=$1 FOR UPDATE OF j",
    [id],
  );
  ensure(job, "Job not found", 404);
  ensure(
    user.role !== "technician" || job.technician_id === user.id,
    "This job is assigned to another technician.",
    403,
  );
  return job;
}
export async function assignJob(db: Db, user: User, id: string, b: any) {
  const job = await accessibleJob(db, user, id);
  ensure(
    !["completed", "in_progress"].includes(job.status),
    "A started job cannot be reassigned.",
  );
  const tech = await one(
    db,
    "SELECT * FROM users WHERE id=$1 AND role='technician' AND active FOR UPDATE",
    [b.technician_id],
  );
  ensure(tech, "Choose an active technician.");
  const conflict = await one(
    db,
    `SELECT id FROM jobs WHERE technician_id=$1 AND id<>$2 AND status<>'completed' AND scheduled_at<$3::timestamptz+make_interval(hours=>$4) AND scheduled_at+make_interval(hours=>duration_hours)>$3::timestamptz`,
    [tech.id, id, b.scheduled_at, b.duration_hours],
  );
  ensure(!conflict, "This technician already has a job during that time.");
  await db.query(
    "UPDATE jobs SET technician_id=$2,scheduled_at=$3,duration_hours=$4,status='scheduled' WHERE id=$1",
    [id, tech.id, b.scheduled_at, b.duration_hours],
  );
  await audit(db, user.id, "project", job.project_id, "job.assigned", {
    technician: tech.name,
    scheduled_at: b.scheduled_at,
  });
  return { status: "scheduled" };
}
export async function startJob(db: Db, user: User, id: string) {
  const job = await accessibleJob(db, user, id);
  if (job.status === "in_progress") return job;
  ensure(job.status === "scheduled", "Assign and schedule this job first.");
  ensure(
    job.delivery_status === "delivered",
    "Record delivery before starting installation.",
  );
  await db.query(
    "UPDATE jobs SET status='in_progress',started_at=now() WHERE id=$1",
    [id],
  );
  await audit(db, user.id, "project", job.project_id, "job.started");
  return { status: "in_progress" };
}
export async function completeJob(db: Db, user: User, id: string, b: any) {
  const job = await accessibleJob(db, user, id);
  if (job.status === "completed") return job;
  ensure(
    job.status === "in_progress",
    "Start the job before recording completion.",
  );
  ensure(
    Object.values(b.checklist).every(Boolean),
    "Complete every installation safety and handover check.",
  );
  const files = (
    await db.query("SELECT kind FROM evidence WHERE job_id=$1", [id])
  ).rows;
  ensure(
    files.some((f) => f.kind === "photo") &&
      files.some((f) => f.kind === "signature"),
    "Save a test photo and homeowner signature before completion.",
  );
  const tech = await one(
    db,
    "SELECT hourly_rate_minor FROM users WHERE id=$1",
    [job.technician_id],
  );
  const cost = Math.round((b.labour_minutes * tech.hourly_rate_minor) / 60);
  await db.query(
    "UPDATE jobs SET status='completed',finished_at=now(),capacity_kw=$2,generation_kw=$3,checklist=$4,signer_name=$5,labour_minutes=$6,hourly_rate_minor=$7,labour_cost_minor=$8 WHERE id=$1",
    [
      id,
      b.capacity_kw,
      b.generation_kw,
      JSON.stringify(b.checklist),
      b.signer_name,
      b.labour_minutes,
      tech.hourly_rate_minor,
      cost,
    ],
  );
  await db.query("UPDATE projects SET stage='completed' WHERE id=$1", [
    job.project_id,
  ]);
  await audit(
    db,
    user.id,
    "project",
    job.project_id,
    "installation.completed",
    { signer: b.signer_name, labour_minutes: b.labour_minutes },
  );
  return { status: "completed" };
}
export async function saveSubsidy(db: Db, user: User, id: string, b: any) {
  const p = await one(db, "SELECT id FROM projects WHERE id=$1", [id]);
  ensure(p, "Project not found", 404);
  if (b.status === "submitted")
    ensure(
      Object.values(b.documents).every(Boolean) && b.reference.trim(),
      "Complete the document checklist and application reference before submission.",
    );
  await db.query(
    "INSERT INTO subsidies(project_id,status,reference,next_action,documents,owner_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(project_id) DO UPDATE SET status=excluded.status,reference=excluded.reference,next_action=excluded.next_action,documents=excluded.documents,owner_id=excluded.owner_id,updated_at=now()",
    [
      id,
      b.status,
      b.reference,
      b.next_action,
      JSON.stringify(b.documents),
      b.owner_id || user.id,
    ],
  );
  await audit(db, user.id, "project", id, "subsidy.updated", {
    status: b.status,
  });
  return { saved: true };
}
