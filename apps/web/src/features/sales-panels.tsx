import { InvoiceLedger } from "./invoice-ledger";
import { useState } from "react";
import { Printer, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Panel,
  Modal,
  CommandForm,
  Action,
  Status,
  Blank,
  type FormField,
} from "@/components/shared";
import { money, date, useData } from "@/lib/api";
import { Can } from "@/app/session";
export function SurveyPanel({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  const { data: demo } = useData("/demo-tools");
  const p = data.project,
    s = data.surveys[0];
  return (
    <div className="detail-columns">
      <Panel
        title="Site qualification"
        description="Confirm roof suitability before preparing an itemized quote."
        action={
          !data.order && (
            <Can roles={["admin", "surveyor"]}>
              <Button onClick={() => setOpen(true)}>
                {s ? "Record new survey" : "Record site survey"}
              </Button>
            </Can>
          )
        }
      >
        {s ? (
          <>
            <div className="section-status">
              <Status value={s.status} />
              <span>
                Survey by {s.surveyed_by_name} · {date(s.created_at)}
              </span>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Usable roof area</dt>
                <dd>{s.roof_area} m²</dd>
              </div>
              <div>
                <dt>Monthly electricity bill</dt>
                <dd>{money(s.bill_minor)}</dd>
              </div>
              <div>
                <dt>Grid suitable</dt>
                <dd>{s.grid_suitable ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Roof direction</dt>
                <dd>{s.direction}</dd>
              </div>
              <div>
                <dt>Panel tilt</dt>
                <dd>{s.tilt}°</dd>
              </div>
              <div>
                <dt>Cable distance</dt>
                <dd>{s.cable_distance} m</dd>
              </div>
            </dl>
            {s.notes && <p className="notes">{s.notes}</p>}
            {s.status === "pending" && (
              <Can roles={["admin", "surveyor"]}>
                <div className="button-row">
                  <Action
                    path={`/projects/${p.id}/survey-approval`}
                    label="Approve survey"
                    body={{ approved: true }}
                  />
                  <Action
                    path={`/projects/${p.id}/survey-approval`}
                    label="Reject survey"
                    variant="outline"
                    body={{ approved: false }}
                  />
                </div>
              </Can>
            )}
          </>
        ) : (
          <Blank title="A good installation starts with a site visit">
            Record roof area, bill, grid suitability and the proposed layout.
          </Blank>
        )}
      </Panel>
      <div className="right-stack">
        <Panel title="Customer requirements">
          <p>{p.notes || "No additional requirements recorded."}</p>
          <dl className="detail-grid single">
            <div>
              <dt>Source</dt>
              <dd>{p.source}</dd>
            </div>
            <div>
              <dt>Follow-up</dt>
              <dd>{date(p.follow_up)}</dd>
            </div>
            <div>
              <dt>Subsidy interest</dt>
              <dd>{p.subsidy_interest ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </Panel>
        <Alert>
          <CheckCircle2 />
          <AlertDescription>
            A quotation can only be issued after the latest survey is approved.
            Demo roof policy: at least 8 m² of usable area per kW.
          </AlertDescription>
        </Alert>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record site survey"
        description="A new survey requires approval before a new quotation."
      >
        <CommandForm
          path={`/projects/${p.id}/surveys`}
          onDone={() => setOpen(false)}
          submit="Save survey"
          presets={
            demo?.enabled
              ? [
                  {
                    label: "Fill sample survey",
                    values: {
                      capacity_kw: p.capacity_kw || 3,
                      roof_area: (p.capacity_kw || 3) * 12,
                      bill_minor: 3500,
                      grid_suitable: true,
                      direction: "South",
                      tilt: 12,
                      cable_distance: 18,
                      notes: "Synthetic survey values for testing only.",
                    },
                  },
                ]
              : undefined
          }
          defaults={{
            capacity_kw: p.capacity_kw || "",
            roof_area: "",
            bill_minor: "",
            grid_suitable: false,
            direction: "",
            tilt: "",
            cable_distance: "",
            notes: "",
          }}
          fields={[
            {
              name: "capacity_kw",
              label: "Surveyed capacity (kW)",
              type: "number",
              min: 1,
              max: 5,
            },
            {
              name: "roof_area",
              group: "Roof measurements",
              label: "Usable roof area (m²)",
              type: "number",
              min: 1,
            },
            {
              name: "bill_minor",
              group: "Electricity supply",
              label: "Monthly bill (₹)",
              type: "number",
              money: true,
              min: 0,
            },
            {
              name: "direction",
              label: "Roof direction",
              type: "select",
              options: [
                "North",
                "North-east",
                "East",
                "South-east",
                "South",
                "South-west",
                "West",
                "North-west",
              ].map((v) => ({ value: v, label: v })),
              group: "Roof measurements",
            },
            {
              name: "tilt",
              group: "Roof measurements",
              label: "Tilt (degrees)",
              type: "number",
              min: 0,
              max: 90,
            },
            {
              name: "cable_distance",
              group: "Roof measurements",
              label: "Cable distance (m)",
              type: "number",
              min: 0,
            },
            {
              name: "grid_suitable",
              group: "Electricity supply",
              label: "Grid connection is suitable",
              type: "checkbox",
              required: false,
            },
            {
              name: "notes",
              group: "Site notes",
              label: "Site observations",
              type: "textarea",
              required: false,
              full: true,
            },
          ]}
        />
      </Modal>
    </div>
  );
}
export function LineItems({
  lines,
  showCost = false,
}: {
  lines: any[];
  showCost?: boolean;
}) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Scrollable records"
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Amount</th>
            {showCost && <th>Material cost</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l: any) => (
            <tr key={l.id}>
              <td>
                <strong>{l.description}</strong>
                {l.warranty_months > 0 && (
                  <small>
                    {l.warranty_months} month warranty from delivery
                  </small>
                )}
              </td>
              <td>{l.quantity}</td>
              <td>{money(l.unit_price_minor)}</td>
              <td>{money(l.quantity * l.unit_price_minor)}</td>
              {showCost && <td>{money(l.material_cost_minor)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function QuotePanel({ data }: { data: any }) {
  const [invoice, setInvoice] = useState<any>(null);
  const q = data.quotes[0],
    p = data.project,
    s = data.surveys[0];
  return (
    <div className="detail-stack">
      <Panel
        title="Itemized quotation"
        description={
          q
            ? `Version ${q.version} · Issued ${date(q.created_at)} · ${q.status === "accepted" ? "Accepted terms are locked" : "Ready for customer review"}`
            : "Package recipes include the hardware, protection equipment and installation service."
        }
        action={
          <div className="button-row">
            {q && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer data-icon="inline-start" />
                Print
              </Button>
            )}
            {!data.order && (
              <Can roles={["admin", "sales"]}>
                <Action
                  path={`/projects/${p.id}/quotes`}
                  label={q ? "Issue new version" : "Generate quotation"}
                  disabled={s?.status !== "approved"}
                />
              </Can>
            )}
          </div>
        }
      >
        {q ? (
          <>
            <p>
              Issued to {q.customer_name_snapshot} ·{" "}
              {q.billing_address_snapshot}
            </p>
            <LineItems lines={q.lines} />
            <div className="quote-total">
              <span>
                Quotation total <small>INR · no tax configured in demo</small>
              </span>
              <strong>{money(q.total_minor)}</strong>
            </div>
            {!data.order && (
              <Can roles={["admin", "sales"]}>
                <Alert>
                  <FileText />
                  <AlertDescription>
                    Accepting this quotation creates the invoice, warehouse
                    packing task and installation job.
                  </AlertDescription>
                </Alert>
                <div className="section-actions">
                  <Action
                    path={`/projects/${p.id}/acceptance`}
                    label="Record customer acceptance"
                    body={{ quote_id: q.id }}
                  />
                </div>
              </Can>
            )}
          </>
        ) : (
          <Blank
            title={
              s?.status === "approved"
                ? "Ready to prepare a quotation"
                : "Survey approval required"
            }
          >
            {s?.status === "approved"
              ? "Generate the complete bill of materials from the selected package."
              : "Record and approve the latest site survey to unlock quoting."}
          </Blank>
        )}
      </Panel>
      {data.order && (
        <Panel
          title="Invoices & collections"
          description={`Minimum advance before packing: ${money(data.order.minimum_advance_minor)}. Cash received is separate from profit.`}
        >
          {data.invoices.map((i: any) => (
            <div className="invoice-record" key={i.id}>
              <div className="invoice-top">
                <div>
                  <h3>INV-{String(i.number).padStart(4, "0")}</h3>
                  <p>
                    {i.kind === "installation"
                      ? "Installation"
                      : "Service repair"}{" "}
                    · {date(i.issued_at)}
                  </p>
                </div>
                <Status
                  value={
                    i.paid_minor >= i.net_total_minor ? "completed" : "pending"
                  }
                />
              </div>
              <p>
                Issued to {i.customer_name_snapshot} · Billing:{" "}
                {i.billing_address_snapshot} · Service site:{" "}
                {i.service_address_snapshot}
              </p>
              <dl className="invoice-numbers">
                <div>
                  <dt>Invoice value</dt>
                  <dd>{money(i.total_minor)}</dd>
                </div>
                <div>
                  <dt>Collected</dt>
                  <dd>{money(i.paid_minor)}</dd>
                </div>
                <div>
                  <dt>Outstanding</dt>
                  <dd>{money(i.net_total_minor - i.paid_minor)}</dd>
                </div>
              </dl>
              {i.kind !== "installation" && <LineItems lines={i.lines} />}
              <InvoiceLedger id={i.id} />
              <div className="payment-history">
                {i.payments.map((pay: any) => (
                  <p key={pay.id}>
                    <CheckCircle2 />
                    {money(pay.amount_minor)}{" "}
                    <span>
                      {pay.method} · {pay.reference} · {date(pay.paid_at)}
                    </span>
                  </p>
                ))}
              </div>
              {i.paid_minor < i.net_total_minor && (
                <Can roles={["admin", "sales", "accounts"]}>
                  <Button variant="outline" onClick={() => setInvoice(i)}>
                    Record payment
                  </Button>
                </Can>
              )}
            </div>
          ))}
        </Panel>
      )}
      <Modal
        open={!!invoice}
        onClose={() => setInvoice(null)}
        title="Record payment"
        description="Record money received. Use a unique bank or cash receipt reference."
      >
        {invoice && (
          <CommandForm
            path={`/invoices/${invoice.id}/payments`}
            onDone={() => setInvoice(null)}
            submit="Save payment"
            defaults={{
              amount_minor:
                (invoice.net_total_minor - invoice.paid_minor) / 100,
              method: "bank",
              status: "verified",
            }}
            fields={[
              {
                name: "amount_minor",
                label: "Amount received (₹)",
                type: "number",
                money: true,
                min: 0.01,
                max: (invoice.net_total_minor - invoice.paid_minor) / 100,
              },
              {
                name: "method",
                label: "Payment method",
                type: "select",
                options: ["bank", "upi", "cash", "card"].map((v) => ({
                  value: v,
                  label: v.toUpperCase(),
                })),
              },
              {
                name: "status",
                label: "Payment status",
                type: "select",
                options: [
                  {
                    value: "verified",
                    label: "Verified against bank / cash records",
                  },
                  { value: "pending", label: "Pending verification" },
                ],
              },
              {
                name: "reference",
                label: "Transaction / receipt reference",
                full: true,
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
export function SubsidyPanel({ data }: { data: any }) {
  const { data: users } = useData("/users");
  const s = data.subsidy || {},
    p = data.project;
  const fields: FormField[] = [
    {
      name: "status",
      label: "Application status",
      type: "select",
      options: [
        "documents_pending",
        "submitted",
        "approved",
        "received",
        "not_applicable",
      ].map((v) => ({ value: v, label: v.replaceAll("_", " ") })),
    },
    { name: "reference", label: "Application reference", required: false },
    {
      name: "owner_id",
      label: "Case owner",
      type: "select",
      required: false,
      options: users?.items
        .filter((u: any) => ["admin", "sales", "accounts"].includes(u.role))
        .map((u: any) => ({ value: u.id, label: u.name })),
    },
    {
      name: "next_action",
      label: "Next action",
      type: "textarea",
      required: false,
      full: true,
    },
    {
      name: "documents.identity",
      label: "Identity proof collected",
      type: "checkbox",
      required: false,
    },
    {
      name: "documents.electricity_bill",
      label: "Electricity bill collected",
      type: "checkbox",
      required: false,
    },
    {
      name: "documents.bank_details",
      label: "Bank details verified",
      type: "checkbox",
      required: false,
    },
    {
      name: "documents.installation_proof",
      label: "Installation proof collected",
      type: "checkbox",
      required: false,
    },
  ];
  return (
    <Panel
      title="Subsidy paperwork"
      description="Track documents and follow-ups. Eligibility and approval are determined by the relevant authority."
    >
      <CommandForm
        key={s.updated_at || "new"}
        path={`/projects/${p.id}/subsidy`}
        submit="Save subsidy progress"
        fields={fields}
        defaults={{
          status: s.status || "documents_pending",
          reference: s.reference || "",
          next_action: s.next_action || "",
          owner_id: s.owner_id || undefined,
          documents: {
            identity: false,
            electricity_bill: false,
            bank_details: false,
            installation_proof: false,
            ...s.documents,
          },
        }}
        transform={(body) => {
          if (!body.owner_id) delete body.owner_id;
          return body;
        }}
      />
    </Panel>
  );
}
