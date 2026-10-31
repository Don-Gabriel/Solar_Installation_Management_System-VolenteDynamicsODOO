/** Explicitly requested local demo reset: preserve the old database, activate a fresh one. */
import { Pool } from "pg";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
process.loadEnvFile(".env");
if (process.env.DEMO_TOOLS !== "true" || process.env.NODE_ENV === "production")
  throw Error("Only an explicitly enabled local demo can be restored.");
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const saved = resolve("output/backups/before-demo-reset-" + stamp);
await mkdir(saved, { recursive: true });
await cp(".env", saved + "/environment.env");
await cp("output/backup-check", saved + "/verified-backup", {
  recursive: true,
});
const oldUrl = new URL(process.env.DATABASE_URL);
const adminUrl = new URL(oldUrl);
adminUrl.pathname = "/postgres";
const admin = new Pool({ connectionString: adminUrl.toString() });
const name = "solar_demo_" + stamp;
if (!/^solar_demo_[0-9]+$/.test(name))
  throw Error("Invalid demo database name");
await admin.query(`CREATE DATABASE "${name}"`);
await admin.end();
const fresh = new URL(oldUrl);
fresh.pathname = "/" + name;
const uploads = "./data/uploads/" + name;
const env = {
  ...process.env,
  DATABASE_URL: fresh.toString(),
  UPLOAD_DIR: uploads,
};
for (const script of [
  "scripts/migrate.ts",
  "db/seeds/demo.ts",
  "scripts/seed-service-rehearsal.ts",
])
  execFileSync(process.execPath, ["--import", "tsx", script], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
const db = new Pool({ connectionString: fresh.toString() });
const counts = (
  await db.query(
    "SELECT (SELECT count(*)::int FROM projects) projects,(SELECT count(*)::int FROM users WHERE role<>'customer') staff,(SELECT count(*)::int FROM users WHERE role='customer') customers,(SELECT count(*)::int FROM assets) serials,(SELECT count(*)::int FROM users WHERE role='technician' AND dispatch_enabled AND active) dispatch_workers",
  )
).rows[0];
await db.end();
if (
  counts.projects !== 40 ||
  counts.staff !== 34 ||
  counts.customers !== 2 ||
  counts.serials !== 198 ||
  counts.dispatch_workers !== 15
)
  throw Error("Unexpected seed counts: " + JSON.stringify(counts));
let text = await readFile(".env", "utf8");
text = text.replace(/^DATABASE_URL=.*$/m, "DATABASE_URL=" + fresh.toString());
if (/^UPLOAD_DIR=/m.test(text))
  text = text.replace(/^UPLOAD_DIR=.*$/m, "UPLOAD_DIR=" + uploads);
else text += "\nUPLOAD_DIR=" + uploads + "\n";
await writeFile(".env", text);
await writeFile(
  saved + "/restoration.json",
  JSON.stringify(
    {
      created_at: new Date().toISOString(),
      retained_database: oldUrl.pathname.slice(1),
      fresh_database: name,
      counts,
      upload_directory: uploads,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    restored: true,
    backup: saved,
    old_database_preserved: true,
    counts,
    upload_directory: uploads,
  }),
);
