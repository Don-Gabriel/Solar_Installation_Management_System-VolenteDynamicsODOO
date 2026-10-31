import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import {
  PageHead,
  Panel,
  Loading,
  ErrorNotice,
  CommandForm,
  Action,
  Status,
  Blank,
} from "@/components/shared";
import { useData, useCommand, date } from "@/lib/api";
import { useSession, Can } from "@/app/session";
import { Button } from "@/components/ui/button";

const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
export function Schedule() {
  const { user } = useSession(),
    [params] = useSearchParams();
  const { data, error, isPending } = useData("/schedule");
  const canPlan = ["admin", "coordinator"].includes(user.role);
  const { data: tickets } = useData("/tickets", canPlan);
  const { data: projects } = useData("/projects?limit=100", canPlan);
  const [purpose, setPurpose] = useState(
      params.get("project") ? "survey" : "repair",
    ),
    [projectId, setProject] = useState(params.get("project") || ""),
    [reason, setReason] = useState("");
  const [ticketId, setTicket] = useState(params.get("ticket") || ""),
    [from, setFrom] = useState(day(3)),
    [to, setTo] = useState(day(5)),
    [skill, setSkill] = useState("inverter_repair"),
    [duration, setDuration] = useState(2),
    [size, setSize] = useState(1),
    [query, setQuery] = useState(""),
    [slot, setSlot] = useState<any>(null),
    [crew, setCrew] = useState<string[]>([]),
    [lead, setLead] = useState("");
  useEffect(() => {
    setPurpose(params.get("project") ? "survey" : "repair");
    setProject(params.get("project") || "");
    setTicket(params.get("ticket") || "");
    setSlot(null);
    setQuery("");
  }, [params]);
  const {
    data: available,
    error: searchError,
    isFetching,
  } = useData(query, !!query);
  const booking = useCommand("/visits", () => {
    setSlot(null);
    setCrew([]);
    setQuery("");
  });
  const previous = data?.visits.find(
    (v: any) => v.id === params.get("visit") && v.status === "scheduled",
  );
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  return (
    <>
      <PageHead
        title="Visits & scheduling"
        description="One calendar for installations, surveys and repairs. Leave and travel time also block availability."
      />
      <Can roles={["admin", "coordinator"]}>
        <Panel
          title="Find a free technician or crew"
          description="Routine target: days 3–5. Search checks skills, leave, 09:00–17:00 IST working hours and a 30-minute travel buffer."
        >
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              setSlot(null);
              setQuery(
                "/schedule/availability?" +
                  new URLSearchParams({
                    from,
                    to,
                    skill,
                    duration_hours: String(duration),
                    crew_size: String(size),
                    ...(previous ? { visit_id: previous.id } : {}),
                  }),
              );
            }}
          >
            <label>
              Visit purpose
              <select
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  setSkill(
                    e.target.value === "survey" ? "survey" : "inverter_repair",
                  );
                  setSlot(null);
                  setQuery("");
                }}
              >
                <option value="repair">Repair request</option>
                <option value="survey">Site survey</option>
              </select>
            </label>
            {purpose === "repair" ? (
              <label>
                Repair request
                <select
                  required
                  value={ticketId}
                  onChange={(e) => setTicket(e.target.value)}
                >
                  <option value="">Choose a request</option>
                  {tickets
                    ?.filter(
                      (t: any) =>
                        ![
                          "closed",
                          "cancelled",
                          "awaiting_confirmation",
                        ].includes(t.status),
                    )
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        SR-{t.number} · {t.customer_name} · {t.priority}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label>
                Survey site
                <select
                  required
                  value={projectId}
                  onChange={(e) => setProject(e.target.value)}
                >
                  <option value="">Choose customer site</option>
                  {projects?.items.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.customer_name} · SP-{p.number} · {p.address}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              From
              <input
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label>
              Required skill
              <select value={skill} onChange={(e) => setSkill(e.target.value)}>
                <option value="inverter_repair">Inverter repair</option>
                <option value="battery_repair">Battery repair</option>
                <option value="installation">Installation skills</option>
                <option value="survey">Site survey</option>
              </select>
            </label>
            <label>
              Hours needed
              <input
                type="number"
                min={1}
                max={8}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <label>
              Crew size
              <input
                type="number"
                min={1}
                max={5}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </label>
            <Button disabled={isFetching} type="submit">
              {isFetching ? "Checking availability…" : "Find available times"}
            </Button>
          </form>
          <ErrorNotice error={searchError} />
          {available && (
            <>
              <p role="status">{available.message}</p>
              <div className="schedule-slots">
                {!available.slots.length &&
                  available.alternative_slots?.length > 0 && (
                    <p>
                      No crew in the requested window. These are the earliest
                      alternatives in the following seven days; confirm a new
                      date with the customer.
                    </p>
                  )}
                {[
                  ...available.slots,
                  ...(available.alternative_slots || []),
                ].map((s: any) => (
                  <button
                    type="button"
                    className={
                      slot?.starts_at === s.starts_at ? "slot selected" : "slot"
                    }
                    key={s.starts_at}
                    onClick={() => {
                      setSlot(s);
                      setCrew([]);
                      setLead("");
                    }}
                  >
                    <strong>{date(s.starts_at, true)}</strong>
                    <span>{s.candidates.length} qualified workers free</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {slot && (
            <section className="panel panel-body">
              {previous && (
                <label>
                  Reason for rescheduling
                  <input
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              )}
              <h3>
                Choose {size} {size === 1 ? "worker" : "workers"} for{" "}
                {date(slot.starts_at, true)}
              </h3>
              <div className="crew-options">
                {slot.candidates.map((t: any) => (
                  <label key={t.id}>
                    <input
                      type="checkbox"
                      checked={crew.includes(t.id)}
                      onChange={(e) => {
                        setCrew(
                          e.target.checked
                            ? [...crew, t.id]
                            : crew.filter((x) => x !== t.id),
                        );
                        if (!e.target.checked && lead === t.id) setLead("");
                      }}
                    />
                    {t.name}
                    {t.can_lead ? " · Lead qualified" : ""}
                  </label>
                ))}
              </div>
              <label>
                Crew lead
                <select value={lead} onChange={(e) => setLead(e.target.value)}>
                  <option value="">Choose lead</option>
                  {slot.candidates
                    .filter((t: any) => crew.includes(t.id) && t.can_lead)
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                disabled={
                  crew.length !== size ||
                  !lead ||
                  booking.isPending ||
                  (!!previous && !reason.trim())
                }
                onClick={() =>
                  booking.mutate({
                    ticket_id: ticketId,
                    starts_at: slot.starts_at,
                    duration_hours: duration,
                    skill,
                    technician_ids: crew,
                    lead_id: lead,
                    ...(previous
                      ? {
                          visit_id: previous.id,
                          version: previous.version,
                          reason,
                        }
                      : {}),
                  })
                }
              >
                Confirm appointment
              </Button>
              <ErrorNotice error={booking.error} />
            </section>
          )}
        </Panel>
      </Can>
      <Panel
        title={user.role === "technician" ? "My visits" : "Visit calendar"}
        description="Open the repair request to start work, record findings and finish the visit."
      >
        <div className="ticket-list">
          {data.visits.length ? (
            data.visits.map((v: any) => (
              <article className="ticket-card" key={v.id}>
                <div className="ticket-top">
                  <h3>{v.customer_name}</h3>
                  <Status value={v.status} />
                </div>
                <p>
                  {date(v.starts_at, true)} – {date(v.ends_at, true)}
                </p>
                <p>
                  {v.crew
                    .map((c: any) => c.name + (c.is_lead ? " (lead)" : ""))
                    .join(", ")}
                </p>
                {(v.leave_conflict || v.staffing_conflict) && (
                  <p role="alert" className="error-text">
                    A crew member is unavailable or no longer qualified.
                    Reassignment is needed.
                  </p>
                )}
                {!v.ticket_id && (
                  <>
                    <Link to={"/projects/" + v.project_id + "?tab=survey"}>
                      Open site survey
                    </Link>
                    <Can roles={["admin", "coordinator"]}>
                      {v.status === "scheduled" && (
                        <Link
                          to={
                            "/schedule?project=" +
                            v.project_id +
                            "&visit=" +
                            v.id
                          }
                        >
                          Reschedule survey
                        </Link>
                      )}
                    </Can>
                    <Can roles={["admin", "coordinator", "technician"]}>
                      {["scheduled", "in_progress"].includes(v.status) && (
                        <details>
                          <summary>Record survey visit outcome</summary>
                          <CommandForm
                            path={"/visits/" + v.id + "/action"}
                            submit="Save survey outcome"
                            transform={(b) => ({ ...b, version: v.version })}
                            defaults={{ action: "no_access" }}
                            fields={[
                              {
                                name: "action",
                                label: "Survey outcome",
                                type: "select",
                                options: [
                                  {
                                    value: "no_access",
                                    label: "No access / customer absent",
                                  },
                                  {
                                    value: "diagnosis_done",
                                    label:
                                      "Visit completed · measurements recorded separately",
                                  },
                                  { value: "cancel", label: "Cancel visit" },
                                ],
                              },
                              {
                                name: "reason",
                                label: "Reason and next action",
                              },
                            ]}
                          />
                        </details>
                      )}
                    </Can>
                  </>
                )}
                {v.ticket_id && (
                  <Link to={"/service?ticket=" + v.ticket_id}>
                    Open repair SR-{v.ticket_number}
                  </Link>
                )}
                {v.status === "scheduled" && (
                  <Can roles={["admin", "coordinator", "technician"]}>
                    <Action
                      path={`/visits/${v.id}/action`}
                      label="Start visit"
                      body={{ action: "start", version: v.version }}
                    />
                  </Can>
                )}
              </article>
            ))
          ) : (
            <Blank title="No appointments yet" />
          )}
        </div>
      </Panel>
      <Panel title="Installation appointments">
        <div className="ticket-list">
          {data.installations?.length ? (
            data.installations.map((j: any) => (
              <article className="ticket-card" key={j.job_id}>
                <h3>{j.customer_name}</h3>
                <p>
                  {date(j.scheduled_at, true)} · {j.technician_name}
                </p>
                <Status value={j.job_status} />
                <Link to={"/projects/" + j.id + "?tab=installation"}>
                  Open installation
                </Link>
              </article>
            ))
          ) : (
            <Blank title="No installation appointments" />
          )}
        </div>
      </Panel>
      <Can roles={["admin", "coordinator"]}>
        <Panel
          title="Record technician leave"
          description="New bookings are blocked during leave. Existing affected visits are flagged above for reassignment."
        >
          <CommandForm
            path="/staff-leave"
            submit="Save leave"
            fields={[
              {
                name: "user_id",
                label: "Technician",
                type: "select",
                options: data.technicians.map((t: any) => ({
                  value: t.id,
                  label: t.name,
                })),
              },
              {
                name: "starts_at",
                label: "Leave starts",
                type: "datetime-local",
              },
              { name: "ends_at", label: "Leave ends", type: "datetime-local" },
              { name: "reason", label: "Reason" },
            ]}
            transform={(b) => ({
              ...b,
              starts_at: new Date(b.starts_at + "+05:30").toISOString(),
              ends_at: new Date(b.ends_at + "+05:30").toISOString(),
            })}
          />
          {data.leave.map((l: any) => (
            <p key={l.id}>
              {l.name}: {date(l.starts_at, true)} – {date(l.ends_at, true)}
            </p>
          ))}
        </Panel>
      </Can>
    </>
  );
}
