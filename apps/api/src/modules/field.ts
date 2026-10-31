import { audit, ensure, one, type Db } from "../db.js";
import { eligible } from "./scheduling.js";
import type { User } from "../../../../packages/contracts/src/index.js";
export async function accessibleJob(db: Db, user: User, id: string) {
  const job = await one(
    db,
    "SELECT j.*,o.project_id,o.status AS delivery_status FROM jobs j JOIN orders o ON o.id=j.order_id WHERE j.id=$1 FOR UPDATE OF j",
    [id],
  );
  ensure(job, "Job not found", 404);
  ensure(
    user.role !== "technician" ||
      job.technician_id === user.id ||
      (await one(db, "SELECT 1 FROM job_crew WHERE job_id=$1 AND user_id=$2", [
        id,
        user.id,
      ])),
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
  const ids = [
    ...new Set<string>(b.technician_ids || [b.technician_id]),
  ].sort();
  ensure(
    ids.includes(b.technician_id),
    "The lead must be part of the crew.",
    400,
  );
  const crew = (
    await db.query(
      "SELECT * FROM users WHERE id=ANY($1::uuid[]) AND role='technician' ORDER BY id FOR UPDATE",
      [ids],
    )
  ).rows;
  ensure(crew.length === ids.length, "Choose active technicians.");
  const start = new Date(b.scheduled_at),
    end = new Date(+start + b.duration_hours * 3600000);
  ensure(+start > Date.now(), "Choose a future installation time.");
  for (const member of crew) {
    const why = await eligible(
      db,
      member,
      start.toISOString(),
      end.toISOString(),
      "installation",
      null,
      id,
    );
    ensure(!why, member.name + ": " + why);
  }
  const tech = crew.find((t) => t.id === b.technician_id);
  ensure(tech.skills.includes("crew_lead"), "Choose a qualified crew lead.");
  await db.query("DELETE FROM job_crew WHERE job_id=$1", [id]);
  for (const member of crew)
    await db.query(
      "INSERT INTO job_crew(job_id,user_id,is_lead) VALUES($1,$2,$3)",
      [id, member.id, member.id === tech.id],
    );
  await db.query(
    "UPDATE jobs SET technician_id=$2,scheduled_at=$3,duration_hours=$4,status='scheduled' WHERE id=$1",
    [id, tech.id, b.scheduled_at, b.duration_hours],
  );
  await audit(db, user.id, "project", job.project_id, "job.assigned", {
    technician: tech.name,
    crew: ids,
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
  ensure(
    user.role !== "technician" || job.technician_id === user.id,
    "Only the assigned lead can sign off installation.",
    403,
  );
  if (job.status === "completed") return job;
  const accepted=await one(db,'SELECT capacity_kw FROM projects WHERE id=$1',[job.project_id]);
  ensure(Math.abs(b.capacity_kw-accepted.capacity_kw)<=accepted.capacity_kw*0.1,
    'Installed capacity differs materially from the accepted system. Review the discrepancy before handover.');
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
  const crew = (
    await db.query(
      "SELECT c.*,u.hourly_rate_minor AS current_rate FROM job_crew c JOIN users u ON u.id=c.user_id WHERE job_id=$1 ORDER BY user_id FOR UPDATE OF c",
      [id],
    )
  ).rows;
  if (!crew.length) {
    const lead = await one(
      db,
      "SELECT hourly_rate_minor FROM users WHERE id=$1",
      [job.technician_id],
    );
    crew.push({
      user_id: job.technician_id,
      current_rate: lead.hourly_rate_minor,
    });
  }
  if (b.crew_minutes)
    ensure(
      Object.keys(b.crew_minutes).length === crew.length &&
        crew.every((c) => Object.hasOwn(b.crew_minutes, c.user_id)),
      "Record actual minutes for every assigned crew member.",
      400,
    );
  let cost = 0,
    totalMinutes = 0;
  for (const member of crew) {
    const minutes = b.crew_minutes?.[member.user_id] ?? b.labour_minutes;
    const memberCost = Math.round((minutes * member.current_rate) / 60);
    cost += memberCost;
    totalMinutes += minutes;
    await db.query(
      "UPDATE job_crew SET labour_minutes=$3,hourly_rate_minor=$4,labour_cost_minor=$5 WHERE job_id=$1 AND user_id=$2",
      [id, member.user_id, minutes, member.current_rate, memberCost],
    );
  }
  const tech = {
    hourly_rate_minor: crew.find((c) => c.user_id === job.technician_id)
      .current_rate,
  };
  await db.query(
    "UPDATE jobs SET status='completed',finished_at=now(),capacity_kw=$2,generation_kw=$3,checklist=$4,signer_name=$5,labour_minutes=$6,hourly_rate_minor=$7,labour_cost_minor=$8 WHERE id=$1",
    [
      id,
      b.capacity_kw,
      b.generation_kw,
      JSON.stringify(b.checklist),
      b.signer_name,
      totalMinutes,
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

export async function payCrew(db: Db, user: User, id: string, b: any) {
  const j = await one(db, "SELECT * FROM jobs WHERE id=$1 FOR UPDATE", [id]);
  ensure(
    j?.status === "completed",
    "Only completed installation work is payable.",
  );
  const members = (
    await db.query(
      "SELECT * FROM job_crew WHERE job_id=$1 AND ($2::uuid IS NULL OR user_id=$2) ORDER BY user_id FOR UPDATE",
      [id, b.technician_id || null],
    )
  ).rows;
  ensure(members.length, "Worker does not belong to this installation.", 400);
  const paid = [];
  for (const member of members) {
    ensure(
      member.labour_cost_minor !== null,
      "Actual work time has not been confirmed.",
    );
    const row = await one(
      db,
      "INSERT INTO crew_payments(job_id,user_id,amount_minor,reference,paid_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(job_id,user_id) DO NOTHING RETURNING *",
      [id, member.user_id, member.labour_cost_minor, b.confirmed_by, user.id],
    );
    if (row) paid.push(row);
  }
  if (paid.length) {
    await db.query(
      "INSERT INTO technician_payments(job_id,amount_minor,reference) SELECT $1,sum(amount_minor),$2 FROM crew_payments WHERE job_id=$1 ON CONFLICT(job_id) DO UPDATE SET amount_minor=excluded.amount_minor,reference=excluded.reference,paid_at=now()",
      [id, b.confirmed_by],
    );
    await audit(
      db,
      user.id,
      "project",
      j.project_id ||
        (
          await one(db, "SELECT project_id FROM orders WHERE id=$1", [
            j.order_id,
          ])
        ).project_id,
      "crew.paid",
      { job_id: id, payments: paid },
    );
  }
  return { paid, already_paid: paid.length === 0 };
}
