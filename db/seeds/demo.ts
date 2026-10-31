import argon2 from "argon2";
import { seedExpanded } from "./expanded.js";
import { seedOperations } from "./operations.js";
import { seedCustomerPortal } from "./customer-portal.js";
import { pool, transaction, one } from "../../apps/api/src/db.js";
import * as sales from "../../apps/api/src/modules/sales.js";
import * as stock from "../../apps/api/src/modules/inventory.js";
import * as field from "../../apps/api/src/modules/field.js";
import * as service from "../../apps/api/src/modules/service.js";
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw Error("Set DEMO_PASSWORD to at least 12 characters.");
const hash = await argon2.hash(password, { type: argon2.argon2id });
try {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(902632)");
    if (await one(db, "SELECT key FROM settings WHERE key='demo_seed'")) {
      console.log("Demo already seeded; existing data preserved.");
      return;
    }
    const users: any[] = [];
    for (const [name, role] of [
      ["Don Gabriel", "admin"],
      ["Asha Nair", "sales"],
      ["Vikram Menon", "surveyor"],
      ["Ravi Kumar", "warehouse"],
      ["Meera Shah", "support"],
      ["Neha Rao", "accounts"],
      ...[
        "Arjun Nair",
        "Dev Patel",
        "Ishaan Shah",
        "Kiran Das",
        "Nikhil Rao",
        "Om Sharma",
        "Pranav Iyer",
        "Rahul Menon",
        "Sanjay Rao",
        "Tariq Khan",
        "Uday Kumar",
        "Varun Das",
        "Yash Shah",
        "Zubin Roy",
        "Akash Jain",
      ].map((n) => [n, "technician"]),
    ]) {
      const email =
        role === "technician"
          ? `${name.split(" ")[0].toLowerCase()}@sunpower.local`
          : `${role}@sunpower.local`;
      users.push(
        await one(
          db,
          "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role",
          [name, email, hash, role],
        ),
      );
    }
    const admin = users[0],
      techs = users.filter((u) => u.role === "technician");
    const products: Record<string, any> = {};
    const catalogue: any[] = [
      [
        "PANEL",
        "550 W monocrystalline panel",
        "quantity",
        1450000,
        240,
        100,
        1050000,
      ],
      [
        "BATTERY",
        "150 Ah solar battery",
        "serialized",
        1650000,
        24,
        24,
        1200000,
      ],
      ["CTRL", "Solar charge controller", "serialized", 650000, 24, 30, 420000],
      ["CABLE", "Solar DC cable · 10 m", "quantity", 220000, 0, 150, 140000],
      ["CONNECT", "MC4 connector pair", "quantity", 80000, 0, 200, 40000],
      ["EARTH", "Earthing & lightning kit", "quantity", 750000, 0, 60, 480000],
      ["STAND", "Panel mounting stand", "quantity", 280000, 0, 100, 160000],
      ["BOX", "AC/DC protection box", "quantity", 650000, 0, 60, 410000],
      ["INSTALL", "Installation & commissioning", "service", 1500000, 0, 0, 0],
      ...Array.from({ length: 5 }, (_, i) => [
        `INV${i + 1}`,
        `${i + 1} kW hybrid inverter`,
        "serialized",
        (i + 1) * 900000 + 900000,
        24,
        12,
        (i + 1) * 600000 + 600000,
      ]),
    ];
    for (const [sku, name, kind, price, warranty, qty, cost] of catalogue) {
      const p = await one(
        db,
        "INSERT INTO products(sku,name,kind,price_minor,warranty_months) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [sku, name, kind, price, warranty],
      );
      products[sku] = p;
      if (qty)
        await stock.receiveStock(db, admin.id, {
          product_id: p.id,
          supplier: "Demo Solar Distributors",
          reference: `DEMO-PO-${sku}`,
          quantity: qty,
          unit_cost_minor: cost,
          serials:
            kind === "serialized"
              ? Array.from(
                  { length: qty },
                  (_, i) => `SP-${sku}-${String(i + 1).padStart(4, "0")}`,
                )
              : [],
        });
    }
    for (const system of ["on_grid", "off_grid", "panel_set"])
      for (let capacity = 1; capacity <= 5; capacity++) {
        const pack = await one(
          db,
          "INSERT INTO packages(system_type,capacity_kw) VALUES($1,$2) RETURNING *",
          [system, capacity],
        );
        const components: Record<string, number> = {
          PANEL: Math.ceil((capacity * 1000) / 550),
          CABLE: capacity,
          CONNECT: capacity * 2,
        };
        if (system !== "panel_set")
          Object.assign(components, {
            [`INV${capacity}`]: 1,
            CTRL: 1,
            EARTH: 1,
            STAND: Math.ceil((capacity * 1000) / 550),
            BOX: 1,
            INSTALL: 1,
          });
        if (system === "off_grid") components.BATTERY = capacity;
        for (const [sku, quantity] of Object.entries(components))
          await db.query("INSERT INTO package_lines VALUES($1,$2,$3)", [
            pack.id,
            products[sku].id,
            quantity,
          ]);
      }
    const cases = [
      ["Priya Menon", "Kakkanad, Kochi", 3, "on_grid", "enquiry"],
      ["Thomas George", "Aluva, Kochi", 5, "off_grid", "survey"],
      ["Anjali Nair", "Edappally, Kochi", 3, "on_grid", "quoted"],
      ["Faisal Rahman", "Vyttila, Kochi", 2, "off_grid", "packing"],
      ["Lakshmi Iyer", "Panampilly Nagar, Kochi", 5, "on_grid", "delivered"],
      ["Joseph Mathew", "Thrippunithura, Kochi", 3, "on_grid", "dispatched"],
      ["Sneha & Arun", "Palarivattom, Kochi", 2, "on_grid", "completed"],
      ["Radhika Pillai", "Kalamassery, Kochi", 1, "off_grid", "completed"],
      ["Abdul Kareem", "Fort Kochi", 3, "on_grid", "historic_covered"],
      [
        "Mary Varghese",
        "Mattancherry, Kochi",
        2,
        "on_grid",
        "historic_expired",
      ],
      ["Green Leaf Clinic", "Kakkanad, Kochi", 5, "off_grid", "enquiry"],
      ["Devika Suresh", "Maradu, Kochi", 4, "on_grid", "survey"],
    ];
    let index = 0;
    for (const [name, address, capacity, type, stage] of cases) {
      index++;
      const p = await sales.createEnquiry(db, admin.id, {
        name: String(name),
        phone: `980000${String(index).padStart(4, "0")}`,
        address: String(address),
        capacity_kw: Number(capacity),
        system_type: type as any,
        source: index % 2 ? "Referral" : "Website",
        notes: "Synthetic demonstration record. No real customer information.",
        subsidy_interest: type === "on_grid",
        owner_id: users[1].id,
        follow_up: new Date().toISOString().slice(0, 10),
      });
      if (stage === "enquiry") continue;
      await sales.saveSurvey(db, users[2].id, p.id, {
        roof_area: Number(capacity) * 12,
        bill_minor: Number(capacity) * 140000,
        grid_suitable: true,
        direction: "South",
        tilt: 12,
        cable_distance: 18,
        notes: "Demo survey: clear roof, accessible cable route.",
      });
      if (stage === "survey") continue;
      await sales.approveSurvey(db, admin.id, p.id, { approved: true });
      await sales.issueQuote(db, users[1].id, p.id);
      if (stage === "quoted") continue;
      const order = await sales.acceptQuote(db, admin.id, p.id);
      const invoice = await one(
        db,
        "SELECT * FROM invoices WHERE order_id=$1",
        [order.id],
      );
      await sales.recordPayment(db, admin.id, invoice.id, {
        amount_minor: [
          "completed",
          "historic_covered",
          "historic_expired",
        ].includes(String(stage))
          ? order.total_minor
          : order.minimum_advance_minor,
        method: "bank",
        reference: `DEMO-PAY-${index}`,
      });
      const job = await one(db, "SELECT * FROM jobs WHERE order_id=$1", [
        order.id,
      ]);
      const scheduled = new Date(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})+'T'+String(9+(index%3)*2).padStart(2,'0')+':00:00+05:30');
      // Synthetic historical schedule import. Live booking still requires future working hours.
      await db.query(
        "UPDATE jobs SET technician_id=$2,scheduled_at=$3,duration_hours=3,status='scheduled' WHERE id=$1",
        [job.id, techs[index % techs.length].id, scheduled],
      );
      await db.query(
        "INSERT INTO job_crew(job_id,user_id,is_lead) VALUES($1,$2,true)",
        [job.id, techs[index % techs.length].id],
      );
      if (stage === "packing") continue;
      await stock.reserveStock(db, admin.id, order.id);
      const lines = (
        await db.query(
          "SELECT * FROM order_lines WHERE order_id=$1 AND kind='serialized'",
          [order.id],
        )
      ).rows;
      for (const line of lines) {
        const assets = (
          await db.query(
            "SELECT * FROM assets WHERE product_id=$1 AND status='available' ORDER BY serial LIMIT $2",
            [line.product_id, line.quantity],
          )
        ).rows;
        for (const a of assets)
          await stock.scanAsset(db, admin.id, order.id, { serial: a.serial });
      }
      await stock.dispatchOrder(db, admin.id, order.id);
      if (stage === "dispatched") continue;
      await stock.deliverOrder(db, admin.id, order.id);
      if (stage === "delivered") continue;
      // Historical demo imports explicitly bypass live evidence capture; live API completion does not.
      const labour = index === 8 ? 9600 : 360;
      await db.query(
        "UPDATE jobs SET status='completed',started_at=now()-interval '8 hours',finished_at=now(),capacity_kw=$2,generation_kw=$2*0.8,checklist=$3,signer_name='Synthetic historical import',labour_minutes=$4::integer,hourly_rate_minor=35000,labour_cost_minor=$4::bigint*35000/60 WHERE id=$1",
        [
          job.id,
          capacity,
          JSON.stringify({
            mounting: true,
            earthing: true,
            wiring: true,
            inverter: true,
            handover: true,
          }),
          labour,
        ],
      );
      await db.query("UPDATE projects SET stage='completed' WHERE id=$1", [
        p.id,
      ]);
      if (String(stage).startsWith("historic")) {
        const months = stage === "historic_covered" ? 18 : 30;
        await db.query(
          "UPDATE orders SET delivered_at=now()-make_interval(months=>$2) WHERE id=$1",
          [order.id, months],
        );
        await db.query(
          "UPDATE warranties SET starts_at=now()-make_interval(months=>$2),expires_at=now()-make_interval(months=>$2)+make_interval(months=>policy_months) WHERE order_line_id IN (SELECT id FROM order_lines WHERE order_id=$1)",
          [order.id, months],
        );
        const w = await one(
          db,
          "SELECT w.id FROM warranties w JOIN assets a ON a.id=w.asset_id JOIN products p ON p.id=a.product_id JOIN order_lines l ON l.id=w.order_line_id WHERE l.order_id=$1 AND p.sku LIKE 'INV%'",
          [order.id],
        );
        await service.createTicket(db, users[4].id, {
          warranty_id: w.id,
          complaint:
            stage === "historic_covered"
              ? "Inverter displays an intermittent grid fault."
              : "Inverter fan is noisy and generation has dropped.",
          fault_code: "INV-04",
        });
      }
    }
    await db.query("INSERT INTO settings VALUES ('demo_seed','true')");
    console.log(
      "Seeded synthetic customer journeys, 15 technicians, 15 packages, stock and warranty scenarios.",
    );
  });
  await seedExpanded(hash);
  await pool.query(
    "UPDATE job_crew c SET labour_minutes=j.labour_minutes,hourly_rate_minor=j.hourly_rate_minor,labour_cost_minor=j.labour_cost_minor FROM jobs j WHERE c.job_id=j.id AND j.status='completed' AND c.labour_cost_minor IS NULL",
  );
  await seedOperations(hash);
  await seedCustomerPortal(hash);
} finally {
  await pool.end();
}
