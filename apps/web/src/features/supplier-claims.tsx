import { CommandForm, Panel, Status, ErrorNotice } from "@/components/shared";
import { Can } from "@/app/session";
import { useData, money } from "@/lib/api";
export function ExternalEquipment({ data: d }: { data: any }) {
  const active =
    d.visits.some((v: any) => v.status === "in_progress") &&
    !["closed", "cancelled", "awaiting_confirmation"].includes(d.ticket.status);
  return (
    <details className="ticket-card">
      <summary>Other equipment at this site</summary>
      <p>
        Record third-party equipment separately. These records do not grant
        company warranty coverage.
      </p>
      {d.external_equipment?.map((x: any) => (
        <p key={x.id}>
          <strong>
            {x.name} · {x.serial || "No serial"}
          </strong>
          <br />
          {x.findings}
        </p>
      ))}
      <Can roles={["admin", "technician"]}>
        {active && (
          <CommandForm
            path={`/tickets/${d.ticket.id}/external-equipment`}
            submit="Record other equipment"
            defaults={{ serial: "" }}
            fields={[
              { name: "name", label: "Equipment and manufacturer" },
              { name: "serial", label: "Serial if available", required: false },
              { name: "findings", label: "Observed issue", type: "textarea" },
            ]}
          />
        )}
      </Can>
    </details>
  );
}
export function SupplierShipment({ returns: rows }: { returns: any[] }) {
  return (
    <Can roles={["admin", "warehouse"]}>
      {rows
        .filter((r) => r.status === "quarantined")
        .map((r) => (
          <Panel
            key={r.id}
            title={`Supplier return · ${r.original_serial || r.serial || "Faulty device"}`}
          >
            <CommandForm
              path={`/service-returns/${r.id}/supplier-claim`}
              submit="Record supplier shipment and claim"
              fields={[
                { name: "supplier", label: "Supplier name" },
                { name: "reference", label: "Supplier claim reference" },
                {
                  name: "tracking_reference",
                  label: "Shipment tracking reference",
                },
                {
                  name: "requested_minor",
                  label: "Recovery requested (₹)",
                  type: "money",
                  min: 0.01,
                },
              ]}
            />
          </Panel>
        ))}
    </Can>
  );
}
export function SupplierClaims() {
  const { data, error } = useData("/supplier-claims");
  if (error) return <ErrorNotice error={error} />;
  return (
    <Panel
      title="Supplier claims"
      description="Supplier decisions and recoveries are separate from the customer’s warranty and invoice."
    >
      {!data?.items.length && <p>No supplier claims recorded.</p>}
      {data?.items.map((c: any) => (
        <details className="ticket-card" key={c.id}>
          <summary>
            {c.supplier} · {c.reference} · {c.status}
          </summary>
          <p>
            Returned serial {c.original_serial} · Tracking{" "}
            {c.tracking_reference}
          </p>
          <p>
            Requested {money(c.requested_minor)} · Approved{" "}
            {money(c.approved_minor)} · Recovered {money(c.recovered_minor)}
          </p>
          <p>{c.decision_note}</p>
          <Can roles={["admin", "accounts"]}>
            {["submitted", "disputed"].includes(c.status) && (
              <CommandForm
                path={`/supplier-claims/${c.id}/decision`}
                submit="Record supplier decision"
                defaults={{ status: "disputed", amount_minor: 0 }}
                transform={(b) => ({ ...b, version: c.version })}
                fields={[
                  {
                    name: "status",
                    label: "Supplier decision",
                    type: "select",
                    options: [
                      {
                        value: "disputed",
                        label: "Disputed — needs follow-up",
                      },
                      { value: "approved", label: "Recovery approved" },
                      { value: "declined", label: "Claim declined" },
                    ],
                  },
                  {
                    name: "amount_minor",
                    label: "Approved recovery (₹)",
                    type: "money",
                    min: 0,
                  },
                  { name: "note", label: "Supplier decision details" },
                ]}
              />
            )}{" "}
            {c.status === "approved" && (
              <CommandForm
                path={`/supplier-claims/${c.id}/recoveries`}
                submit="Record supplier recovery"
                fields={[
                  {
                    name: "amount_minor",
                    label: "Recovered amount (₹)",
                    type: "money",
                    min: 0.01,
                  },
                  {
                    name: "reference",
                    label: "Supplier credit or bank reference",
                  },
                ]}
              />
            )}
          </Can>
          {c.recoveries.map((r: any) => (
            <p key={r.id}>
              {r.reference} · {money(r.amount_minor)}
            </p>
          ))}
        </details>
      ))}
    </Panel>
  );
}

