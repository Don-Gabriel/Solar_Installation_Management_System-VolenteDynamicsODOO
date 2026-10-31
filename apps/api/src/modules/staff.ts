import { audit, ensure, one, type Db } from "../db.js";
import type { User } from "../../../../packages/contracts/src/index.js";
export async function updateStaff(db: Db, actor: User, id: string, b: any) {
  await db.query("SELECT pg_advisory_xact_lock(991203)");
  const old = await one(
    db,
    "SELECT id,role,active,dispatch_enabled,skills,working_days FROM users WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(old, "Staff member not found", 404);
  ensure(
    id !== actor.id || b.active,
    "You cannot deactivate your own current session.",
    400,
  );
  if (old.role === "admin" && old.active && (!b.active || b.role !== "admin"))
    ensure(
      (
        await one(
          db,
          "SELECT count(*)::int n FROM users WHERE active AND role='admin'",
        )
      ).n > 1,
      "Keep at least one active administrator.",
    );
  await db.query(
    "UPDATE users SET role=$2,active=$3,dispatch_enabled=$4,skills=$5,working_days=$6 WHERE id=$1",
    [id, b.role, b.active, b.dispatch_enabled, b.skills, b.working_days],
  );
  if (!b.active) await db.query("DELETE FROM sessions WHERE user_id=$1", [id]);
  await audit(db, actor.id, "user", id, "staff.access_updated", {
    before: old,
    after: b,
    reason: b.reason,
  });
  return {
    saved: true,
    message:
      "Access updated. Review future appointments if availability or qualifications changed.",
  };
}
