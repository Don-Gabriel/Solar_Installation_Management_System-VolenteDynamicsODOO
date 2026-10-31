import argon2 from "argon2";
import { pool } from "../apps/api/src/db.js";
import { seedCustomerPortal } from "../db/seeds/customer-portal.js";
try {
  if (process.env.DEMO_TOOLS !== "true")
    throw Error("Customer demo setup requires DEMO_TOOLS=true.");
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw Error("Set a demo password of at least 12 characters.");
  console.log(await seedCustomerPortal(await argon2.hash(password)));
} finally {
  await pool.end();
}
