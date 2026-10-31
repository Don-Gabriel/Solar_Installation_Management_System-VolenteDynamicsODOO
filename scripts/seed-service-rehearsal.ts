/** Add a small, clearly labelled service rehearsal through the real API. Never resets data. */
import { buildApp } from "../apps/api/src/app.js";
import { pool } from "../apps/api/src/db.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

if (process.env.DEMO_TOOLS !== "true")
  throw Error(
    "Service rehearsal requires the explicitly enabled synthetic demo workspace.",
  );
const app = await buildApp();
const lock = await pool.connect();
const sessions: Record<string, any> = {};
async function login(email: string) {
  if (sessions[email]) return sessions[email];
  const r = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { email, password: process.env.DEMO_PASSWORD },
  });
  if (r.statusCode !== 200) throw Error(`Demo sign-in failed for ${email}`);
  return (sessions[email] = {
    cookie: r.cookies.map((c) => `${c.name}=${c.value}`).join(";"),
    "x-csrf-token": r.json().csrfToken,
  });
}
async function request(
  path: string,
  body?: any,
  email = "admin@sunpower.local",
) {
  const r = await app.inject({
    method: body === undefined ? "GET" : "POST",
    url: "/api" + path,
    headers: { ...(await login(email)), "idempotency-key": randomUUID() },
    ...(body === undefined ? {} : { payload: body }),
  });
  if (r.statusCode !== 200) throw Error(`${path}: ${r.statusCode} ${r.body}`);
  return r.json();
}
try {
  await lock.query("SELECT pg_advisory_lock(902635)");
  const marker = (
    await pool.query(
      "SELECT value FROM settings WHERE key='demo_repair_rehearsal_v1'",
    )
  ).rows[0];
  if (marker) {
    console.log(JSON.stringify(marker.value, null, 2));
  } else {
    const sites = (
      await pool.query(
        `SELECT DISTINCT p.id,p.number,c.name FROM projects p JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id JOIN orders o ON o.project_id=p.id JOIN order_lines l ON l.order_id=o.id JOIN assets a ON a.order_line_id=l.id JOIN products pr ON pr.id=l.product_id JOIN warranties w ON w.asset_id=a.id WHERE p.stage IN ('delivered','completed') AND a.status='delivered' AND w.expires_at>now() AND lower(pr.name) LIKE '%inverter%' AND EXISTS(SELECT 1 FROM assets spare WHERE spare.product_id=a.product_id AND spare.status='available') ORDER BY p.number LIMIT 3`,
      )
    ).rows;
    if (sites.length < 2)
      throw Error(
        "Two covered installations with matching spare inverters are required.",
      );
    const results = [];
    for (let index = 0; index < 2; index++) {
      const site = sites[index];
      const label =
        index === 0
          ? "SYNTHETIC DEMO: fully covered inverter replacement"
          : "SYNTHETIC DEMO: parts covered, agreed labour and callout charged";
      let ticket = (
        await pool.query(
          "SELECT id,status FROM tickets WHERE complaint=$1 ORDER BY opened_at LIMIT 1",
          [label],
        )
      ).rows[0];
      if (!ticket)
        ticket = await request(
          "/tickets",
          {
            project_id: site.id,
            complaint: label,
            fault_code: "Inverter warning",
          },
          "support@sunpower.local",
        );
      let d = await request("/tickets/" + ticket.id);
      if (!["awaiting_confirmation", "closed"].includes(d.ticket.status)) {
        let visit = d.visits.find((v: any) =>
          ["scheduled", "in_progress"].includes(v.status),
        );
        if (!visit) {
          const date = (offset: number) =>
            new Date(Date.now() + offset * 86400000 + 330 * 60000)
              .toISOString()
              .slice(0, 10);
          const availability = await request(
            "/schedule/availability?" +
              new URLSearchParams({
                from: date(1),
                to: date(5),
                skill: "inverter_repair",
                duration_hours: "2",
                crew_size: "1",
              }),
            undefined,
            "coordinator@sunpower.local",
          );
          const slot = availability.slots[0],
            lead = slot?.candidates.find((t: any) => t.can_lead);
          if (!lead) throw Error("No qualified free demo slot.");
          visit = await request(
            "/visits",
            {
              ticket_id: ticket.id,
              starts_at: slot.starts_at,
              duration_hours: 2,
              skill: "inverter_repair",
              technician_ids: [lead.id],
              lead_id: lead.id,
            },
            "coordinator@sunpower.local",
          );
          d = await request("/tickets/" + ticket.id);
        }
        const email = (
          await pool.query("SELECT email FROM users WHERE id=$1", [
            d.ticket.assigned_to,
          ])
        ).rows[0].email;
        if (visit.status === "scheduled")
          await request(
            `/visits/${visit.id}/action`,
            { action: "start", version: visit.version },
            email,
          );
        d = await request("/tickets/" + ticket.id);
        if (!d.lines.length) {
          const component = d.components.find(
            (c: any) =>
              c.asset_status === "delivered" && /inverter/i.test(c.description),
          );
          const spare = d.spares.find(
            (s: any) => s.product_id === component?.product_id,
          );
          if (!component || !spare)
            throw Error("Matching installed inverter or spare missing.");
          await request(
            `/tickets/${ticket.id}/diagnosis`,
            {
              version: d.ticket.version,
              lines: [
                {
                  order_line_id: component.order_line_id,
                  asset_id: component.asset_id,
                  quantity: 1,
                  finding:
                    "SIMULATION ONLY: inverter fault identified for hackathon rehearsal",
                  action: "replace",
                  replacement_serial: spare.serial,
                  labour_minutes: 60,
                  labour_price_minor: 50000,
                  callout_price_minor: 20000,
                  labour_coverage: index === 0 ? "covered" : "chargeable",
                  coverage_reason:
                    index === 0
                      ? "Synthetic full cover includes labour and callout"
                      : "Synthetic agreed parts-only cover; customer accepted INR 500 labour and INR 200 callout",
                },
              ],
            },
            "coordinator@sunpower.local",
          );
        }
        d = await request("/tickets/" + ticket.id);
        if (d.ticket.estimate_status !== "approved")
          await request(
            `/tickets/${ticket.id}/approval`,
            {
              version: d.ticket.version,
              confirmed_by:
                "SYNTHETIC customer approval for demonstration only",
            },
            "support@sunpower.local",
          );
        d = await request("/tickets/" + ticket.id);
        if (
          !d.evidence.some(
            (e: any) =>
              e.kind === "photo" &&
              e.visit_id === visit.id &&
              e.diagnosis_revision === d.ticket.diagnosis_revision,
          )
        ) {
          const png = await sharp(
            Buffer.from(
              '<svg width="900" height="500"><rect width="100%" height="100%" fill="#e8eff2"/><text x="55" y="190" font-size="40" fill="#173d49">SYNTHETIC REPAIR REHEARSAL</text><text x="55" y="260" font-size="28" fill="#173d49">Not a photograph of a real site or completed job.</text><text x="55" y="320" font-size="25" fill="#173d49">Used only to demonstrate private evidence and billing.</text></svg>',
            ),
          )
            .png()
            .toBuffer();
          const boundary = "demo-" + randomUUID();
          const payload = Buffer.concat([
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nphoto\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic-rehearsal.png"\r\nContent-Type: image/png\r\n\r\n`,
            ),
            png,
            Buffer.from(`\r\n--${boundary}--\r\n`),
          ]);
          const uploaded = await app.inject({
            method: "POST",
            url: `/api/tickets/${ticket.id}/evidence`,
            headers: {
              ...(await login(email)),
              "content-type": `multipart/form-data; boundary=${boundary}`,
            },
            payload,
          });
          if (uploaded.statusCode !== 200) throw Error(uploaded.body);
        }
        await request(
          `/tickets/${ticket.id}/resolution`,
          {
            resolution:
              "SIMULATION ONLY: replacement and verification steps rehearsed with synthetic evidence",
          },
          email,
        );
        d = await request("/tickets/" + ticket.id);
      }
      const expected = index === 0 ? 0 : 70000;
      if (d.invoices[0]?.total_minor !== expected)
        throw Error("Rehearsal bill differs from approved example.");
      results.push({
        label,
        ticket_id: ticket.id,
        number: d.ticket.number,
        customer: d.project.customer_name,
        customer_payable_minor: expected,
        url: `http://127.0.0.1:3001/service?ticket=${ticket.id}`,
      });
    }
    const complaint =
      "SYNTHETIC DEMO: new repair call awaiting days 3–5 technician search";
    let waiting = (
      await pool.query("SELECT id,number FROM tickets WHERE complaint=$1", [
        complaint,
      ])
    ).rows[0];
    if (!waiting)
      waiting = await request(
        "/tickets",
        { project_id: sites[0].id, complaint, fault_code: "Low generation" },
        "support@sunpower.local",
      );
    results.push({
      label: complaint,
      ticket_id: waiting.id,
      number: waiting.number,
      url: `http://127.0.0.1:3001/schedule?ticket=${waiting.id}`,
    });
    const result = {
      synthetic: true,
      created_at: new Date().toISOString(),
      examples: results,
    };
    await pool.query(
      "INSERT INTO settings(key,value) VALUES('demo_repair_rehearsal_v1',$1)",
      [JSON.stringify(result)],
    );
    await mkdir("output/scenarios", { recursive: true });
    await writeFile(
      "output/scenarios/demo-rehearsal.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await lock.query("SELECT pg_advisory_unlock(902635)");
  lock.release();
  await app.close();
  await pool.end();
}
