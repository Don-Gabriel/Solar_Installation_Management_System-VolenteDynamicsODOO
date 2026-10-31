import { CommandForm, Panel, Status } from "@/components/shared";
import { Can } from "@/app/session";
import { date } from "@/lib/api";
export function DeliveryExceptions({ data: d }: { data: any }) {
  const o = d.order;
  if (!o) return null;
  const lines = o.lines.filter((l: any) => l.kind !== "service");
  return (
    <Panel title="Delivery receipts and issues">
      <p>
        Record each complete line as it reaches the customer. Coverage starts
        separately for each received line.
      </p>
      {lines.map((l: any) => (
        <div key={l.id}>
          <p>
            {l.description} × {l.quantity} ·{" "}
            {l.delivered_at ? date(l.delivered_at, true) : "Not received"}
          </p>
          <Can roles={["admin", "warehouse"]}>
            {o.status === "dispatched" && !l.delivered_at && (
              <CommandForm
                path={`/orders/${o.id}/delivery`}
                submit={`Receive ${l.description}`}
                transform={(b) => ({ ...b, line_ids: [l.id] })}
                fields={[
                  {
                    name: "received_by",
                    label: `Receiver for ${l.description}`,
                  },
                ]}
              />
            )}
          </Can>
        </div>
      ))}
      <Can roles={["admin", "warehouse"]}>
        {o.status === "dispatched" && (
          <details>
            <summary>Record a delivery issue</summary>
            <CommandForm
              path={`/orders/${o.id}/delivery-incidents`}
              submit="Record delivery issue"
              defaults={{ kind: "wrong_destination" }}
              fields={[
                {
                  name: "kind",
                  label: "Delivery problem",
                  type: "select",
                  options: [
                    {
                      value: "wrong_destination",
                      label: "Wrong destination or failed delivery",
                    },
                    { value: "refused", label: "Customer refused delivery" },
                    {
                      value: "transit_damage",
                      label: "Damaged during transit",
                    },
                  ],
                },
                { name: "custody", label: "Who has the goods and where?" },
                { name: "reason", label: "What happened?", type: "textarea" },
              ]}
            />
          </details>
        )}
      </Can>
      {d.delivery_incidents?.map((r: any) => (
        <div className="ticket-card" key={r.id}>
          <p>
            {r.kind} · <Status value={r.status} />
          </p>
          <p>
            {r.reason} · Custody: {r.custody}
          </p>
          <p>{r.outcome}</p>
          <Can roles={["admin", "warehouse"]}>
            {r.kind === "transit_damage" && r.status === "returned" && (
              <CommandForm
                path={`/delivery-incidents/${r.id}/replacements`}
                submit="Record replacement shipment"
                fields={[
                  {
                    name: "asset_id",
                    label: "Damaged undelivered device",
                    type: "select",
                    options: d.assets
                      .filter((a: any) => a.status === "dispatched")
                      .map((a: any) => ({ value: a.id, label: a.serial })),
                  },
                  {
                    name: "replacement_serial",
                    label: "Replacement stock serial",
                  },
                  {
                    name: "note",
                    label: "Inspection and replacement shipment reference",
                  },
                ]}
              />
            )}
          </Can>
          <Can roles={["admin", "coordinator"]}>
            {["open", "returned"].includes(r.status) && (
              <CommandForm
                path={`/delivery-incidents/${r.id}/review`}
                submit="Review delivery issue"
                defaults={{ status: "returned" }}
                transform={(b) => ({ ...b, version: r.version })}
                fields={[
                  {
                    name: "status",
                    label: "Next step",
                    type: "select",
                    options: [
                      {
                        value: "returned",
                        label: "Goods returned — delivery remains blocked",
                      },
                      ...(r.kind === "transit_damage" && r.status !== "returned"
                        ? []
                        : [
                            {
                              value: "retry",
                              label: "Verified destination and agreed retry",
                            },
                          ]),
                    ],
                  },
                  {
                    name: "custody",
                    label: "Updated goods location and custodian",
                  },
                  { name: "outcome", label: "Review and customer agreement" },
                ]}
              />
            )}
          </Can>
        </div>
      ))}
    </Panel>
  );
}
