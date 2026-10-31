import pg from "pg";
import type { PoolClient } from "pg";
pg.types.setTypeParser(20, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw Error("Integer exceeds safe range");
  return n;
});
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});
// Idle connections are discarded after a database restart; the next request reconnects.
pool.on("error", (error) => {
  console.error("Idle database connection closed:", error.message);
});
export type Db = PoolClient;
export async function transaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  let broken: Error | undefined;
  const connectionError = (error: Error) => {
    broken = error;
  };
  db.on("error", connectionError);
  try {
    await db.query("BEGIN");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      broken = rollbackError as Error;
    }
    throw e;
  } finally {
    db.release(broken);
    db.off("error", connectionError);
  }
}
export async function one(
  db: Pick<Db, "query">,
  sql: string,
  args: unknown[] = [],
) {
  return (await db.query(sql, args)).rows[0];
}
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "BUSINESS_RULE",
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  message: string,
  status = 409,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
export async function audit(
  db: Db,
  actor: string,
  entity: string,
  id: string,
  action: string,
  detail: unknown = {},
) {
  await db.query(
    "INSERT INTO audit_events(actor_id,entity_type,entity_id,action,detail) VALUES($1,$2,$3,$4,$5)",
    [actor, entity, id, action, JSON.stringify(detail)],
  );
}
