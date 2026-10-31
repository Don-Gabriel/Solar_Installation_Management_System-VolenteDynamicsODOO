import type { FastifyInstance } from "fastify";
import { Params } from "../../../../packages/contracts/src/index.js";
import { Type } from "typebox";
import { allow } from "../plugins/auth.js";
import { ensure, one, pool, transaction } from "../db.js";

export async function customerPortalRoutes(app: FastifyInstance) {
  app.get("/api/customer/home", async (req) => {
    allow(req, ["customer"]);
    return transaction(async (db) => {
      const customer = await one(
        db,
        "SELECT c.id,c.name FROM users u JOIN customers c ON c.id=u.customer_id WHERE u.id=$1 AND u.active AND u.role='customer'",
        [req.user.id],
      );
      ensure(customer, "Customer account is not linked.", 403);
      const projects = (
        await db.query(
          "SELECT p.id,p.number,p.stage,p.capacity_kw,p.system_type,s.address FROM projects p JOIN sites s ON s.id=p.site_id WHERE s.customer_id=$1 ORDER BY p.created_at DESC",
          [customer.id],
        )
      ).rows;
      const projectIds = projects.map((p) => p.id);
      const tickets = (
        await db.query(
          "SELECT t.id,t.number,t.project_id,t.status,t.complaint,t.opened_at,t.confirmed_at FROM tickets t WHERE t.project_id=ANY($1::uuid[]) ORDER BY t.opened_at DESC",
          [projectIds],
        )
      ).rows;
      const visits = (
        await db.query(
          "SELECT v.id,v.project_id,v.kind,v.starts_at,v.ends_at,v.status,(SELECT string_agg(u.name, ', ' ORDER BY c.is_lead DESC,u.name) FROM visit_crew c JOIN users u ON u.id=c.user_id WHERE c.visit_id=v.id) AS crew FROM visits v WHERE v.project_id=ANY($1::uuid[]) UNION ALL SELECT j.id,o.project_id,'installation',j.scheduled_at,j.scheduled_at+j.duration_hours*interval '1 hour',j.status,(SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM job_crew c JOIN users u ON u.id=c.user_id WHERE c.job_id=j.id) FROM jobs j JOIN orders o ON o.id=j.order_id WHERE o.project_id=ANY($1::uuid[]) AND j.scheduled_at IS NOT NULL ORDER BY starts_at DESC",
          [projectIds],
        )
      ).rows;
      const invoices = (
        await db.query(
          "SELECT i.id,i.number,o.project_id,i.kind,i.total_minor,i.net_total_minor,i.credited_minor,i.paid_minor,greatest(0,i.net_total_minor-i.paid_minor) AS due_minor,i.issued_at,(SELECT coalesce(jsonb_agg(jsonb_build_object('description',l.description,'quantity',l.quantity,'unit_price_minor',l.unit_price_minor,'amount_minor',l.quantity*l.unit_price_minor) ORDER BY l.id),'[]'::jsonb) FROM invoice_lines l WHERE l.invoice_id=i.id) AS lines FROM invoice_balances i JOIN orders o ON o.id=i.order_id WHERE o.project_id=ANY($1::uuid[]) ORDER BY i.issued_at DESC",
          [projectIds],
        )
      ).rows;
      // Recheck both recipient and current project ownership after a reviewed customer merge.
      const notifications = (
        await db.query(
          "SELECT id,project_id,title,body,created_at,read_at FROM customer_notifications WHERE customer_id=$1 AND project_id=ANY($2::uuid[]) ORDER BY created_at DESC,id DESC LIMIT 100",
          [customer.id, projectIds],
        )
      ).rows;
      return {
        customer,
        projects,
        tickets,
        visits,
        invoices,
        notifications,
        delivery_mode: "in_app",
      };
    });
  });
  app.post(
    "/api/customer/notifications/:id/read",
    {
      schema: {
        params: Params,
        body: Type.Object({}, { additionalProperties: false }),
      },
    },
    async (req) => {
      allow(req, ["customer"]);
      const result = await one(
        pool,
        "UPDATE customer_notifications n SET read_at=coalesce(n.read_at,now()) FROM users u,projects p,sites s WHERE n.id=$1 AND u.id=$2 AND u.customer_id=n.customer_id AND p.id=n.project_id AND s.id=p.site_id AND s.customer_id=u.customer_id RETURNING n.id,n.read_at",
        [(req.params as { id: string }).id, req.user.id],
      );
      ensure(result, "Notification not found.", 404);
      return result;
    },
  );
}
