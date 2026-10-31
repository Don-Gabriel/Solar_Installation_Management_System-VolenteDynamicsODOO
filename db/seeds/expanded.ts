import { transaction, one } from "../../apps/api/src/db.js";
import * as sales from "../../apps/api/src/modules/sales.js";
import * as stock from "../../apps/api/src/modules/inventory.js";
import * as field from "../../apps/api/src/modules/field.js";
export async function seedExpanded(hash: string) {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(902633)");
    if (
      await one(db, "SELECT key FROM settings WHERE key='demo_expanded_v1'")
    ) {
      console.log("Expanded demo already present; existing work preserved.");
      return;
    }
    const staff = [
      ["Leela Menon", "admin", "leela"],
      ["Rohit Joseph", "sales", "rohit"],
      ["Nandita Rao", "sales", "nandita"],
      ["Fathima Ali", "surveyor", "fathima"],
      ["George Paul", "warehouse", "george"],
      ["Anita Das", "support", "anita"],
      ["Farhan Ahmed", "accounts", "farhan"],
      ["Deepa Nair", "technician", "deepa"],
      ["Manoj Das", "technician", "manoj"],
      ["Rekha Thomas", "technician", "rekha"],
      ["Suresh Babu", "technician", "suresh"],
    ];
    for (const [name, role, alias] of staff)
      await db.query(
        "INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(lower(email)) DO NOTHING",
        [name, `${alias}@sunpower.local`, role, hash],
      );
    const admin = await one(
      db,
      "SELECT id,name,email,role FROM users WHERE email='admin@sunpower.local'",
    );
    const owners = (
      await db.query("SELECT id FROM users WHERE role='sales' ORDER BY name")
    ).rows;
    const surveyor = await one(
      db,
      "SELECT id FROM users WHERE email='surveyor@sunpower.local'",
    );
    const techs = (
      await db.query(
        "SELECT id FROM users WHERE email IN ('arjun@sunpower.local','dev@sunpower.local','deepa@sunpower.local','rekha@sunpower.local') ORDER BY email",
      )
    ).rows;
    for (const p of (
      await db.query(
        "SELECT * FROM products WHERE kind<>'service' ORDER BY sku",
      )
    ).rows) {
      const qty = p.kind === "serialized" ? 12 : 200;
      const prior = await one(
        db,
        "SELECT unit_cost_minor FROM receipts WHERE product_id=$1 ORDER BY created_at DESC LIMIT 1",
        [p.id],
      );
      await stock.receiveStock(db, admin.id, {
        product_id: p.id,
        supplier: "Synthetic Training Supplies",
        reference: `DEMO-EXP-${p.sku}`,
        quantity: qty,
        unit_cost_minor: prior?.unit_cost_minor || 10000,
        serials:
          p.kind === "serialized"
            ? Array.from(
                { length: qty },
                (_, i) => `SP-${p.sku}-T${String(i + 1).padStart(3, "0")}`,
              )
            : [],
      });
    }
    const names = [
      "Aarav Nair",
      "Bhavana Menon",
      "Cedar Learning Centre",
      "Dinesh Kumar",
      "Elsa Joseph",
      "Feroz Ali",
      "Gayathri Pillai",
      "Hari Krishnan",
      "Indira Thomas",
      "Jayan Mathew",
      "Kavya Das",
      "Lotus Dental Clinic",
      "Maya Nair",
      "Naveen Paul",
      "Olive Home Stay",
      "Prakash Rao",
      "Queens Bakery",
      "Reshma Babu",
      "Sajan George",
      "Tara Menon",
      "Uma Pillai",
      "Vivek Nair",
      "Willow Community Hall",
      "Yamini Das",
      "Zoya Rahman",
      "Anand Balan",
      "Beena Thomas",
      "Coral Workshop",
    ];
    for (let i = 0; i < names.length; i++) {
      const stage = i % 7,
        capacity = (i % 5) + 1,
        system = i % 3 === 0 ? "off_grid" : "on_grid";
      const p = await sales.createEnquiry(db, admin.id, {
        name: names[i],
        phone: `980100${String(i + 1).padStart(4, "0")}`,
        address: `Synthetic site ${i + 1}, ${["Kakkanad", "Aluva", "Edappally", "Vyttila"][i % 4]}, Kochi`,
        capacity_kw: capacity,
        system_type: system,
        source: ["Referral", "Phone", "Website", "Walk-in"][i % 4],
        notes:
          "Synthetic training customer. No real personal information. Use this record to practise the next step.",
        owner_id: owners[i % owners.length].id,
        subsidy_interest: system === "on_grid",
        follow_up: new Date().toISOString().slice(0, 10),
      });
      if (stage === 0) continue;
      await sales.saveSurvey(db, surveyor.id, p.id, {
        roof_area: capacity * 12,
        bill_minor: capacity * 130000,
        grid_suitable: true,
        direction: "South",
        tilt: 12,
        cable_distance: 18,
        notes: "Synthetic measured values for training.",
      });
      if (stage === 1) continue;
      await sales.approveSurvey(db, surveyor.id, p.id, { approved: true });
      if (stage === 2) continue;
      await sales.issueQuote(db, owners[i % owners.length].id, p.id);
      if (stage === 3) continue;
      const order = await sales.acceptQuote(db, admin.id, p.id);
      if (stage === 4) continue;
      const invoice = await one(
        db,
        "SELECT id FROM invoices WHERE order_id=$1 AND kind='installation'",
        [order.id],
      );
      await sales.recordPayment(db, admin.id, invoice.id, {
        amount_minor: order.minimum_advance_minor,
        method: "bank",
        reference: `DEMO-EXP-PAY-${i}`,
      });
      await stock.reserveStock(db, admin.id, order.id);
      if (stage === 5) continue;
      for (const line of (
        await db.query(
          "SELECT * FROM order_lines WHERE order_id=$1 AND kind='serialized'",
          [order.id],
        )
      ).rows) {
        const assets = (
          await db.query(
            "SELECT serial FROM assets WHERE product_id=$1 AND status='available' ORDER BY serial LIMIT $2",
            [line.product_id, line.quantity],
          )
        ).rows;
        for (const a of assets)
          await stock.scanAsset(db, admin.id, order.id, { serial: a.serial });
      }
      await stock.dispatchOrder(db, admin.id, order.id);
      await stock.deliverOrder(db, admin.id, order.id);
      const job = await one(db, "SELECT id FROM jobs WHERE order_id=$1", [
        order.id,
      ]);
      const scheduled = new Date();
      scheduled.setDate(scheduled.getDate() + 1 + Math.floor(i / 7));
      scheduled.setHours(9, 0, 0, 0);
      await field.assignJob(db, admin, job.id, {
        technician_id: techs[Math.floor(i / 7) % techs.length].id,
        scheduled_at: scheduled.toISOString(),
        duration_hours: 3,
      });
      if (i % 2 === 0) await field.startJob(db, admin, job.id);
    }
    await db.query("INSERT INTO settings VALUES('demo_expanded_v1','true')");
    console.log(
      "Added 28 synthetic customer journeys, 11 staff accounts and 84 serialized test devices. Existing records preserved.",
    );
  });
}