export function PartsReadiness({ data: d }: { data: any }) {
  const open = !["closed", "cancelled", "awaiting_confirmation"].includes(
    d.ticket.status,
  );
  const products = Array.from(
    new Map(
      d.components.map((c: any) => [
        c.product_id,
        { value: c.product_id, label: c.description },
      ]),
    ).values(),
  ) as { value: string; label: string }[];
  return (
    <details className="ticket-card">
      <summary>Parts and return visit readiness</summary>
      <p>
        A supplier estimate is not a confirmed repair date. Stock is checked
        again before booking; final completion still checks and consumes actual
        stock.
      </p>
      {d.parts_requests?.map((r: any) => (
        <div key={r.id}>
          <p>
            {r.product_name} × {r.quantity} · <Status value={r.status} /> ·
            Expected {r.expected_on?.slice(0, 10) || "Not yet known"}
          </p>
          <p>{r.note}</p>
          <Can roles={["admin", "warehouse"]}>
            {open && r.status === "waiting" && (
              <CommandForm
                path={`/parts-requests/${r.id}/readiness`}
                submit="Confirm parts are available"
                transform={(b) => ({ ...b, version: r.version })}
                fields={[
                  { name: "outcome", label: "Receipt or readiness reference" },
                ]}
              />
            )}
          </Can>
        </div>
      ))}
      <Can roles={["admin", "coordinator", "technician"]}>
        {open && (
          <CommandForm
            path={`/tickets/${d.ticket.id}/parts-requests`}
            submit="Request parts for return visit"
            defaults={{ product_id: products[0]?.value, quantity: 1 }}
            fields={[
              {
                name: "product_id",
                label: "Part needed",
                type: "select",
                options: products,
              },
              {
                name: "quantity",
                label: "Quantity needed",
                type: "number",
                min: 1,
              },
              {
                name: "expected_on",
                label: "Supplier estimate (not confirmed)",
                type: "date",
                required: false,
              },
              { name: "note", label: "Parts requirement and supplier notes" },
            ]}
          />
        )}
      </Can>
    </details>
  );
}

export function EngineeringSubstitute({ data: d }: { data: any }) {
  const { data } = useData("/products");
  if (
    ["closed", "cancelled", "awaiting_confirmation"].includes(d.ticket.status)
  )
    return null;
  return (
    <details className="ticket-card">
      <summary>Approve a compatible replacement model</summary>
      <p>
        Coordinator must verify engineering compatibility and the customer's
        agreement. The repair estimate still needs approval, and original
        warranty dates are retained.
      </p>
      <CommandForm
        path={`/tickets/${d.ticket.id}/engineering-substitutes`}
        submit="Record engineering approval"
        fields={[
          {
            name: "asset_id",
            label: "Installed device to replace",
            type: "select",
            options: d.components
              .filter((c: any) => c.asset_status === "delivered")
              .map((c: any) => ({
                value: c.asset_id,
                label: c.serial + " · " + c.description,
              })),
          },
          {
            name: "replacement_product_id",
            label: "Compatible replacement model",
            type: "select",
            options: (data?.items || [])
              .filter((p: any) => p.kind === "serialized")
              .map((p: any) => ({ value: p.id, label: p.name })),
          },
          {
            name: "compatibility_note",
            label: "Engineering checks and compatibility approval",
            type: "textarea",
          },
          {
            name: "customer_agreement",
            label: "Customer agreement and reference",
          },
          {
            name: "unit_price_minor",
            label: "Replacement retail price before warranty (₹)",
            type: "money",
            min: 0,
          },
        ]}
      />
      {d.engineering_substitutes?.map((e: any) => (
        <p key={e.id}>
          {e.replacement_name} · {e.compatibility_note} · {e.customer_agreement}{" "}
          · {money(e.unit_price_minor)}
        </p>
      ))}
    </details>
  );
}
