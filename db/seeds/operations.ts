import { transaction, one, audit } from "../../apps/api/src/db.js";
export async function seedOperations(hash: string) {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(902634)");
    if (
      await one(db, "SELECT key FROM settings WHERE key='demo_operations_v1'")
    )
      return;
    for (const [name, email] of [
      ["Isha Raman", "coordinator@sunpower.local"],
      ["Vishal Nair", "vishal@sunpower.local"],
    ])
      await db.query(
        "INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,'coordinator',$3) ON CONFLICT(lower(email)) DO NOTHING",
        [name, email, hash],
      );
    // Keep historical identities and ongoing assignments. Only the original 15 form the new-dispatch roster.
    await db.query(
      "UPDATE users SET dispatch_enabled=false WHERE role='technician' AND lower(email)=ANY($1)",
      [
        [
          "deepa@sunpower.local",
          "manoj@sunpower.local",
          "rekha@sunpower.local",
          "suresh@sunpower.local",
        ],
      ],
    );
    const admin = await one(
      db,
      "SELECT * FROM users WHERE email='admin@sunpower.local'",
    );
    const techs = (
      await db.query(
        "SELECT * FROM users WHERE role='technician' AND dispatch_enabled ORDER BY name",
      )
    ).rows;
    const project = await one(
      db,
      "SELECT id FROM projects WHERE stage='completed' ORDER BY number LIMIT 1",
    );
    const dates = [];
    for (let offset = 3; offset <= 5; offset++) {
      const day = new Date(Date.now() + offset * 86400000).toLocaleDateString(
        "en-CA",
        { timeZone: "Asia/Kolkata" },
      );
      const start = new Date(day + "T13:00:00+05:30"),
        end = new Date(day + "T15:00:00+05:30");
      if (start.getUTCDay() === 0) continue;
      dates.push(day);
      for (const t of techs.slice(0, 13)) {
        const overlap = await one(
          db,
          "SELECT id FROM jobs WHERE technician_id=$1 AND status<>'completed' AND scheduled_at<$3::timestamptz+interval '30 minutes' AND scheduled_at+make_interval(hours=>duration_hours)>$2::timestamptz-interval '30 minutes'",
          [t.id, start, end],
        );
        if (overlap) continue;
        const v = await one(
          db,
          "INSERT INTO visits(project_id,kind,starts_at,ends_at,required_skill,created_by,reason) VALUES($1,'survey',$2,$3,'survey',$4,'Synthetic scheduling demonstration: busy afternoon interval') RETURNING id",
          [project.id, start, end, admin.id],
        );
        await db.query(
          "INSERT INTO visit_crew(visit_id,user_id,is_lead) VALUES($1,$2,true)",
          [v.id, t.id],
        );
      }
    }
    await db.query(
      "INSERT INTO settings(key,value) VALUES('demo_operations_v1',$1)",
      [
        JSON.stringify({
          dates,
          free_technicians: techs.slice(13).map((t) => t.name),
          time: "13:00–15:00 IST",
          roster: techs.length,
        }),
      ],
    );
    await audit(db, admin.id, "user", admin.id, "demo.operations_seeded", {
      dispatch_roster: techs.length,
      coordinators: 2,
    });
    console.log(
      "Added two service coordinators, 15-person dispatch roster and busy afternoon scheduling examples. Historical accounts and jobs preserved.",
    );
  });
}
