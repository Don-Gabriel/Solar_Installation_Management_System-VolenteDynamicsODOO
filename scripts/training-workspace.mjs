import { Pool } from "pg";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
export async function trainingWorkspace(baseUrl, name, reset = false) {
  if (!/^[a-z][a-z0-9_]{0,30}$/.test(name))
    throw Error(
      "Choose a training name using lowercase letters, digits and underscores.",
    );
  const schema = "solar_training_" + name;
  const admin = new Pool({ connectionString: baseUrl });
  const url = new URL(baseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  try {
    await admin.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [
      schema,
    ]);
    const exists = (
      await admin.query("SELECT 1 FROM pg_namespace WHERE nspname=$1", [schema])
    ).rowCount;
    if (exists) {
      if (!reset)
        throw Error(
          "Training workspace exists. Use --reset with its exact name to replay only this dataset.",
        );
      const marker = await admin.query(
        `SELECT name FROM ${schema}.training_workspace_marker`,
      );
      if (marker.rows.length !== 1 || marker.rows[0].name !== name)
        throw Error("This schema is not a verified training workspace.");
      // The identifier has a fixed training prefix and passed the strict name check above.
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    }
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new Pool({ connectionString: url.toString() });
    try {
      await scoped.query(
        "CREATE TABLE training_workspace_marker(name text PRIMARY KEY)",
      );
      await scoped.query("INSERT INTO training_workspace_marker VALUES($1)", [
        name,
      ]);
      for (const file of (await readdir("db/migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort())
        await scoped.query(await readFile("db/migrations/" + file, "utf8"));
    } finally {
      await scoped.end();
    }
    execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "db/seeds/demo.ts"],
      {
        env: {
          ...process.env,
          DATABASE_URL: url.toString(),
          DEMO_TOOLS: "true",
        },
        stdio: "pipe",
        windowsHide: true,
      },
    );
    return { schema, url: url.toString() };
  } finally {
    await admin
      .query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [schema])
      .catch(() => {});
    await admin.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.loadEnvFile(".env");
  } catch {}
  if (process.env.DEMO_TOOLS !== "true")
    throw Error("Enable DEMO_TOOLS for isolated training workspaces.");
  const name = process.argv[2];
  const result = await trainingWorkspace(
    process.env.DATABASE_URL,
    name,
    process.argv.includes("--reset"),
  );
  const path = `.env.training-${name}`;
  await writeFile(
    path,
    `DATABASE_URL=${result.url}\nPORT=3002\nHOST=127.0.0.1\nAPP_ORIGINS=http://127.0.0.1:3002\nDEMO_TOOLS=true\nUPLOAD_DIR=./tmp/training-uploads/${name}\nDEMO_PASSWORD=${process.env.DEMO_PASSWORD}\n`,
    { mode: 0o600 },
  );
  console.log(
    `Training workspace ${name} is ready. Operational data was not reset. Start a separate server with node --env-file=.env --env-file=${path} apps/api/dist/apps/api/src/server.js`,
  );
}
