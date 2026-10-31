import { Link } from "react-router";
import {
  ArrowUpRight,
  Sun,
  Clock3,
  ShieldCheck,
  Package,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHead,
  Panel,
  Loading,
  ErrorNotice,
  NewProjectLink,
  ProjectList,
  stages,
  Blank,
} from "@/components/shared";
import { useData, human, money, date } from "@/lib/api";
import { useSession, Can } from "@/app/session";
export function Overview() {
  const { data, error, isPending } = useData("/dashboard");
  const { user } = useSession();
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const total = data.counts.reduce((s: number, c: any) => s + c.count, 0),
    active = data.counts
      .filter((c: any) => c.stage !== "completed")
      .reduce((s: number, c: any) => s + c.count, 0),
    completed =
      data.counts.find((c: any) => c.stage === "completed")?.count || 0;
  return (
    <>
      <PageHead
        title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${user.name.split(" ")[0]}`}
        description="Here’s what’s moving across your solar operations."
      >
        <Can roles={["admin", "sales"]}>
          <NewProjectLink />
        </Can>
      </PageHead>
      <Panel
        title="What would you like to work on?"
        description="Choose a task. Each project shows the next step and the team responsible."
      >
        <div className="work-shortcuts">
          <Link to="/projects">
            <span>Customers & projects</span>
            <strong>Find a customer or continue a project</strong>
            <ArrowUpRight />
          </Link>
          <Can roles={["admin", "warehouse"]}>
            <Link to="/inventory">
              <span>Stock & delivery</span>
              <strong>Pack equipment or confirm delivery</strong>
              <ArrowUpRight />
            </Link>
          </Can>
          <Can roles={["admin", "surveyor"]}>
            <Link to="/projects?status=survey">
              <span>Roof surveys</span>
              <strong>Review site checks and approvals</strong>
              <ArrowUpRight />
            </Link>
          </Can>
          <Can roles={["admin", "technician"]}>
            <Link to="/jobs">
              <span>Installation jobs</span>
              <strong>Open assigned work and handover</strong>
              <ArrowUpRight />
            </Link>
          </Can>
          <Can roles={["admin", "sales"]}>
            <Link to="/projects?status=quoted">
              <span>Customer decisions</span>
              <strong>Follow up on quotations</strong>
              <ArrowUpRight />
            </Link>
          </Can>
          <Can roles={["admin", "support"]}>
            <Link to="/service">
              <span>Repairs</span>
              <strong>Check a warranty or resolve a fault</strong>
              <ArrowUpRight />
            </Link>
          </Can>
          <Can roles={["admin", "accounts"]}>
            <Link to="/reports">
              <span>Money</span>
              <strong>Review payments and job costs</strong>
              <ArrowUpRight />
            </Link>
          </Can>
        </div>
      </Panel>
      <div className="metrics">
        <div className="metric">
          <span>
            <Sun />
            Active projects
          </span>
          <strong>
            {active}
            <small> / {total}</small>
          </strong>
          <p>Across your installation pipeline</p>
        </div>
        <div className="metric">
          <span>
            <ShieldCheck />
            Installed
          </span>
          <strong>{completed}</strong>
          <p>Installations handed over</p>
        </div>
        <div className="metric">
          <span>
            <Clock3 />
            {data.finance ? "Cash collected" : "Scheduled work"}
          </span>
          <strong>
            {data.finance
              ? money(data.finance.cash_received_minor)
              : data.jobs.length}
          </strong>
          <p>
            {data.finance
              ? "Received this month · not profit"
              : "Upcoming and in-progress jobs"}
          </p>
        </div>
        <div className="metric">
          <span>
            <Package />
            {data.open_tickets === null
              ? "Assigned projects"
              : "Open service cases"}
          </span>
          <strong>{data.open_tickets ?? total}</strong>
          <p>
            {data.open_tickets === null
              ? "Your field workspace"
              : "Keep customers generating"}
          </p>
        </div>
      </div>
      <Panel
        title="Installation pipeline"
        description="A clear next step for every rooftop."
        action={
          <Link className="text-link" to="/projects">
            All projects <ArrowUpRight />
          </Link>
        }
      >
        <div className="pipeline">
          {stages.map((s) => (
            <Link
              to={`/projects?status=${s}`}
              key={s}
              className={`pipeline-step pipeline-${s}`}
            >
              <span className="pipeline-marker" />
              <strong>
                {data.counts.find((c: any) => c.stage === s)?.count || 0}
              </strong>
              <span>{human(s)}</span>
            </Link>
          ))}
        </div>
      </Panel>
      <div className="overview-grid">
        <Panel
          title="Projects in focus"
          description="Recently added customer journeys."
          action={
            <Link className="text-link" to="/projects">
              View all <ArrowUpRight />
            </Link>
          }
        >
          <ProjectList items={data.projects.slice(0, 5)} compact />
        </Panel>
        <div className="right-stack">
          <Panel
            title="Crew schedule"
            action={<CalendarDays className="muted-icon" />}
          >
            {data.jobs.length ? (
              data.jobs.slice(0, 3).map((j: any) => (
                <Link
                  className="schedule-item"
                  to={`/projects/${j.id}?tab=installation`}
                  key={j.id}
                >
                  <span className="schedule-date">
                    {j.scheduled_at ? new Date(j.scheduled_at).getDate() : "—"}
                    <small>
                      {j.scheduled_at
                        ? new Intl.DateTimeFormat("en", {
                            month: "short",
                          }).format(new Date(j.scheduled_at))
                        : "TBD"}
                    </small>
                  </span>
                  <div>
                    <strong>{j.customer_name}</strong>
                    <small>{j.technician_name || "Assign a technician"}</small>
                    <small>{date(j.scheduled_at, true)}</small>
                  </div>
                </Link>
              ))
            ) : (
              <Blank title="No scheduled work" />
            )}
          </Panel>
          {data.low_stock.length > 0 && (
            <Panel
              title="Stock needs attention"
              description="Available quantity after reservations."
            >
              {data.low_stock.map((p: any) => (
                <Link className="stock-warning" to="/inventory" key={p.id}>
                  <Package />
                  <span>{p.name}</span>
                  <strong>{p.available} left</strong>
                </Link>
              ))}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
