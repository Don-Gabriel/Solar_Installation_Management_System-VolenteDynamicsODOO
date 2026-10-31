import { buildApp } from "./app.js";
import { pool } from "./db.js";
const app = await buildApp({ logger: true });
await app.listen({
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "127.0.0.1",
});
async function close() {
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
