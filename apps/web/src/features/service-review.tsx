import { CommandForm, Panel, Status } from "@/components/shared";
import { useSession, Can } from "@/app/session";
export function ServiceReview({ data: d }: { data: any }) {
  const { user } = useSession(),
    t = d.ticket,
    active = d.visits.find((v: any) => v.status === "in_progress");
  const pending = d.reviews?.some((r: any) => r.status === "pending");
  const remote =
    ["Monitoring app", "Display reading", "Account connection"].includes(
      t.fault_code,
    ) &&
    t.priority !== "urgent" &&
    !d.visits.some((v: any) => ["scheduled", "in_progress"].includes(v.status));
  const canRequest =
    !pending &&
    !d.lines.length &&
    !["closed", "cancelled", "awaiting_confirmation"].includes(t.status) &&
    ((remote && ["admin", "support", "coordinator"].includes(user.role)) ||
      (active && ["admin", "technician"].includes(user.role)));
  if (!canRequest && !d.reviews?.length) return null;
  return (
    <Panel
      title="Remote or no-fault review"
      description="Remote support is limited to monitoring, display and account connection issues. A no-fault site visit needs a diagnostic photo; the demo policy charges the customer zero."
    >
      {canRequest && (
        <CommandForm
          path={`/tickets/${t.id}/outcome-review`}
          submit="Send outcome for review"
          defaults={{
            kind: active ? "no_fault" : "remote",
            minutes: active ? 30 : 0,
            customer_confirmation: "",
          }}
          transform={(b) => ({ ...b, version: t.version })}
          fields={[
            {
              name: "kind",
              label: "Outcome type",
              type: "select",
              options: [
                {
                  value: active ? "no_fault" : "remote",
                  label: active
                    ? "Onsite tests found no fault"
                    : "Remote support resolved the issue",
                },
              ],
            },
            {
              name: "observations",
              label: "Checks performed and outcome",
              type: "textarea",
            },
            ...(active
              ? [
                  {
                    name: "minutes",
                    label: "Actual diagnostic minutes",
                    type: "number" as const,
                    min: 1,
                    max: 720,
                  },
                ]
              : [
                  {
                    name: "customer_confirmation",
                    label: "Customer confirmation name and call reference",
                  },
                ]),
          ]}
        />
      )}
      {d.reviews?.map((r: any) => (
        <div className="ticket-card" key={r.id}>
          <p>
            {r.kind === "remote" ? "Remote support" : "No fault found"} ·{" "}
            <Status value={r.status} />
          </p>
          <p>{r.observations}</p>
          <p>{r.customer_confirmation || r.review_note}</p>
          <Can roles={["admin", "coordinator"]}>
            {r.status === "pending" &&
              (r.requested_by === user.id ? (
                <p>Awaiting another coordinator or administrator.</p>
              ) : (
                <CommandForm
                  path={`/service-reviews/${r.id}/decision`}
                  submit="Review service outcome"
                  defaults={{ approved: false }}
                  fields={[
                    {
                      name: "approved",
                      label: "Approve this documented outcome",
                      type: "checkbox",
                      required: false,
                    },
                    { name: "note", label: "Outcome review reason" },
                  ]}
                />
              ))}
          </Can>
        </div>
      ))}
    </Panel>
  );
}
export function InstallationDispute({ job: j }: { job: any }) {
  if (j.status !== "in_progress") return null;
  return (
    <Panel title="Customer handover review">
      <p>
        {j.review_required
          ? "Handover is on hold: " + j.review_reason
          : "If the customer refuses handover, record the dispute instead of inventing a signature."}
      </p>
      <Can roles={["admin", "technician"]}>
        {!j.review_required && (
          <CommandForm
            path={`/jobs/${j.id}/dispute`}
            submit="Record handover dispute"
            fields={[
              {
                name: "reason",
                label: "Customer handover concern",
                type: "textarea",
              },
            ]}
          />
        )}
      </Can>
      <Can roles={["admin", "coordinator"]}>
        {j.review_required && (
          <CommandForm
            path={`/jobs/${j.id}/dispute-review`}
            submit="Record resolution and resume handover"
            fields={[
              {
                name: "reason",
                label: "Reviewed resolution and customer agreement",
                type: "textarea",
              },
            ]}
          />
        )}
      </Can>
    </Panel>
  );
}
