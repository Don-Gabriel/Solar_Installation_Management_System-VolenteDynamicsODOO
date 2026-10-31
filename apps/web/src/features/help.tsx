import { useState } from "react";
import { Link } from "react-router";
import screenGuide from "../../../../docs/screen-guide.json";
import { useSession } from "@/app/session";
import { roleNames } from "@/lib/workflow";
import { PageHead, Panel } from "@/components/shared";
import { Input } from "@/components/ui/input";
export function Help() {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  return (
    <>
      <PageHead
        title="Screen guide"
        description="What each screen does, which team uses it and what to do next."
      />
      <Panel title="Four kinds of information">
        <div className="guide-categories">
          <div>
            <h3>Choose</h3>
            <p>
              System type, size, direction, staff, status and problem category
              use fixed choices.
            </p>
          </div>
          <div>
            <h3>Measure or type</h3>
            <p>
              Names, addresses, actual readings, money amounts and receipt
              references need accurate entry.
            </p>
          </div>
          <div>
            <h3>Scan or upload</h3>
            <p>
              Device barcodes, photos and signatures are captured rather than
              retyped.
            </p>
          </div>
          <div>
            <h3>Filled by the app</h3>
            <p>
              Package items, totals, project numbers, dates of saved events and
              warranties come from the saved records.
            </p>
          </div>
        </div>
      </Panel>
      <label className="guide-search">
        Find a screen
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Try payment, stock or survey…"
        />
      </label>
      <div className="guide-list">
        {screenGuide
          .filter((s) =>
            `${s.title} ${s.purpose}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((s) => (
            <details key={s.id} className="panel guide-item">
              <summary>
                <strong>{s.title}</strong>
                <span>
                  {s.roles.includes(user.role) || s.roles.includes("public")
                    ? "Available for your role"
                    : "Used by another team"}
                </span>
              </summary>
              <div className="panel-body">
                <p>{s.purpose}</p>
                <p>
                  <strong>Who uses it:</strong>{" "}
                  {s.roles.map((r) => roleNames[r] || "Visitor").join(", ")}
                </p>
                <h3>Options</h3>
                <ul>
                  {s.options.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                <h3>Fields</h3>
                <ul>
                  {s.fields.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                <p>
                  <strong>Next:</strong> {s.next}
                </p>
                {/^\/[a-z]*$/.test(s.path) &&
                  (s.roles.includes(user.role) ||
                    s.roles.includes("public")) && (
                    <Link className="text-link" to={s.path}>
                      Open this screen
                    </Link>
                  )}
              </div>
            </details>
          ))}
      </div>
    </>
  );
}
