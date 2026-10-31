import { Link } from "react-router";
import { CalendarDays, MapPin, ArrowUpRight, HardHat } from "lucide-react";
import {
  PageHead,
  Loading,
  ErrorNotice,
  Blank,
  Status,
} from "@/components/shared";
import { useData, date, projectNumber } from "@/lib/api";
import { useSession } from "@/app/session";
export function Jobs() {
  const { user } = useSession(),
    { data, error, isPending } = useData("/jobs");
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const active = data.items.filter((j: any) => j.job_status !== "completed"),
    finished = data.items.filter((j: any) => j.job_status === "completed");
  return (
    <>
      <PageHead
        title={
          user.role === "technician"
            ? "My installation jobs"
            : "Installation jobs"
        }
        description="The right crew, the right equipment, a clear handover."
      />
      <div className="section-heading">
        <h2>Upcoming & in progress</h2>
        <span>{active.length} jobs</span>
      </div>
      {active.length ? (
        <div className="job-grid">
          {active.map((j: any) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      ) : (
        <Blank title="You’re up to date">
          Scheduled installation work will appear here.
        </Blank>
      )}
      <div className="section-heading">
        <h2>Completed installations</h2>
        <span>{finished.length} jobs</span>
      </div>
      <div className="job-grid">
        {finished.map((j: any) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </>
  );
}
function JobCard({ job: j }: { job: any }) {
  return (
    <Link
      className="job-card"
      to={`/projects/${j.id}?tab=installation`}
      state={{ returnTo: "/jobs" }}
    >
      <div className="job-card-top">
        <span>{projectNumber(j.number)}</span>
        <Status value={j.job_status} />
      </div>
      <h3>{j.customer_name}</h3>
      <p>
        <MapPin />
        {j.address}
      </p>
      <div className="job-system">
        {j.capacity_kw} <small>kW · {j.system_type.replaceAll("_", " ")}</small>
      </div>
      <div className="job-info">
        <span>
          <CalendarDays />
          {date(j.scheduled_at, true)}
        </span>
        <span>
          <HardHat />
          {j.technician_name || "Assign a technician"}
        </span>
      </div>
      <div className="job-action">
        {j.job_status === "completed" ? "View handover" : "Open installation"}
        <ArrowUpRight />
      </div>
    </Link>
  );
}
