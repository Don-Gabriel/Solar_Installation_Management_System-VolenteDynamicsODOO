import { InstallationDispute } from "./service-review";
import { useState } from "react";
import { Link } from "react-router";
import {
  CheckCircle2,
  Package,
  ShieldCheck,
  Truck,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Panel,
  Modal,
  CommandForm,
  Action,
  Status,
  Blank,
} from "@/components/shared";
import {
  SerialScanner,
  EvidenceCapture,
  EvidenceList,
} from "@/components/capture";
import { useData, date, human, money } from "@/lib/api";
import { Can } from "@/app/session";
export function DeliveryPanel({ data }: { data: any }) {
  const o = data.order;
  if (!o)
    return (
      <Panel title="Packing & delivery">
        <Blank title="Awaiting customer acceptance">
          Accept a quotation to create the warehouse packing task.
        </Blank>
      </Panel>
    );
  const lines = o.lines.filter((l: any) => l.kind !== "service"),
    reserved = lines.every((l: any) => l.reserved),
    assets = data.assets;
  return (
    <div className="detail-columns">
      <div className="detail-stack">
        <Panel
          title="Packing checklist"
          description="Reserve stock, scan every serialized device, then release the shipment."
          action={<Status value={o.status} />}
        >
          <div className="packing-lines">
            {lines.map((l: any) => {
              const count = assets.filter(
                (a: any) => a.order_line_id === l.id && a.status !== "replaced",
              ).length;
              return (
                <div className="packing-line" key={l.id}>
                  <span
                    className={l.reserved ? "check-dot checked" : "check-dot"}
                  >
                    {l.reserved ? <CheckCircle2 /> : <Package />}
                  </span>
                  <div>
                    <strong>{l.description}</strong>
                    <small>
                      {l.quantity} required ·{" "}
                      {l.kind === "serialized"
                        ? `${count} scanned`
                        : l.reserved
                          ? "Stock reserved"
                          : "Awaiting reservation"}
                    </small>
                  </div>
                  <Status
                    value={
                      l.kind === "serialized"
                        ? count >= l.quantity
                          ? "completed"
                          : "pending"
                        : l.reserved
                          ? "reserved"
                          : "pending"
                    }
                  />
                </div>
              );
            })}
          </div>
          {o.status === "packing" && (
            <Can roles={["admin", "warehouse"]}>
              <div className="section-actions">
                {!reserved ? (
                  <Action
                    path={`/orders/${o.id}/reservations`}
                    label="Reserve stock for this order"
                  />
                ) : (
                  <Action
                    path={`/orders/${o.id}/dispatch`}
                    label="Confirm packing & dispatch"
                  />
                )}
              </div>
            </Can>
          )}
        </Panel>
        {o.status === "packing" && reserved && (
          <Can roles={["admin", "warehouse"]}>
            <Panel
              title="Scan devices"
              description="Unknown, duplicate and already allocated serials are blocked."
            >
              <SerialScanner orderId={o.id} />
            </Panel>
          </Can>
        )}
        {assets.length > 0 && (
          <Panel title="Allocated devices">
            <div className="serial-list">
              {assets.map((a: any) => (
                <div key={a.id}>
                  <div>
                    <strong>{a.serial}</strong>
                    <small>{a.product_name}</small>
                  </div>
                  <Status value={a.status} />
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
      <div className="right-stack">
        <Panel title="Delivery handover">
          <div className="delivery-icon">
            <Truck />
          </div>
          <h3>
            {o.status === "delivered"
              ? "Delivered to customer"
              : o.status === "dispatched"
                ? "On the way to the site"
                : "Preparing for dispatch"}
          </h3>
          <p>Warranty coverage starts when delivery is recorded.</p>
          <dl className="detail-grid single">
            <div>
              <dt>Dispatched</dt>
              <dd>
                {o.dispatched_at
                  ? date(o.dispatched_at, true)
                  : "Not yet dispatched"}
              </dd>
            </div>
            <div>
              <dt>Delivered</dt>
              <dd>
                {o.delivered_at
                  ? date(o.delivered_at, true)
                  : "Not yet delivered"}
              </dd>
            </div>
          </dl>
          {o.status === "dispatched" && (
            <Can roles={["admin", "warehouse"]}>
              <Action
                path={`/orders/${o.id}/delivery`}
                label="Confirm customer delivery"
              />
            </Can>
          )}
        </Panel>
        <Alert>
          <ShieldCheck />
          <AlertDescription>
            {o.status === "delivered"
              ? "Warranty dates are locked to this delivery event. Repeating delivery will not reset them."
              : "Do not mark delivery until the equipment has reached the customer. Dispatch alone does not start coverage."}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
export function InstallationPanel({ data }: { data: any }) {
  const [assign, setAssign] = useState(false);
  const [extraCrew, setExtraCrew] = useState<string[]>([]);
  const { data: users } = useData("/users");
  const j = data.job;
  if (!j)
    return (
      <Panel title="Installation">
        <Blank title="No installation job yet">
          Accept the customer’s quotation to create a job.
        </Blank>
      </Panel>
    );
  return (
    <div className="detail-stack">
      <InstallationDispute job={j} />
      <Panel
        title="Field installation"
        description="Schedule the crew, verify the system and capture customer handover."
        action={<Status value={j.status} />}
      >
        <dl className="detail-grid">
          <div>
            <dt>Assigned technician</dt>
            <dd>
              {j.crew?.length
                ? j.crew
                    .map((c: any) => c.name + (c.is_lead ? " (lead)" : ""))
                    .join(", ")
                : data.project.technician_name || "Unassigned"}
            </dd>
          </div>
          <div>
            <dt>Scheduled visit</dt>
            <dd>{date(j.scheduled_at, true)}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{j.started_at ? date(j.started_at, true) : "Not started"}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>
              {data.order?.status === "delivered"
                ? "Equipment delivered"
                : "Awaiting delivery"}
            </dd>
          </div>
        </dl>
        <div className="button-row">
          {!["completed", "in_progress"].includes(j.status) && (
            <Can roles={["admin", "coordinator"]}>
              <Button
                variant="outline"
                onClick={() => {
                  setExtraCrew(
                    j.crew
                      ?.filter((c: any) => !c.is_lead)
                      .map((c: any) => c.user_id) || [],
                  );
                  setAssign(true);
                }}
              >
                Assign technician & time
              </Button>
            </Can>
          )}
          {j.status === "scheduled" && (
            <Can roles={["admin", "technician"]}>
              <Action
                path={`/jobs/${j.id}/start`}
                label="Start installation"
                disabled={data.order?.status !== "delivered"}
              />
            </Can>
          )}
        </div>
        {j.status === "completed" && (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Installed capacity</dt>
                <dd>{j.capacity_kw} kW</dd>
              </div>
              <div>
                <dt>Generation test</dt>
                <dd>{j.generation_kw} kW</dd>
              </div>
              <div>
                <dt>Total crew labour time</dt>
                <dd>{(j.labour_minutes / 60).toFixed(1)} hours</dd>
              </div>
              <div>
                <dt>Accepted by</dt>
                <dd>{j.signer_name}</dd>
              </div>
            </dl>
            <div className="completion-checks">
              {Object.entries(j.checklist).map(([key, value]) => (
                <span key={key}>
                  <CheckCircle2 />
                  {human(key)}: {value ? "checked" : "pending"}
                </span>
              ))}
            </div>
            <EvidenceList evidence={data.evidence} />
            {!data.evidence.length && (
              <p className="field-hint">
                Synthetic historical import. No live installation evidence is
                attached to this demo record.
              </p>
            )}
          </>
        )}
      </Panel>
      {j.status === "in_progress" && (
        <Can roles={["admin", "technician"]}>
          <Panel
            title="Installation evidence"
            description="Save a real test photo and homeowner signature before completing the job."
          >
            <EvidenceCapture jobId={j.id} evidence={data.evidence} />
          </Panel>
          <Panel title="Commissioning & handover">
            <CommandForm
              path={`/jobs/${j.id}/completion`}
              submit="Complete installation & handover"
              defaults={{
                capacity_kw: data.project.capacity_kw,
                generation_kw: 0,
                labour_minutes: 180,
                ...(j.crew?.length > 1
                  ? {
                      crew_minutes: Object.fromEntries(
                        j.crew.map((c: any) => [c.user_id, 180]),
                      ),
                    }
                  : {}),
                checklist: {
                  mounting: false,
                  earthing: false,
                  wiring: false,
                  inverter: false,
                  handover: false,
                },
              }}
              fields={[
                {
                  name: "capacity_kw",
                  label: "Installed capacity (kW)",
                  type: "number",
                  min: 0.1,
                  max: 5,
                },
                {
                  name: "generation_kw",
                  label: "Measured generation (kW)",
                  type: "number",
                  min: 0,
                  max: 10,
                },
                {
                  name: "labour_minutes",
                  label:
                    j.crew?.length > 1
                      ? "Default minutes per worker (individual entries below apply)"
                      : "Total technician time (minutes)",
                  type: "number",
                  min: 1,
                  max: 10080,
                },
                ...(j.crew?.length > 1
                  ? j.crew.map((c: any) => ({
                      name: `crew_minutes.${c.user_id}`,
                      label: `Actual minutes · ${c.name}`,
                      type: "number" as const,
                      min: 0,
                      max: 10080,
                    }))
                  : []),
                { name: "signer_name", label: "Homeowner / signer name" },
                {
                  name: "checklist.mounting",
                  label: "Mounting and fasteners checked",
                  type: "checkbox",
                  required: false,
                },
                {
                  name: "checklist.earthing",
                  label: "Earthing & safety checks passed",
                  type: "checkbox",
                  required: false,
                },
                {
                  name: "checklist.wiring",
                  label: "Wiring and protection verified",
                  type: "checkbox",
                  required: false,
                },
                {
                  name: "checklist.inverter",
                  label: "Inverter and generation tested",
                  type: "checkbox",
                  required: false,
                },
                {
                  name: "checklist.handover",
                  label: "Operation explained to homeowner",
                  type: "checkbox",
                  required: false,
                },
              ]}
            />
          </Panel>
        </Can>
      )}
      <Modal
        open={assign}
        onClose={() => setAssign(false)}
        title="Schedule installation"
        description="Times are in IST. Each crew member must be free, skilled and working. The lead signs off; actual minutes can differ per worker."
      >
        <fieldset>
          <legend>Additional crew members (optional)</legend>
          <div className="crew-options">
            {users?.items
              .filter((u: any) => u.role === "technician")
              .map((u: any) => (
                <label key={u.id}>
                  <input
                    type="checkbox"
                    checked={extraCrew.includes(u.id)}
                    onChange={(e) =>
                      setExtraCrew(
                        e.target.checked
                          ? [...extraCrew, u.id]
                          : extraCrew.filter((x) => x !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
          </div>
        </fieldset>
        <CommandForm
          path={`/jobs/${j.id}/assignment`}
          onDone={() => setAssign(false)}
          submit="Save assignment"
          defaults={{
            technician_id:
              j.technician_id ||
              users?.items.find((u: any) => u.role === "technician")?.id,
            duration_hours: j.duration_hours,
            scheduled_at: j.scheduled_at
              ? new Date(new Date(j.scheduled_at).getTime() + 330 * 60000)
                  .toISOString()
                  .slice(0, 16)
              : "",
          }}
          transform={(b) => ({
            ...b,
            scheduled_at: new Date(b.scheduled_at + "+05:30").toISOString(),
            technician_ids: [...new Set([b.technician_id, ...extraCrew])],
          })}
          fields={[
            {
              name: "technician_id",
              label: "Technician",
              type: "select",
              options: users?.items
                .filter((u: any) => u.role === "technician")
                .map((u: any) => ({ value: u.id, label: u.name })),
              full: true,
            },
            {
              name: "scheduled_at",
              label: "Start date & time",
              type: "datetime-local",
            },
            {
              name: "duration_hours",
              label: "Expected duration (hours)",
              type: "number",
              min: 1,
              max: 12,
            },
          ]}
        />
      </Modal>
    </div>
  );
}
export function PassportPanel({ data }: { data: any }) {
  return (
    <Panel
      title="Asset passport"
      description="Each device connects to the customer, delivery date, warranty and service history."
    >
      {data.warranties.length ? (
        <div className="passport-grid">
          {data.warranties.map((w: any) => {
            const covered =
              new Date() >= new Date(w.starts_at) &&
              new Date() < new Date(w.expires_at);
            return (
              <article className="passport" key={w.id}>
                <div className="passport-heading">
                  <ShieldCheck />
                  <Status value={covered ? "covered" : "expired"} />
                </div>
                <h3>{w.product_name}</h3>
                <p className="serial-number">
                  {w.serial || `${w.quantity} quantity-tracked units`}
                </p>
                <dl>
                  <div>
                    <dt>Delivered / coverage begins</dt>
                    <dd>{date(w.starts_at)}</dd>
                  </div>
                  <div>
                    <dt>Coverage ends</dt>
                    <dd>{date(w.expires_at)}</dd>
                  </div>
                  <div>
                    <dt>Policy snapshot</dt>
                    <dd>{w.policy_months} months</dd>
                  </div>
                </dl>
                <Can roles={["admin", "support"]}>
                  <Button
                    variant="outline"
                    render={
                      <Link
                        to={`/service?search=${encodeURIComponent(w.serial || data.project.customer_name)}`}
                      />
                    }
                    nativeButton={false}
                  >
                    View service history
                  </Button>
                </Can>
              </article>
            );
          })}
        </div>
      ) : (
        <Blank title="Coverage begins at delivery">
          Deliver the order to generate the warranty records from the accepted
          product policies.
        </Blank>
      )}
    </Panel>
  );
}
