import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import {
  PageHead,
  Panel,
  Modal,
  CommandForm,
  Action,
  Loading,
  ErrorNotice,
  Status,
  Blank,
} from "@/components/shared";
import { useData, useCommand, date, money } from "@/lib/api";
import { Can, useSession } from "@/app/session";
import { Button } from "@/components/ui/button";
import { EvidenceCapture, EvidenceList } from "@/components/capture";

export function Service() {
  const [params, setParams] = useSearchParams(),
    [creating, setCreating] = useState(false),
    [project, setProject] = useState("");
  const search = params.get("search") || "",
    id = params.get("ticket"),
    status = params.get("status") || "";
  const { data: tickets, error, isPending } = useData("/tickets");
  const { data: projects } = useData(
    "/projects?limit=100&search=" + encodeURIComponent(search),
  );
  if (id)
    return (
      <RepairDetail
        id={id}
        onBack={() => {
          const next = new URLSearchParams(params);
          next.delete("ticket");
          setParams(next);
        }}
      />
    );
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const visible = tickets
    .filter((t: any) => !status || t.status === status)
    .filter((t: any) =>
      `${t.customer_name} ${t.phone} ${t.complaint} ${t.number}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <PageHead
        title="Repairs & warranty"
        description="Record the customer's problem first. The assigned crew identifies faulty components at the site."
      >
        <Can roles={["admin", "support", "coordinator"]}>
          <Button
            onClick={() => {
              setProject("");
              setCreating(true);
            }}
          >
            New repair request
          </Button>
        </Can>
      </PageHead>
      <Panel
        title="Service requests"
        description="Urgent requests appear first. A ticket stays open until the customer confirms the repair."
      >
        <label>
          Request stage
          <select
            value={status}
            onChange={(e) =>
              setParams({
                ...Object.fromEntries(params),
                status: e.target.value,
              })
            }
          >
            <option value="">All requests</option>
            {[
              "open",
              "scheduled",
              "in_progress",
              "diagnosed",
              "waiting_parts",
              "awaiting_confirmation",
              "disputed",
              "closed",
              "cancelled",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Find customer or request
          <input
            value={search}
            onChange={(e) =>
              setParams(e.target.value ? { search: e.target.value } : {})
            }
            placeholder="Customer, phone, request number or complaint"
          />
        </label>
        <div className="ticket-list">
          {visible.length ? (
            visible.map((t: any) => (
              <article className="ticket-card" key={t.id}>
                <div className="ticket-top">
                  <div>
                    <span className="ticket-ref">SR-{t.number}</span>
                    <h3>{t.customer_name}</h3>
                  </div>
                  <Status value={t.status} />
                </div>
                <p>{t.complaint}</p>
                <p>
                  {t.priority === "urgent" ? "Urgent · " : ""}
                  {t.technician_name || "Awaiting coordinator assignment"}
                </p>
                <Button
                  onClick={() =>
                    setParams({ ...Object.fromEntries(params), ticket: t.id })
                  }
                >
                  Open repair request
                </Button>
              </article>
            ))
          ) : (
            <Blank title="No matching repair requests" />
          )}
        </div>
      </Panel>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Customer repair call"
        description="A component or warranty does not need to be chosen until diagnosis."
      >
        <label>
          Find customer's installation
          <input
            value={search}
            onChange={(e) => (
              setProject(""),
              setParams(e.target.value ? { search: e.target.value } : {})
            )}
          />
        </label>
        <label>
          Installation
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Choose delivered installation</option>
            {projects?.items
              .filter((p: any) => ["delivered", "completed"].includes(p.stage))
              .map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.customer_name} · SP-{p.number} · {p.address}
                </option>
              ))}
          </select>
        </label>
        {project && (
          <CommandForm
            path="/tickets"
            submit="Save repair request"
            onDone={() => setCreating(false)}
            transform={(b) => ({ ...b, project_id: project })}
            defaults={{ fault_code: "Low generation", priority: "routine" }}
            fields={[
              {
                name: "fault_code",
                label: "Problem category",
                type: "select",
                options: [
                  "No power",
                  "Low generation",
                  "Inverter warning",
                  "Battery issue",
                  "Wiring or connection",
                  "Physical damage",
                  "Other",
                ].map((v) => ({ label: v, value: v })),
              },
              {
                name: "priority",
                label: "Priority",
                type: "select",
                options: [
                  { value: "routine", label: "Routine · target days 3–5" },
                  { value: "urgent", label: "Urgent · coordinator escalation" },
                ],
              },
              {
                name: "complaint",
                label: "What the customer reported",
                type: "textarea",
                full: true,
              },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
function RepairDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useSession(),
    { data: d, error, isPending } = useData("/tickets/" + id),
    [draft, setDraft] = useState<any[]>([]);
  const diagnosis = useCommand(`/tickets/${id}/diagnosis`);
  useEffect(() => {
    if (d)
      setDraft(
        d.lines.map((l: any) => ({
          ...l,
          coverage: l.coverage_override || "auto",
          labour_coverage: l.labour_coverage_override || "auto",
          labour_price: l.labour_price_minor / 100,
          callout_price: l.callout_price_minor / 100,
          selling_price: l.unit_price_minor / 100,
        })),
      );
  }, [d?.ticket.id, d?.ticket.version]);
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const t = d.ticket,
    active = d.visits.find((v: any) => v.status === "in_progress"),
    scheduled = d.visits.find((v: any) => v.status === "scheduled"),
    canEdit =
      ["admin", "coordinator", "technician"].includes(user.role) &&
      active &&
      !["closed", "cancelled", "awaiting_confirmation"].includes(t.status),
    reviewer = ["admin", "coordinator"].includes(user.role);
  const key = (c: any) => c.order_line_id + ":" + (c.asset_id || "");
  const update = (i: number, k: string, v: any) =>
    setDraft(draft.map((l, j) => (i === j ? { ...l, [k]: v } : l)));
  function toggle(c: any) {
    const found = draft.find((l) => key(l) === key(c));
    setDraft(
      found
        ? draft.filter((l) => key(l) !== key(c))
        : [
            ...draft,
            {
              ...c,
              quantity: 1,
              finding: "",
              action: "repair",
              replacement_serial: "",
              labour_minutes: 60,
              labour_price: 500,
              callout_price: 0,
              selling_price: c.price_minor / 100,
              coverage: "auto",
              labour_coverage: "auto",
            },
          ],
    );
  }
  const total = d.lines.reduce(
    (s: number, l: any) =>
      s +
      ((l.covered ? 0 : l.unit_price_minor * l.quantity) +
        (l.labour_covered ? 0 : l.labour_price_minor + l.callout_price_minor)),
    0,
  );
  return (
    <>
      <Button variant="ghost" onClick={onBack}>
        ← Back to repair requests
      </Button>
      <PageHead
        title={`SR-${t.number} · ${d.project.customer_name}`}
        description={d.project.address}
      >
        <Status value={t.status} />
      </PageHead>
      <Panel title="Customer request" description={t.complaint}>
        <p>
          {d.project.phone} · {t.fault_code} · {t.priority} priority
        </p>
        <p>
          Opened {date(t.opened_at, true)}. Coverage is evaluated for each
          component at the complaint time.
        </p>
        <Can roles={["admin", "coordinator"]}>
          {!["closed", "cancelled", "awaiting_confirmation"].includes(
            t.status,
          ) && (
            <Button
              render={
                <Link
                  to={`/schedule?ticket=${id}${scheduled ? "&visit=" + scheduled.id : ""}`}
                />
              }
              nativeButton={false}
            >
              {scheduled
                ? "Reschedule appointment"
                : "Find technician and schedule visit"}
            </Button>
          )}
        </Can>
      </Panel>
      <Panel title="Visit and crew">
        {d.visits.length ? (
          d.visits.map((v: any) => (
            <div className="visit-row" key={v.id}>
              <strong>{date(v.starts_at, true)}</strong>
              <p>
                {v.crew
                  .map((c: any) => c.name + (c.is_lead ? " (lead)" : ""))
                  .join(", ")}{" "}
                · {v.status}
              </p>
              <Can roles={["admin", "coordinator", "technician"]}>
                {v.status === "scheduled" && (
                  <Action
                    path={`/visits/${v.id}/action`}
                    label="Start visit"
                    body={{ action: "start", version: v.version }}
                  />
                )}
                {["scheduled", "in_progress"].includes(v.status) && (
                  <details>
                    <summary>Reschedule, no access or parts needed</summary>
                    <CommandForm
                      path={`/visits/${v.id}/action`}
                      submit="Record visit outcome"
                      transform={(b) => ({ ...b, version: v.version })}
                      defaults={{ action: "no_access" }}
                      fields={[
                        {
                          name: "action",
                          label: "Outcome",
                          type: "select",
                          options: [
                            {
                              value: "no_access",
                              label: "Customer unavailable / no access",
                            },
                            {
                              value: "diagnosis_done",
                              label: "Diagnosis done · return visit needed",
                            },
                            { value: "cancel", label: "Cancel appointment" },
                          ],
                        },
                        {
                          name: "reason",
                          label: "Reason and next action",
                          type: "textarea",
                        },
                      ]}
                    />
                  </details>
                )}
              </Can>
            </div>
          ))
        ) : (
          <Blank title="Awaiting an appointment" />
        )}
      </Panel>
      <Panel
        title="Installed equipment"
        description="These records belong to this customer's installation. Select the faulty items after starting the visit."
      >
        <div className="component-grid">
          {d.components.map((c: any) => (
            <article className="component-choice" key={key(c)}>
              <label>
                {canEdit && (
                  <input
                    type="checkbox"
                    disabled={c.asset_status === "replaced"}
                    checked={draft.some((l) => key(l) === key(c))}
                    onChange={() => toggle(c)}
                  />
                )}
                <strong>{c.description}</strong>
              </label>
              <p>
                {c.serial || `${c.quantity} installed units`}
                {c.asset_status === "replaced"
                  ? " · Replaced historical device"
                  : ""}
              </p>
              <p>
                {c.covered
                  ? "Within warranty"
                  : c.warranty_id
                    ? "Warranty expired"
                    : "No recorded warranty"}
                {c.expires_at ? " · Until " + date(c.expires_at) : ""}
              </p>
            </article>
          ))}
        </div>
      </Panel>
      {canEdit && (
        <Panel
          title="Fault findings and proposed work"
          description="Saving changes removes previous approval. Prices are shown separately from company costs; covered work stays free to the customer."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              diagnosis.mutate({
                version: t.version,
                lines: draft.map((l) => ({
                  order_line_id: l.order_line_id,
                  ...(l.asset_id ? { asset_id: l.asset_id } : {}),
                  quantity: Number(l.quantity),
                  finding: l.finding,
                  action: l.action,
                  replacement_serial: l.replacement_serial || "",
                  labour_minutes: Number(l.labour_minutes),
                  labour_price_minor: Math.round(Number(l.labour_price) * 100),
                  callout_price_minor: Math.round(
                    Number(l.callout_price || 0) * 100,
                  ),
                  ...(reviewer
                    ? {
                        coverage: l.coverage,
                        labour_coverage: l.labour_coverage || "auto",
                        coverage_reason: l.coverage_reason || "",
                        unit_price_minor:
                          l.action === "replace"
                            ? Math.round(Number(l.selling_price) * 100)
                            : 0,
                      }
                    : {}),
                })),
              });
            }}
          >
            {draft.map((l, i) => (
              <fieldset className="diagnosis-line" key={key(l)}>
                <legend>
                  {l.description} {l.serial || ""}
                </legend>
                <div className="form-grid">
                  <label>
                    Fault found
                    <textarea
                      required
                      value={l.finding}
                      onChange={(e) => update(i, "finding", e.target.value)}
                    />
                  </label>
                  <label>
                    Work needed
                    <select
                      value={l.action}
                      onChange={(e) => update(i, "action", e.target.value)}
                    >
                      <option value="repair">Repair existing component</option>
                      <option value="replace">Replace component</option>
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      required
                      type="number"
                      min={1}
                      max={l.asset_id ? 1 : 1000}
                      value={l.quantity}
                      onChange={(e) => update(i, "quantity", e.target.value)}
                    />
                  </label>
                  {l.action === "replace" && l.asset_id && (
                    <label>
                      Replacement device
                      <select
                        required
                        value={l.replacement_serial || ""}
                        onChange={(e) =>
                          update(i, "replacement_serial", e.target.value)
                        }
                      >
                        <option value="">Choose available serial</option>
                        {d.spares
                          .filter((s: any) => s.product_id === l.product_id)
                          .map((s: any) => (
                            <option key={s.serial} value={s.serial}>
                              {s.serial}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Actual labour minutes
                    <input
                      required
                      type="number"
                      min={0}
                      max={10080}
                      value={l.labour_minutes}
                      onChange={(e) =>
                        update(i, "labour_minutes", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Labour selling price (₹)
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.labour_price}
                      onChange={(e) =>
                        update(i, "labour_price", e.target.value)
                      }
                    />
                  </label>
                  {reviewer && (
                    <>
                      <label>
                        Callout charge (₹)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.callout_price}
                          onChange={(e) =>
                            update(i, "callout_price", e.target.value)
                          }
                        />
                        <small>
                          Agreed travel charge for this work. Uses the labour
                          coverage decision.
                        </small>
                      </label>
                      <label>
                        Part selling price per unit (₹)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={l.action !== "replace"}
                          value={l.selling_price}
                          onChange={(e) =>
                            update(i, "selling_price", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Coverage decision
                        <select
                          value={l.coverage}
                          onChange={(e) =>
                            update(i, "coverage", e.target.value)
                          }
                        >
                          <option value="auto">
                            Use saved warranty policy
                          </option>
                          <option value="covered">
                            Covered exception / goodwill
                          </option>
                          <option value="chargeable">
                            Not covered / exclusion
                          </option>
                        </select>
                      </label>
                      <label>
                        Labour coverage
                        <select
                          value={l.labour_coverage || "auto"}
                          onChange={(e) =>
                            update(i, "labour_coverage", e.target.value)
                          }
                        >
                          <option value="auto">Same as part policy</option>
                          <option value="covered">Labour covered</option>
                          <option value="chargeable">Labour chargeable</option>
                        </select>
                      </label>
                      {(l.coverage !== "auto" ||
                        (l.labour_coverage &&
                          l.labour_coverage !== "auto")) && (
                        <label>
                          Decision reason
                          <input
                            required
                            value={l.coverage_reason || ""}
                            onChange={(e) =>
                              update(i, "coverage_reason", e.target.value)
                            }
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
              </fieldset>
            ))}
            <Button
              type="submit"
              disabled={!draft.length || diagnosis.isPending}
            >
              Save diagnosis and estimate
            </Button>
            <ErrorNotice error={diagnosis.error} />
          </form>
        </Panel>
      )}
      {d.lines.length > 0 && (
        <Panel
          title="Repair estimate"
          description={`Customer payable ${money(total)} · ${t.estimate_status === "approved" ? "Approved by recorded customer agreement" : "Awaiting review and approval"}`}
        >
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Repair estimate"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Work</th>
                  <th>Coverage</th>
                  <th>Customer pays</th>
                </tr>
              </thead>
              <tbody>
                {d.lines.map((l: any) => (
                  <tr key={l.id}>
                    <td>
                      {l.description} × {l.quantity}
                      <small>{l.finding}</small>
                    </td>
                    <td>
                      {l.action}
                      {l.replacement_serial ? " · " + l.replacement_serial : ""}
                    </td>
                    <td>
                      {l.covered ? "Part covered" : "Part chargeable"} ·{" "}
                      {l.labour_covered
                        ? "Labour covered"
                        : "Labour chargeable"}
                      <small>{l.coverage_reason}</small>
                    </td>
                    <td>
                      {money(
                        (l.covered ? 0 : l.unit_price_minor * l.quantity) +
                          (l.labour_covered
                            ? 0
                            : l.labour_price_minor + l.callout_price_minor),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Can roles={["admin", "coordinator", "support", "accounts"]}>
            {t.estimate_status === "draft" && t.status === "diagnosed" && (
              <CommandForm
                path={`/tickets/${id}/approval`}
                submit="Record approval"
                transform={(b) => ({ ...b, version: t.version })}
                fields={[
                  {
                    name: "confirmed_by",
                    label: total
                      ? "Customer approval name and reference"
                      : "Covered-work review reference",
                    full: true,
                  },
                ]}
              />
            )}
          </Can>
        </Panel>
      )}
      <Can roles={["admin", "technician"]}>
        {active && (
          <>
            <Panel
              title="After-repair photo and signature"
              description="Save a photo from this visit before completion. An old visit's photo cannot complete a new visit."
            >
              <EvidenceCapture jobId="" ticketId={id} evidence={d.evidence} />
            </Panel>
            <Panel title="Complete physical repair">
              <CommandForm
                path={`/tickets/${id}/resolution`}
                submit="Complete repair and create service document"
                transform={(b) => ({ ...b, version: t.version })}
                fields={[
                  {
                    name: "resolution",
                    label: "Work completed and test result",
                    type: "textarea",
                    full: true,
                  },
                ]}
              />
            </Panel>
          </>
        )}
      </Can>
      {d.evidence.length > 0 && (
        <Panel title="Saved repair evidence">
          {d.evidence.some(
            (e: any) => e.diagnosis_revision !== t.diagnosis_revision,
          ) && (
            <p>
              Earlier evidence is kept for history. Changed work needs a new
              completion photo and approval; previous signatures do not confirm
              this diagnosis.
            </p>
          )}
          <EvidenceList evidence={d.evidence} />
        </Panel>
      )}
      {d.invoices.map((invoice: any) => (
        <Panel
          className="service-document"
          key={invoice.id}
          title={`Service ${invoice.total_minor ? "invoice" : "statement"} INV-${invoice.number}`}
          description="Demo service document · tax not configured. Original installation invoice remains unchanged."
          action={
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          }
        >
          <p>
            {d.project.customer_name} · Issued {date(invoice.issued_at)}
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Service invoice"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Work or replacement</th>
                  <th>Qty</th>
                  <th>Value</th>
                  <th>Warranty credit</th>
                  <th>Payable</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((l: any) => (
                  <tr key={l.id}>
                    <td>
                      {l.description}
                      <small>
                        {l.original_serial &&
                          `${l.original_serial} → ${l.replacement_serial}`}
                      </small>
                      <small>{l.coverage_reason}</small>
                    </td>
                    <td>{l.quantity}</td>
                    <td>
                      {money(
                        (l.gross_unit_price_minor ?? l.unit_price_minor) *
                          l.quantity,
                      )}
                    </td>
                    <td>{money(l.warranty_credit_minor * l.quantity)}</td>
                    <td>{money(l.unit_price_minor * l.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>Total {money(invoice.total_minor)}</strong> · Paid{" "}
            {money(invoice.paid_minor)} · Balance{" "}
            {money(invoice.total_minor - invoice.paid_minor)}
          </p>
          <Can roles={["admin", "accounts"]}>
            {invoice.total_minor > invoice.paid_minor && (
              <CommandForm
                path={`/invoices/${invoice.id}/payments`}
                submit="Record service payment"
                defaults={{
                  amount_minor: invoice.total_minor - invoice.paid_minor,
                  method: "bank",
                }}
                fields={[
                  {
                    name: "amount_minor",
                    label: "Amount (₹)",
                    type: "number",
                    money: true,
                    min: 0.01,
                  },
                  {
                    name: "method",
                    label: "Method",
                    type: "select",
                    options: ["bank", "upi", "cash", "card"].map((v) => ({
                      label: v,
                      value: v,
                    })),
                  },
                  { name: "reference", label: "Receipt reference" },
                ]}
              />
            )}
          </Can>
        </Panel>
      ))}
      {d.returns.length > 0 && (
        <Panel title="Faulty equipment return">
          {d.returns.map((r: any) => (
            <div key={r.id}>
              <p>
                {r.original_serial} → {r.replacement_serial} · {r.status}
              </p>
              <Can roles={["admin", "warehouse"]}>
                {r.status === "pending_return" && (
                  <CommandForm
                    path={`/service-returns/${r.id}/receive`}
                    submit="Receive into quarantine"
                    fields={[
                      {
                        name: "confirmed_by",
                        label: "Return receipt / condition note",
                      },
                    ]}
                  />
                )}
              </Can>
            </div>
          ))}
        </Panel>
      )}
      <Can roles={["admin", "support"]}>
        {t.status === "awaiting_confirmation" && (
          <Panel title="Customer confirmation">
            <CommandForm
              path={`/tickets/${id}/confirmation`}
              submit="Customer confirmed · close request"
              fields={[
                {
                  name: "confirmed_by",
                  label: "Customer name and confirmation method",
                },
              ]}
            />
          </Panel>
        )}
      </Can>
      <Panel title="Service history">
        {t.parent_ticket_id && (
          <p>
            <Link to={"/service?ticket=" + t.parent_ticket_id}>
              Original request
            </Link>
          </p>
        )}
        {d.history?.map((h: any) => (
          <p key={h.id}>
            <Link to={"/service?ticket=" + h.id}>SR-{h.number}</Link> ·{" "}
            {h.status} · {h.complaint}
          </p>
        ))}
        <Can roles={["admin", "support", "coordinator"]}>
          {["closed", "disputed", "awaiting_confirmation"].includes(
            t.status,
          ) && (
            <details>
              <summary>Record a related follow-up problem</summary>
              <CommandForm
                path="/tickets"
                submit="Create linked follow-up"
                transform={(b) => ({
                  ...b,
                  parent_ticket_id: id,
                  project_id: t.project_id,
                })}
                fields={[
                  {
                    name: "fault_code",
                    label: "Follow-up problem category",
                    type: "select",
                    options: [
                      "Same fault again",
                      "Replacement failed",
                      "Different fault",
                    ].map((v) => ({ value: v, label: v })),
                  },
                  {
                    name: "complaint",
                    label: "What happened after the last repair",
                    type: "textarea",
                    full: true,
                  },
                ]}
              />
            </details>
          )}
        </Can>
      </Panel>
      <Panel title="Contact history">
        {d.events.map((e: any) => (
          <p key={e.id}>
            <strong>{e.actor_name}</strong> · {date(e.created_at, true)}
            <br />
            {e.note}
          </p>
        ))}
        <Can roles={["admin", "coordinator", "support"]}>
          <CommandForm
            path={`/tickets/${id}/note`}
            submit="Save contact update"
            defaults={{ action: "note" }}
            transform={(b) => ({ ...b, version: t.version })}
            fields={[
              {
                name: "action",
                label: "Update",
                type: "select",
                options: [
                  { value: "note", label: "Add call / follow-up note" },
                  ...(![
                    "closed",
                    "awaiting_confirmation",
                    "cancelled",
                  ].includes(t.status)
                    ? [{ value: "cancel", label: "Cancel request" }]
                    : []),
                  ...(["awaiting_confirmation", "diagnosed"].includes(t.status)
                    ? [
                        {
                          value: "dispute",
                          label: "Customer disputes diagnosis / repair",
                        },
                      ]
                    : []),
                ],
              },
              {
                name: "note",
                label: "What happened and next action",
                type: "textarea",
                full: true,
              },
            ]}
          />
        </Can>
      </Panel>
    </>
  );
}
