import { checkReady } from "./parts.js";
import { audit, ensure, one, pool, type Db } from "../db.js";
import type { User } from "../../../../packages/contracts/src/index.js";
import { openTask } from "./operational-tasks.js";

export const bufferMinutes = 30;
export async function extendVisit(db: Db, user: User, id: string, b: any) {
  await db.query("SELECT pg_advisory_xact_lock(902636)");
  const initial = await one(db, "SELECT ticket_id FROM visits WHERE id=$1", [
    id,
  ]);
  if (initial?.ticket_id)
    await one(db, "SELECT id FROM tickets WHERE id=$1 FOR UPDATE", [
      initial.ticket_id,
    ]);
  const v = await accessibleVisit(db, user, id);
  ensure(
    v.status === "in_progress" && v.version === b.version,
    "Only the current in-progress appointment can be extended.",
  );
  const end = new Date(b.ends_at);
  ensure(
    +end > +new Date(v.ends_at) &&
      +end - +new Date(v.starts_at) <= 12 * 3600000,
    "Choose a later end within 12 hours of the start.",
    400,
  );
  const crew = (
    await db.query(
      "SELECT user_id FROM visit_crew WHERE visit_id=$1 ORDER BY user_id",
      [id],
    )
  ).rows.map((r) => r.user_id);
  await db.query(
    "SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [crew],
  );
  const conflicts = (
    await db.query(
      "SELECT DISTINCT other.* FROM visits other JOIN visit_crew c ON c.visit_id=other.id WHERE c.user_id=ANY($1::uuid[]) AND other.id<>$2 AND other.status='scheduled' AND other.starts_at<$3::timestamptz+interval '30 minutes' AND other.ends_at>$4::timestamptz",
      [crew, id, b.ends_at, v.ends_at],
    )
  ).rows;
  const jobs = (
    await db.query(
      "SELECT DISTINCT j.id,o.project_id FROM jobs j JOIN orders o ON o.id=j.order_id LEFT JOIN job_crew jc ON jc.job_id=j.id WHERE (j.technician_id=ANY($1::uuid[]) OR jc.user_id=ANY($1::uuid[])) AND j.status='scheduled' AND j.scheduled_at<$2::timestamptz+interval '30 minutes' AND j.scheduled_at+make_interval(hours=>j.duration_hours)>$3::timestamptz",
      [crew, b.ends_at, v.ends_at],
    )
  ).rows;
  await db.query(
    "UPDATE visits SET ends_at=$2,reason=$3,version=version+1 WHERE id=$1",
    [id, b.ends_at, b.reason],
  );
  for (const c of conflicts) {
    await openTask(
      db,
      user.id,
      c.project_id,
      "overrun",
      "Earlier job overran. Reassign or explicitly reschedule this appointment: " +
        b.reason,
      c.ticket_id,
      c.id,
    );
    await openTask(
      db,
      user.id,
      c.project_id,
      "customer_contact",
      "Notify customer of possible delay and record an agreed appointment.",
      c.ticket_id,
      c.id,
    );
  }
  for (const j of jobs)
    await openTask(
      db,
      user.id,
      j.project_id,
      "overrun",
      "Installation may be delayed by repair visit " + id + ": " + b.reason,
    );
  await audit(db, user.id, "project", v.project_id, "visit.extended", {
    visit_id: id,
    before: v.ends_at,
    after: b.ends_at,
    reason: b.reason,
    affected_visits: conflicts.map((c) => c.id),
    affected_jobs: jobs.map((j) => j.id),
  });
  return {
    saved: true,
    affected_visits: conflicts.map((c) => c.id),
    affected_jobs: jobs.map((j) => j.id),
  };
}
export async function eligible(
  db: Pick<Db, "query">,
  tech: any,
  start: string,
  end: string,
  skill: string,
  excludeVisit: string | null = null,
  excludeJob: string | null = null,
) {
  const local = new Date(new Date(start).getTime() + 330 * 60000),
    finish = new Date(new Date(end).getTime() + 330 * 60000);
  if (!tech.active || !tech.dispatch_enabled)
    return "Inactive or unavailable for dispatch";
  if (!tech.skills.includes(skill)) return "Required skill is missing";
  if (!tech.working_days.includes(local.getUTCDay())) return "Nonworking day";
  if (
    await one(db, "SELECT day FROM company_holidays WHERE day=$1::date", [
      local.toISOString().slice(0, 10),
    ])
  )
    return "Company holiday";
  if (
    local.getUTCHours() < 9 ||
    finish.getUTCHours() > 17 ||
    (finish.getUTCHours() === 17 && finish.getUTCMinutes() > 0) ||
    local.toISOString().slice(0, 10) !== finish.toISOString().slice(0, 10)
  )
    return "Outside 09:00–17:00 IST working hours";
  const leave = await one(
    db,
    "SELECT id FROM staff_leave WHERE user_id=$1 AND starts_at<$3 AND ends_at>$2",
    [tech.id, start, end],
  );
  if (leave) return "On leave";
  const conflict = await one(
    db,
    `SELECT j.id FROM jobs j WHERE (technician_id=$1 OR EXISTS(SELECT 1 FROM job_crew jc WHERE jc.job_id=j.id AND jc.user_id=$1)) AND ($4::uuid IS NULL OR j.id<>$4) AND status IN ('scheduled','in_progress') AND scheduled_at<$3::timestamptz+interval '30 minutes' AND scheduled_at+make_interval(hours=>duration_hours)>$2::timestamptz-interval '30 minutes'
 UNION ALL SELECT v.id FROM visits v JOIN visit_crew c ON c.visit_id=v.id WHERE c.user_id=$1 AND ($5::uuid IS NULL OR v.id<>$5) AND v.status IN ('scheduled','in_progress') AND v.starts_at<$3::timestamptz+interval '30 minutes' AND v.ends_at>$2::timestamptz-interval '30 minutes' LIMIT 1`,
    [tech.id, start, end, excludeJob, excludeVisit],
  );
  return conflict ? "Already booked or travel buffer needed" : null;
}
export async function availability(
  q: any,
  seekAlternative = true,
): Promise<any> {
  const from = new Date(q.from + "T00:00:00+05:30"),
    to = new Date(q.to + "T00:00:00+05:30");
  ensure(
    Number.isFinite(+from) &&
      Number.isFinite(+to) &&
      to >= from &&
      +to - +from <= 14 * 86400000,
    "Choose a date range of at most 15 days.",
    400,
  );
  const techs = (
    await pool.query(
      "SELECT u.id,u.name,u.skills,u.working_days,u.active,u.dispatch_enabled,((SELECT coalesce(sum(extract(epoch FROM (v.ends_at-v.starts_at))/3600),0) FROM visits v JOIN visit_crew vc ON vc.visit_id=v.id WHERE vc.user_id=u.id AND v.status IN ('scheduled','in_progress') AND v.starts_at >= $1::date AND v.starts_at < $2::date+interval '1 day')+(SELECT coalesce(sum(j.duration_hours),0) FROM jobs j WHERE (j.technician_id=u.id OR EXISTS(SELECT 1 FROM job_crew jc WHERE jc.job_id=j.id AND jc.user_id=u.id)) AND j.status IN ('scheduled','in_progress') AND j.scheduled_at >= $1::date AND j.scheduled_at < $2::date+interval '1 day'))::float AS booked_hours FROM users u WHERE u.role='technician' ORDER BY booked_hours,u.name,u.id",
      [q.from, q.to],
    )
  ).rows;
  const slots = [];
  for (let day = +from; day <= +to; day += 86400000) {
    for (let hour = 9; hour + q.duration_hours <= 17; hour++) {
      const start = new Date(day + hour * 3600000).toISOString(),
        end = new Date(day + (hour + q.duration_hours) * 3600000).toISOString();
      if (new Date(start).getTime() < Date.now()) continue;
      const candidates = [];
      for (const t of techs) {
        if (
          !(await eligible(
            pool,
            t,
            start,
            end,
            q.skill,
            q.visit_id || null,
            q.job_id || null,
          ))
        )
          candidates.push({
            id: t.id,
            name: t.name,
            can_lead: t.skills.includes("crew_lead"),
            reason: `Qualified and free; ${t.booked_hours} booked hours in this window; 30-minute travel buffer; ties use name then staff ID`,
            booked_hours: t.booked_hours,
          });
      }
      if (
        candidates.length >= q.crew_size &&
        candidates.some((t) => t.can_lead)
      )
        slots.push({ starts_at: start, ends_at: end, candidates });
    }
  }
  let alternatives: any[] = [];
  if (!slots.length && seekAlternative) {
    const next = new Date(+to + 86400000),
      last = new Date(+to + 7 * 86400000);
    const later = await availability(
      {
        ...q,
        from: new Date(+next + 330 * 60000).toISOString().slice(0, 10),
        to: new Date(+last + 330 * 60000).toISOString().slice(0, 10),
      },
      false,
    );
    alternatives = later.slots.slice(0, 3);
  }
  return {
    alternative_slots: alternatives,
    slots,
    technicians: techs.map(({ id, name, skills }) => ({ id, name, skills })),
    window: { from: q.from, to: q.to },
    message: slots.length
      ? "Choose a suitable slot and crew. Availability is checked again when you confirm."
      : "No suitable crew in this window. Widen the dates or escalate to the coordinator.",
    buffer_minutes: bufferMinutes,
  };
}
export async function bookVisit(db: Db, user: User, b: any) {
  await db.query("SELECT pg_advisory_xact_lock(902636)");
  let ticket = null;
  if (b.ticket_id) {
    ticket = await one(db, "SELECT * FROM tickets WHERE id=$1 FOR UPDATE", [
      b.ticket_id,
    ]);
    ensure(ticket, "Ticket not found", 404);
    await checkReady(db, ticket.id);
    ensure(
      !["closed", "cancelled", "awaiting_confirmation"].includes(ticket.status),
      "This ticket cannot be scheduled.",
    );
  }
  const projectId = ticket?.project_id || b.project_id;
  ensure(projectId, "Select a site.", 400);
  ensure(
    await one(
      db,
      "SELECT id FROM projects WHERE id=$1 AND cancelled_at IS NULL FOR UPDATE",
      [projectId],
    ),
    "Project not found",
    404,
  );
  let previous = null;
  if (b.visit_id) {
    previous = await one(db, "SELECT * FROM visits WHERE id=$1 FOR UPDATE", [
      b.visit_id,
    ]);
    ensure(
      previous &&
        previous.project_id === projectId &&
        previous.ticket_id === (b.ticket_id || null),
      "Visit does not match this request",
      404,
    );
    ensure(
      previous.status === "scheduled",
      "Only a scheduled visit can be moved.",
    );
    ensure(
      previous.version === b.version,
      "This appointment changed. Reload before rescheduling.",
    );
  }
  const ids = [...new Set<string>(b.technician_ids)].sort();
  ensure(
    ids.length === b.technician_ids.length,
    "Choose each worker only once.",
    400,
  );
  ensure(ids.includes(b.lead_id), "Lead must belong to the crew.", 400);
  const techs = (
    await db.query(
      "SELECT * FROM users WHERE id=ANY($1::uuid[]) AND role='technician' ORDER BY id FOR UPDATE",
      [ids],
    )
  ).rows;
  ensure(techs.length === ids.length, "Choose active technicians.");
  const start = new Date(b.starts_at),
    end = new Date(+start + b.duration_hours * 3600000);
  ensure(+start > Date.now(), "Choose a future visit time.");
  for (const t of techs) {
    const why = await eligible(
      db,
      t,
      start.toISOString(),
      end.toISOString(),
      b.skill,
      previous?.id,
    );
    ensure(!why, `${t.name}: ${why}`);
  }
  ensure(
    techs.find((t) => t.id === b.lead_id)?.skills.includes("crew_lead"),
    "Choose a qualified crew lead.",
  );
  if (ticket && !previous)
    ensure(
      !(await one(
        db,
        "SELECT id FROM visits WHERE ticket_id=$1 AND status IN ('scheduled','in_progress')",
        [ticket.id],
      )),
      "This ticket already has an active appointment. Reschedule it or finish that visit first.",
    );
  const visit = previous
    ? await one(
        db,
        "UPDATE visits SET starts_at=$2,ends_at=$3,required_skill=$4,version=version+1,reason=$5 WHERE id=$1 RETURNING *",
        [previous.id, start, end, b.skill, b.reason || "Rescheduled"],
      )
    : await one(
        db,
        "INSERT INTO visits(project_id,ticket_id,kind,starts_at,ends_at,required_skill,created_by,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          projectId,
          ticket?.id || null,
          ticket ? "repair" : "survey",
          start,
          end,
          b.skill,
          user.id,
          b.reason || "",
        ],
      );
  await db.query("DELETE FROM visit_crew WHERE visit_id=$1", [visit.id]);
  for (const id of ids)
    await db.query(
      "INSERT INTO visit_crew(visit_id,user_id,is_lead) VALUES($1,$2,$3)",
      [visit.id, id, id === b.lead_id],
    );
  await db.query(
    "UPDATE visits SET acknowledgement_due_at=LEAST(now()+interval '4 hours',starts_at-interval '30 minutes') WHERE id=$1",
    [visit.id],
  );
  if (previous)
    await openTask(
      db,
      user.id,
      projectId,
      "customer_contact",
      "Tell the customer about the changed appointment and record their response.",
      ticket?.id || null,
      visit.id,
    );
  if (ticket)
    await db.query(
      "UPDATE tickets SET assigned_to=$2,status='scheduled',version=version+1 WHERE id=$1",
      [ticket.id, b.lead_id],
    );
  await audit(
    db,
    user.id,
    "project",
    projectId,
    previous ? "visit.rescheduled" : "visit.scheduled",
    {
      visit_id: visit.id,
      crew: ids,
      starts_at: start,
      previous_start: previous?.starts_at,
    },
  );
  return visit;
}
export async function accessibleVisit(db: Db, user: User, id: string) {
  const v = await one(db, "SELECT * FROM visits WHERE id=$1 FOR UPDATE", [id]);
  ensure(v, "Visit not found", 404);
  if (user.role === "surveyor")
    ensure(
      v.kind === "survey",
      "Survey staff cannot change repair visits.",
      403,
    );
  if (user.role === "technician")
    ensure(
      await one(
        db,
        "SELECT 1 FROM visit_crew WHERE visit_id=$1 AND user_id=$2",
        [id, user.id],
      ),
      "This visit belongs to another crew.",
      403,
    );
  return v;
}
export async function visitAction(db: Db, user: User, id: string, b: any) {
  const initial = await one(db, "SELECT ticket_id FROM visits WHERE id=$1", [
    id,
  ]);
  if (initial?.ticket_id)
    await one(db, "SELECT id FROM tickets WHERE id=$1 FOR UPDATE", [
      initial.ticket_id,
    ]);
  const v = await accessibleVisit(db, user, id);
  ensure(
    v.version === b.version,
    "This visit changed. Reload before updating.",
  );
  if (b.action === "acknowledge") {
    ensure(
      v.status === "scheduled",
      "Only a scheduled visit can be acknowledged.",
    );
    const own = await one(
      db,
      "UPDATE visit_crew SET acknowledged_at=now() WHERE visit_id=$1 AND user_id=$2 RETURNING user_id",
      [id, user.id],
    );
    ensure(
      own,
      "Only a named crew member can acknowledge their own attendance.",
      403,
    );
    await db.query("UPDATE visits SET version=version+1 WHERE id=$1", [id]);
  } else if (b.action === "start") {
    ensure(v.status === "scheduled", "Only a scheduled visit can start.");
    await db.query(
      "UPDATE visits SET status='in_progress',started_at=now(),version=version+1 WHERE id=$1",
      [id],
    );
    if (v.ticket_id)
      await db.query(
        "UPDATE tickets SET status='in_progress',version=version+1 WHERE id=$1",
        [v.ticket_id],
      );
  } else {
    ensure(
      ["scheduled", "in_progress"].includes(v.status),
      "This visit is no longer active.",
    );
    ensure(b.reason?.trim(), "Record a reason.", 400);
    const status =
      b.action === "no_access"
        ? "no_access"
        : b.action === "diagnosis_done"
          ? "completed"
          : "cancelled";
    await db.query(
      "UPDATE visits SET status=$2,reason=$3,completed_at=now(),version=version+1 WHERE id=$1",
      [id, status, b.reason],
    );
    if (v.ticket_id)
      await db.query(
        "UPDATE tickets SET status=CASE WHEN $2='completed' THEN 'waiting_parts' ELSE 'open' END,version=version+1 WHERE id=$1",
        [v.ticket_id, status],
      );
    if (b.action === "diagnosis_done" && v.ticket_id)
      await openTask(
        db,
        user.id,
        v.project_id,
        "parts",
        "Diagnosis complete; review parts and arrange a separate return visit.",
        v.ticket_id,
      );
    if (b.action === "no_access" || b.action === "decline") {
      await openTask(
        db,
        user.id,
        v.project_id,
        "reschedule",
        b.action === "decline"
          ? "Worker declined: " + b.reason
          : "No access: " + b.reason,
        v.ticket_id,
        id,
      );
      await openTask(
        db,
        user.id,
        v.project_id,
        "customer_contact",
        "Contact customer and agree a new appointment: " + b.reason,
        v.ticket_id,
        id,
      );
      if (v.ticket_id)
        await db.query("UPDATE tickets SET assigned_to=NULL WHERE id=$1", [
          v.ticket_id,
        ]);
    }
  }
  await audit(db, user.id, "project", v.project_id, "visit." + b.action, {
    visit_id: id,
    reason: b.reason,
  });
  return { saved: true };
}
export async function addLeave(db: Db, user: User, b: any) {
  await db.query("SELECT pg_advisory_xact_lock(902636)");
  const tech = await one(
    db,
    "SELECT * FROM users WHERE id=$1 AND role='technician' FOR UPDATE",
    [b.user_id],
  );
  ensure(tech, "Technician not found", 404);
  ensure(
    new Date(b.ends_at) > new Date(b.starts_at),
    "Leave end must follow start.",
    400,
  );
  const row = await one(
    db,
    "INSERT INTO staff_leave(user_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [b.user_id, b.starts_at, b.ends_at, b.reason, user.id],
  );
  const affected = (
    await db.query(
      "SELECT v.* FROM visits v JOIN visit_crew vc ON vc.visit_id=v.id WHERE vc.user_id=$1 AND v.status='scheduled' AND v.starts_at<$3 AND v.ends_at>$2",
      [b.user_id, b.starts_at, b.ends_at],
    )
  ).rows;
  for (const v of affected) {
    await openTask(
      db,
      user.id,
      v.project_id,
      "reschedule",
      "Assigned worker is on leave: " + b.reason,
      v.ticket_id,
      v.id,
    );
    await openTask(
      db,
      user.id,
      v.project_id,
      "customer_contact",
      "Confirm any appointment change caused by worker leave.",
      v.ticket_id,
      v.id,
    );
  }
  await audit(db, user.id, "user", b.user_id, "leave.recorded", {
    ...row,
    warning: "Review existing assignments and reassign affected visits.",
  });
  return row;
}
