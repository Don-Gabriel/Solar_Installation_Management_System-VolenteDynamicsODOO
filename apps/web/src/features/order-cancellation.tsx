import { Link } from "react-router";
import { useData } from "@/lib/api";
import { CommandForm, Status } from "@/components/shared";
import { Can, useSession } from "@/app/session";
export function OrderCancellation({ data: d }: { data: any }) {
  const { user } = useSession();
  if (!d.order) return null;
  return (
    <details className="ticket-card">
      <summary>Order cancellation and refund</summary>
      <p>
        A second finance reviewer must approve cancellation before dispatch.
        Approval credits the original invoice and releases stock and
        appointments; accounts then records the actual refund in the invoice
        ledger.
      </p>
      <Can roles={["admin", "sales", "accounts"]}>
        {d.order.status === "packing" &&
          !d.order_cancellations?.some((r: any) => r.status === "pending") && (
            <CommandForm
              path={`/orders/${d.order.id}/cancellation`}
              submit="Request order cancellation"
              fields={[
                {
                  name: "reason",
                  label: "Cancellation reason and customer request",
                },
              ]}
            />
          )}
      </Can>
      {d.order_cancellations?.map((r: any) => (
        <div key={r.id}>
          <p>
            {r.reason} · <Status value={r.status} />
          </p>
          <p>{r.review_note}</p>
          <Can roles={["admin", "accounts"]}>
            {r.status === "pending" && r.requested_by !== user.id && (
              <CommandForm
                path={`/order-cancellations/${r.id}/review`}
                submit="Review order cancellation"
                defaults={{ approved: false }}
                fields={[
                  {
                    name: "approved",
                    label:
                      "Approve cancellation and full remaining invoice credit",
                    type: "checkbox",
                    required: false,
                  },
                  { name: "note", label: "Cancellation review reason" },
                ]}
              />
            )}
          </Can>
        </div>
      ))}
    </details>
  );
}

export function QuoteDiscount({ data: d }: { data: any }) {
  const { user } = useSession(),
    q = d.quotes[0];
  if (!q || d.order) return null;
  return (
    <details className="ticket-card">
      <summary>Request a quotation discount</summary>
      <p>
        Demo policy: 1–20% needs a separate administrator’s approval and creates
        a new quote version. Discounts cannot be stacked.
      </p>
      <Can roles={["admin", "sales"]}>
        <CommandForm
          path={`/quotes/${q.id}/discount`}
          submit="Request discount approval"
          fields={[
            {
              name: "percent",
              label: "Discount percent",
              type: "number",
              min: 1,
              max: 20,
            },
            { name: "reason", label: "Discount request reason" },
          ]}
        />
      </Can>
      {d.quote_discounts?.map((r: any) => (
        <div key={r.id}>
          <p>
            {r.percent}% · {r.reason} · <Status value={r.status} />
          </p>
          <Can roles={["admin"]}>
            {r.status === "pending" &&
              r.requested_by !== user.id &&
              r.quote_id === q.id && (
                <CommandForm
                  path={`/quote-discounts/${r.id}/review`}
                  submit="Review discount request"
                  defaults={{ approved: false }}
                  fields={[
                    {
                      name: "approved",
                      label: "Approve discount and issue revised quote",
                      type: "checkbox",
                      required: false,
                    },
                    { name: "note", label: "Discount review reason" },
                  ]}
                />
              )}
          </Can>
        </div>
      ))}
    </details>
  );
}

export function ChangeOrders({ data: d }: { data: any }) {
  const { data } = useData("/products");
  return (
    <details className="ticket-card">
      <summary>Additional work and change orders</summary>
      {d.project.parent_project_id && (
        <p>
          This is additional work for{" "}
          <Link to={`/projects/${d.project.parent_project_id}`}>
            the original installation
          </Link>
          . Only the requested extra items are quoted here.
        </p>
      )}
      <p>
        Additional work gets its own survey approval, quotation, customer
        acceptance and invoice. Original accepted documents stay unchanged.
      </p>
      {d.change_orders?.map((c: any) => (
        <p key={c.id}>
          <Link to={`/projects/${c.id}`}>Additional work #{c.number}</Link> ·{" "}
          {c.notes} · {c.stage}
        </p>
      ))}
      <Can roles={["admin", "sales"]}>
        {d.order && d.order.status !== "cancelled" && (
          <CommandForm
            path={`/projects/${d.project.id}/change-orders`}
            submit="Create additional work request"
            defaults={{ quantity: 1 }}
            transform={(b) => ({
              reason: b.reason,
              lines: [{ product_id: b.product_id, quantity: b.quantity }],
            })}
            fields={[
              {
                name: "product_id",
                label: "Additional product or service",
                type: "select",
                options: (data?.items || []).map((p: any) => ({
                  value: p.id,
                  label: p.name,
                })),
              },
              {
                name: "quantity",
                label: "Additional quantity",
                type: "number",
                min: 1,
                max: 1000,
              },
              {
                name: "reason",
                label: "Requested change and customer instructions",
                type: "textarea",
              },
            ]}
          />
        )}
      </Can>
    </details>
  );
}
