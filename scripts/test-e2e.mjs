import pg from "pg";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, openSync, closeSync } from "node:fs";
try {
  loadEnvFile(".env");
} catch {}
const schema = `solar_e2e_${randomUUID().replaceAll("-", "")}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let server;
let logFd;
try {
  await db.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  const probe = createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const baseURL = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    PORT: String(port),
    HOST: "127.0.0.1",
    UPLOAD_DIR: `./tmp/test-uploads/${schema}`,
    RATE_LIMIT_MAX: "3000",
    TEST_BASE_URL: baseURL,
    APP_ORIGINS: baseURL,
  };
  const scoped = new pg.Pool({ connectionString: env.DATABASE_URL });
  for (const file of (await readdir("db/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await scoped.query(await readFile(`db/migrations/${file}`, "utf8"));
  await scoped.end();
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "db/seeds/demo.ts"],
    { env, stdio: "inherit" },
  );
  mkdirSync("output/qa", { recursive: true });
  logFd = openSync("output/qa/e2e-server.log", "w");
  server = spawn(
    process.execPath,
    ["--import", "tsx", "apps/api/src/server.ts"],
    { env, stdio: ["ignore", logFd, logFd] },
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${baseURL}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null)
      throw Error("Test server stopped. See output/qa/e2e-server.log");
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw Error("Test server failed to start");
  const test = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    { env, stdio: "inherit" },
  );
  const code = await new Promise((r) => test.on("exit", r));
  process.exitCode = code === 0 ? 0 : 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((r) => server.once("exit", r)),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }
  if (logFd !== undefined) closeSync(logFd);
  if (/^solar_e2e_[a-f0-9]{32}$/.test(schema))
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
  await db.end();
}
