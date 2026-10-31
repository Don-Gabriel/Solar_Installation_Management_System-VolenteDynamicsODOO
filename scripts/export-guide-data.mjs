import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const assets = (
    await db.query(
      "SELECT a.serial,a.status,p.sku,p.name AS product_name FROM assets a JOIN products p ON p.id=a.product_id ORDER BY p.sku,a.serial",
    )
  ).rows;
  const users = (
    await db.query("SELECT name,email,role FROM users ORDER BY role,name")
  ).rows;
  const projects = (
    await db.query(
      "SELECT p.id,p.number,p.stage,c.name AS customer_name FROM projects p JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id ORDER BY p.number",
    )
  ).rows;
  await mkdir("output/guide-data", { recursive: true });
  await writeFile(
    "output/guide-data/demo.json",
    JSON.stringify(
      { generated_at: new Date().toISOString(), assets, users, projects },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      barcodes: assets.length,
      staff: users.length,
      projects: projects.length,
    }),
  );
} finally {
  await db.end();
}
