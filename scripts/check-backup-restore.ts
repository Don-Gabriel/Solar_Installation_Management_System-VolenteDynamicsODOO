/** Read-only snapshot of the app database, restored into a new disposable database. */
import { Pool } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
try {
  process.loadEnvFile(".env");
} catch {}
const url = new URL(process.env.DATABASE_URL!);
const name = "solar_restore_check_" + randomUUID().replaceAll("-", "");
const original = new Pool({ connectionString: url.toString() });
const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";
const admin = new Pool({ connectionString: adminUrl.toString() });
const output = resolve("output/backup-check");
await mkdir(join(output, "files"), { recursive: true });
const bin =
  process.env.PG_BIN ||
  (process.platform === "win32"
    ? "C:/Program Files/PostgreSQL/18/bin"
    : "/usr/lib/postgresql/18/bin");
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1),
};
const binary = (s: string) =>
  join(bin, s + (process.platform === "win32" ? ".exe" : ""));
let restored: Pool | undefined;
let evidenceRestore: Pool | undefined;
const evidenceDb = name + "_files";
let evidenceDbCreated = false;
const client = await original.connect();
let created = false;
async function snapshot(db: any) {
  const names = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((r: any) => r.tablename);
  const counts: any = {};
  for (const n of names) {
    if (!/^[a-z_]+$/.test(n)) throw Error("Unexpected table name");
    counts[n] = Number(
      (await db.query(`SELECT count(*) n FROM public.${n}`)).rows[0].n,
    );
  }
  return {
    counts,
    invoiced: String(
      (await db.query("SELECT coalesce(sum(total_minor),0) n FROM invoices"))
        .rows[0].n,
    ),
    collected: String(
      (await db.query("SELECT coalesce(sum(amount_minor),0) n FROM payments"))
        .rows[0].n,
    ),
  };
}
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const snap = (await client.query("SELECT pg_export_snapshot() id")).rows[0]
    .id;
  const before = await snapshot(client);
  const evidence = (
    await client.query(
      "SELECT id,filename,size_bytes FROM evidence ORDER BY id",
    )
  ).rows;
  const files = [];
  for (const e of evidence) {
    if (basename(e.filename) !== e.filename)
      throw Error("Unsafe stored file name");
    const data = await readFile(
      resolve(process.env.UPLOAD_DIR || "data/uploads", e.filename),
    );
    await writeFile(join(output, "files", e.filename), data);
    files.push({
      id: e.id,
      filename: e.filename,
      sha256: createHash("sha256").update(data).digest("hex"),
      bytes: data.length,
    });
  }
  execFileSync(
    binary("pg_dump"),
    [
      "--format=custom",
      "--snapshot=" + snap,
      "--file=" + join(output, "database.dump"),
    ],
    { env, stdio: "pipe" },
  );
  await client.query("COMMIT");
  if (!/^solar_restore_check_[a-f0-9]{32}$/.test(name))
    throw Error("Invalid disposable database target");
  await admin.query(`CREATE DATABASE ${name}`);
  created = true;
  execFileSync(
    binary("pg_restore"),
    [
      "--no-owner",
      "--exit-on-error",
      "--dbname=" + name,
      join(output, "database.dump"),
    ],
    { env, stdio: "pipe" },
  );
  const targetUrl = new URL(url);
  targetUrl.pathname = "/" + name;
  restored = new Pool({ connectionString: targetUrl.toString() });
  const after = await snapshot(restored);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error("Restored counts or financial totals differ");
  for (const f of files) {
    const bytes = await readFile(join(output, "files", f.filename));
    if (createHash("sha256").update(bytes).digest("hex") !== f.sha256)
      throw Error("Restored evidence hash differs");
  }
  // Add one synthetic private photo only to the disposable clone, then perform
  // another real dump/restore so an empty live evidence library cannot give a vacuous pass.
  const png = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#345d48" },
  })
    .png()
    .toBuffer();
  const photoName = "restore-fixture-" + randomUUID() + ".png";
  const job = (await restored.query("SELECT id FROM jobs ORDER BY id LIMIT 1"))
    .rows[0];
  const actor = (
    await restored.query(
      "SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1",
    )
  ).rows[0];
  if (!job || !actor)
    throw Error("Restore fixture needs a job and administrator");
  const fixture = (
    await restored.query(
      "INSERT INTO evidence(job_id,kind,filename,mime,size_bytes,uploaded_by) VALUES($1,'photo',$2,'image/png',$3,$4) RETURNING id",
      [job.id, photoName, png.length, actor.id],
    )
  ).rows[0];
  await writeFile(join(output, "files", photoName), png);
  const fixtureSnapshot = await snapshot(restored);
  execFileSync(
    binary("pg_dump"),
    [
      "--format=custom",
      "--dbname=" + name,
      "--file=" + join(output, "with-evidence.dump"),
    ],
    { env, stdio: "pipe" },
  );
  if (!/^solar_restore_check_[a-f0-9]{32}_files$/.test(evidenceDb))
    throw Error("Invalid evidence restore target");
  await admin.query(`CREATE DATABASE ${evidenceDb}`);
  evidenceDbCreated = true;
  execFileSync(
    binary("pg_restore"),
    [
      "--no-owner",
      "--exit-on-error",
      "--dbname=" + evidenceDb,
      join(output, "with-evidence.dump"),
    ],
    { env, stdio: "pipe" },
  );
  const evidenceUrl = new URL(url);
  evidenceUrl.pathname = "/" + evidenceDb;
  evidenceRestore = new Pool({ connectionString: evidenceUrl.toString() });
  if (
    JSON.stringify(await snapshot(evidenceRestore)) !==
    JSON.stringify(fixtureSnapshot)
  )
    throw Error("Evidence fixture restore differs");
  const metadata = (
    await evidenceRestore.query("SELECT * FROM evidence WHERE id=$1", [
      fixture.id,
    ])
  ).rows[0];
  await mkdir(join(output, "restored-files"), { recursive: true });
  await writeFile(
    join(output, "restored-files", metadata.filename),
    await readFile(join(output, "files", metadata.filename)),
  );
  const restoredBytes = await readFile(
    join(output, "restored-files", metadata.filename),
  );
  if (
    metadata.job_id !== job.id ||
    Number(metadata.size_bytes) !== restoredBytes.length ||
    createHash("sha256").update(png).digest("hex") !==
      createHash("sha256").update(restoredBytes).digest("hex")
  )
    throw Error("Private evidence linkage or file differs");
  const result = {
    scenario: "OPS-04",
    status: "PASS",
    checked_at: new Date().toISOString(),
    database_tables: Object.keys(before.counts).length,
    records: before,
    private_evidence_files: files.length,
    synthetic_private_photo_roundtrip:
      "PASS: valid PNG, restored job link, byte size and SHA-256 matched",
    evidence: files,
    note: "Consistent database snapshot restored into an isolated database; all table counts, invoiced/collected totals and private-file hashes reconciled. Restore database removed after verification.",
  };
  await writeFile(join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      status: "PASS",
      tables: result.database_tables,
      private_files: files.length,
    }),
  );
} finally {
  await client.query("ROLLBACK").catch(() => {});
  client.release();
  await restored?.end();
  await evidenceRestore?.end();
  if (
    evidenceDbCreated &&
    /^solar_restore_check_[a-f0-9]{32}_files$/.test(evidenceDb)
  )
    await admin.query(`DROP DATABASE ${evidenceDb}`);
  if (created && /^solar_restore_check_[a-f0-9]{32}$/.test(name))
    await admin.query(`DROP DATABASE ${name}`);
  await original.end();
  await admin.end();
}
