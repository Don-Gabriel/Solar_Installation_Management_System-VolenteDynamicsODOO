import { Link } from "react-router";
import { Panel, CommandForm, ErrorNotice, Loading } from "@/components/shared";
import { useData, date } from "@/lib/api";
import { Can, useSession } from "@/app/session";
export function OperationalTasks() {
  const { data, error, isPending } = useData("/operational-tasks");
  const { user } = useSession();
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const open = data.items.filter((t: any) => t.status === "open");
  return (
    <Panel
      title="Needs attention"
      description="Missed visits, capacity gaps and customer follow-ups stay here until someone records an outcome."
    >
      {!open.length && !data.unacknowledged.length && (
        <p>No open exceptions.</p>
      )}
      {data.unacknowledged.map((v: any) => (
        <article className="ticket-card" key={v.visit_id + v.worker_id}>
          <h3>Worker has not confirmed attendance</h3>
          <p>
            {v.worker_name} · {v.customer_name} · {date(v.starts_at, true)}
          </p>
          <p>
            Confirmation was due {date(v.acknowledgement_due_at, true)}. Contact
            the worker or reassign the visit.
          </p>
          <Link
            to={
              v.ticket_id
                ? "/service?ticket=" + v.ticket_id
                : "/schedule?project=" + v.project_id + "&visit=" + v.visit_id
            }
          >
            Review appointment
          </Link>
        </article>
      ))}
      <div className="ticket-list">
        {open.map((t: any) => (
          <article className="ticket-card" key={t.id}>
            <h3>
              {t.kind.replaceAll("_", " ")} · {t.customer_name}
            </h3>
            <p>{t.summary}</p>
            <Link
              to={
                t.ticket_id
                  ? "/service?ticket=" + t.ticket_id
                  : "/projects/" + t.project_id
              }
            >
              Open related work
            </Link>
            {(["admin", "coordinator"].includes(user.role) ||
              (user.role === "support" && t.kind === "customer_contact")) && (
              <details>
                <summary>Record outcome</summary>
                <CommandForm
                  path={"/operational-tasks/" + t.id + "/completion"}
                  submit="Finish follow-up"
                  transform={(b) => ({ ...b, version: t.version })}
                  fields={[
                    {
                      name: "outcome",
                      label: "What was done and agreed",
                      type: "textarea",
                    },
                  ]}
                />
              </details>
            )}
          </article>
        ))}
      </div>
      <Can roles={["admin", "coordinator"]}>
        <details>
          <summary>Company holidays</summary>
          <CommandForm
            path="/holidays"
            submit="Save holiday"
            fields={[
              { name: "day", label: "Nonworking date", type: "date" },
              { name: "reason", label: "Holiday reason" },
            ]}
          />
          {data.holidays.map((h: any) => (
            <p key={h.day}>
              {h.day} · {h.reason}
            </p>
          ))}
        </details>
      </Can>
    </Panel>
  );
}
export function VisitExceptions({ visit: v }: { visit: any }) {
  const { user } = useSession();
  if (!["scheduled", "in_progress"].includes(v.status)) return null;
  return (
    <details>
      <summary>Attendance and delays</summary>
      {v.status === "scheduled" && user.role === "technician" && (
        <CommandForm
          path={"/visits/" + v.id + "/action"}
          submit="Record attendance response"
          transform={(b) => ({ ...b, version: v.version })}
          defaults={{ action: "acknowledge", reason: "Attendance confirmed" }}
          fields={[
            {
              name: "action",
              label: "Attendance response",
              type: "select",
              options: [
                { value: "acknowledge", label: "I can attend" },
                { value: "decline", label: "I cannot attend" },
              ],
            },
            { name: "reason", label: "Response reason" },
          ]}
        />
      )}
      {v.status === "in_progress" &&
        ["admin", "coordinator", "technician"].includes(user.role) && (
          <CommandForm
            path={"/visits/" + v.id + "/extension"}
            submit="Record overrun"
            transform={(b) => ({
              ...b,
              version: v.version,
              ends_at: new Date(b.ends_at + "+05:30").toISOString(),
            })}
            fields={[
              {
                name: "ends_at",
                label: "Revised end time (IST)",
                type: "datetime-local",
              },
              { name: "reason", label: "Reason for delay", type: "textarea" },
            ]}
          />
        )}
    </details>
  );
}
