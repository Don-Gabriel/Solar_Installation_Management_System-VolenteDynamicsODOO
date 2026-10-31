import { one, transaction } from "../../apps/api/src/db.js";

export async function seedCustomerPortal(passwordHash: string) {
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(902639)");
    const result = [];
    for (const [name, email] of [
      ["Lakshmi Iyer", "lakshmi.customer@sunpower.local"],
      ["Sneha & Arun", "sneha.customer@sunpower.local"],
    ]) {
      const customer = await one(
        db,
        "SELECT c.id,c.name,p.id AS project_id FROM customers c JOIN sites s ON s.customer_id=c.id JOIN projects p ON p.site_id=s.id WHERE c.name=$1 ORDER BY p.created_at,p.id LIMIT 1",
        [name],
      );
      if (!customer) continue;
      const existing = await one(
        db,
        "SELECT id FROM users WHERE lower(email)=lower($1)",
        [email],
      );
      if (!existing) {
        await db.query(
          "INSERT INTO users(name,email,password_hash,role,customer_id,dispatch_enabled,skills,working_days,hourly_rate_minor) VALUES($1,$2,$3,'customer',$4,false,'{}','{}',0)",
          [name, email, passwordHash, customer.id],
        );
        await db.query(
          "INSERT INTO customer_notifications(customer_id,project_id,title,body) VALUES($1,$2,'Welcome to your customer portal','This is a synthetic demo account. Your own visits, repair updates and bills appear here. Future updates arrive in this inbox; no SMS or email is sent.')",
          [customer.id, customer.project_id],
        );
      }
      result.push({ name, email });
    }
    return result;
  });
}
