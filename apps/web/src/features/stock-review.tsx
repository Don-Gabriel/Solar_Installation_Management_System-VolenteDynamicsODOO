import { useState } from "react";
import { CommandForm, Panel, Status, ErrorNotice } from "@/components/shared";
import { Can, useSession } from "@/app/session";
import { useData } from "@/lib/api";
export function StockReview({ data: d }: { data: any }) {
  const [serial, setSerial] = useState("");
  const { data, error } = useData("/stock-counts"),
    { user } = useSession();
  const products = d.products.filter((p: any) => p.kind === "quantity");
  return (
    <Panel title="Stock checks and damaged devices">
      <Can roles={["admin", "warehouse"]}>
        <details>
          <summary>Record a physical material count</summary>
          <p>
            Counts need a second reviewer. Serial-tracked devices use individual
            quarantine or purchase receipts.
          </p>
          <CommandForm
            path="/stock-counts"
            submit="Send stock count for review"
            defaults={{ product_id: products[0]?.id, counted_quantity: 0 }}
            fields={[
              {
                name: "product_id",
                label: "Counted material",
                type: "select",
                options: products.map((p: any) => ({
                  value: p.id,
                  label: p.name,
                })),
              },
              {
                name: "counted_quantity",
                label: "Physical quantity counted",
                type: "number",
                min: 0,
              },
              { name: "reason", label: "Count notes and discrepancy reason" },
            ]}
          />
        </details>
        <details>
          <summary>Quarantine a damaged warehouse device</summary>
          <label htmlFor="quarantine-serial">Damaged device</label>
          <select
            id="quarantine-serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          >
            <option value="">Choose a serial</option>
            {d.assets
              .filter((a: any) => ["available", "allocated"].includes(a.status))
              .map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.serial} · {a.product_name}
                </option>
              ))}
          </select>
          {serial && (
            <CommandForm
              key={serial}
              path={`/assets/${serial}/quarantine`}
              submit="Quarantine this device"
              onDone={() => setSerial("")}
              fields={[
                { name: "reason", label: "Damage and quarantine location" },
              ]}
            />
          )}
        </details>
      </Can>
      {error && <ErrorNotice error={error} />}{" "}
      {data?.items.map((c: any) => (
        <div className="ticket-card" key={c.id}>
          <p>
            {c.product_name} · expected {c.expected_quantity} · counted{" "}
            {c.counted_quantity} · <Status value={c.status} />
          </p>
          <p>
            {c.reason} {c.review_note}
          </p>
          <Can roles={["admin", "accounts"]}>
            {c.status === "pending" && c.requested_by !== user.id && (
              <CommandForm
                path={`/stock-counts/${c.id}/review`}
                submit="Review stock count"
                defaults={{ approved: false }}
                fields={[
                  {
                    name: "approved",
                    label: "Approve counted quantity",
                    type: "checkbox",
                    required: false,
                  },
                  { name: "note", label: "Stock count review reason" },
                ]}
              />
            )}
          </Can>
        </div>
      ))}
    </Panel>
  );
}
