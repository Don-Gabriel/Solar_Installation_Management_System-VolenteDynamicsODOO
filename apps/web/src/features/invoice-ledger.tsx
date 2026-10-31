import { useState } from "react";
import { CommandForm, ErrorNotice, Status } from "@/components/shared";
import { useData, money, date } from "@/lib/api";
import { Can, useSession } from "@/app/session";

export function InvoiceLedger({ id }: { id: string }) {
  const { user } = useSession();
  const { data: d, error } = useData(
    `/invoices/${id}/ledger`,
    ["admin", "accounts", "sales"].includes(user.role),
  );
  const [replace, setReplace] = useState(false);
  if (error) return <ErrorNotice error={error} />;
  if (!d) return null;
  const i = d.invoice,
    remaining = i.net_total_minor - i.paid_minor;
  return (
    <details className="invoice-ledger">
      <summary>Receipts, credits & corrections</summary>
      <p>
        Original value {money(i.total_minor)} · Credits{" "}
        {money(i.credited_minor)} · Current charge {money(i.net_total_minor)} ·
        Net collected {money(i.paid_minor)} ·{" "}
        {remaining < 0 ? "Refund due" : "Amount due"}{" "}
        {money(Math.abs(remaining))}
      </p>
      {d.payments.map((p: any) => (
        <div key={p.id} className="ticket-card">
          <p>
            Receipt {p.reference} · {money(p.amount_minor)} ·{" "}
            <Status value={p.reversed_at ? "reversed" : p.status} />
          </p>
          <p>{p.verification_note || p.reversal_reason}</p>
          <Can roles={["admin", "accounts"]}>
            {p.status === "pending" && (
              <CommandForm
                path={`/payments/${p.id}/verification`}
                submit="Review payment"
                defaults={{ approved: false }}
                fields={[
                  {
                    name: "approved",
                    label: "Verified against bank / cash records",
                    type: "checkbox",
                    required: false,
                  },
                  {
                    name: "note",
                    label: "Verification result and evidence reference",
                  },
                ]}
              />
            )}
            {p.status === "verified" && !p.reversed_at && (
              <details>
                <summary>Reverse incorrect receipt</summary>
                <CommandForm
                  path={`/payments/${p.id}/reversal`}
                  submit="Record receipt reversal"
                  fields={[{ name: "reason", label: "Reason for reversal" }]}
                />
              </details>
            )}
          </Can>
        </div>
      ))}
      {d.credits.map((c: any) => (
        <p key={c.id}>
          Credit note CN-{c.number} · {money(c.amount_minor)} · {c.reason} ·{" "}
          {date(c.issued_at)}
        </p>
      ))}
      {d.refunds.map((r: any) => (
        <p key={r.id}>
          Refund {r.reference} · {money(r.amount_minor)} · {r.reason}
        </p>
      ))}
      {d.replacements.map((r: any) => (
        <div key={r.id} className="ticket-card">
          <h4>Replacement invoice INV-{r.number}</h4>
          {r.lines.map((l: any) => (
            <p key={l.id}>
              {l.description} · {l.quantity} × {money(l.unit_price_minor)}
            </p>
          ))}
          <p>
            Charge {money(r.total_minor)} · Paid {money(r.paid_minor)}
          </p>
          <InvoiceLedger id={r.id} />
          <Can roles={["admin", "accounts"]}>
            {r.net_total_minor > r.paid_minor && (
              <CommandForm
                path={`/invoices/${r.id}/payments`}
                submit="Record correction payment"
                defaults={{ method: "bank", status: "pending" }}
                fields={[
                  {
                    name: "amount_minor",
                    label: "Correction payment (₹)",
                    type: "number",
                    money: true,
                    min: 0.01,
                  },
                  { name: "reference", label: "Correction receipt reference" },
                  {
                    name: "method",
                    label: "Correction payment method",
                    type: "select",
                    options: ["bank", "upi", "cash", "card"].map((v) => ({
                      value: v,
                      label: v,
                    })),
                  },
                  {
                    name: "status",
                    label: "Correction payment status",
                    type: "select",
                    options: [
                      { value: "pending", label: "Pending verification" },
                      { value: "verified", label: "Verified receipt" },
                    ],
                  },
                ]}
              />
            )}
          </Can>
        </div>
      ))}
      {d.corrections.map((c: any) => (
        <div key={c.id} className="ticket-card">
          <p>
            Correction request · {money(c.credit_minor)} · {c.reason} ·{" "}
            <Status value={c.status} />
          </p>
          {c.replacement_lines.map((l: any, n: number) => (
            <p key={n}>
              Proposed replacement: {l.description} · {l.quantity} ×{" "}
              {money(l.unit_price_minor)}
            </p>
          ))}
          <p>{c.review_note}</p>
          <Can roles={["admin", "accounts"]}>
            {c.status === "pending" &&
              (c.requested_by === user.id ? (
                <p>
                  Awaiting review by another accounts officer or administrator.
                </p>
              ) : (
                <CommandForm
                  path={`/invoice-corrections/${c.id}/review`}
                  submit="Review correction"
                  defaults={{ approved: false }}
                  fields={[
                    {
                      name: "approved",
                      label: "Approve credit and any replacement invoice",
                      type: "checkbox",
                      required: false,
                    },
                    { name: "note", label: "Correction review reason" },
                  ]}
                />
              ))}
          </Can>
        </div>
      ))}
      <Can roles={["admin", "accounts"]}>
        {i.net_total_minor > 0 && (
          <details>
            <summary>Request invoice correction</summary>
            <p>
              The original invoice and diagnosis stay unchanged. Another
              accounts officer or administrator reviews this request.
            </p>
            <label>
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />{" "}
              Issue a replacement invoice after full credit
            </label>
            <CommandForm
              key={String(replace)}
              path={`/invoices/${id}/corrections`}
              submit="Submit correction for review"
              defaults={{ credit_minor: i.net_total_minor / 100 }}
              transform={(b) => ({
                reason: b.reason,
                credit_minor: b.credit_minor,
                ...(replace
                  ? {
                      replacement_lines: [
                        {
                          description: b.description,
                          quantity: 1,
                          unit_price_minor: b.replacement_amount,
                        },
                      ],
                    }
                  : {}),
              })}
              fields={[
                {
                  name: "credit_minor",
                  label: "Credit amount (₹)",
                  type: "number",
                  money: true,
                  min: 0.01,
                  max: i.net_total_minor / 100,
                },
                {
                  name: "reason",
                  label: "Correction reason",
                  type: "textarea",
                },
                ...(replace
                  ? [
                      {
                        name: "description",
                        label: "Corrected work / item description",
                      },
                      {
                        name: "replacement_amount",
                        label: "Corrected charge (₹)",
                        type: "number" as const,
                        money: true,
                        min: 0,
                      },
                    ]
                  : []),
              ]}
            />
          </details>
        )}
        {remaining < 0 && (
          <CommandForm
            path={`/invoices/${id}/refunds`}
            submit="Record completed refund"
            defaults={{ amount_minor: -remaining / 100 }}
            fields={[
              {
                name: "amount_minor",
                label: "Refund paid (₹)",
                type: "number",
                money: true,
                min: 0.01,
                max: -remaining / 100,
              },
              { name: "reference", label: "Refund bank / cash reference" },
              { name: "reason", label: "Refund reason" },
            ]}
          />
        )}
      </Can>
    </details>
  );
}
