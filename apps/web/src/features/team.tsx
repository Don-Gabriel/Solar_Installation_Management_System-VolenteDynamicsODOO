import { useState } from "react";
import { PageHead, Loading, ErrorNotice, Panel } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/api";
import { roleNames, roleDescriptions } from "@/lib/workflow";
export function Team() {
  const { data, error, isPending } = useData("/team");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const users = data.items.filter(
    (u: any) =>
      (!role || u.role === role) &&
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Team & access"
        description="See who does what. Permissions are checked by the server as well as the screen."
      />
      <div className="role-cards">
        {Object.entries(roleNames).map(([key, name]) => (
          <button
            type="button"
            className={role === key ? "role-card selected" : "role-card"}
            key={key}
            onClick={() => setRole(role === key ? "" : key)}
            aria-pressed={role === key}
          >
            <strong>
              {name}
              <span>
                {data.items.filter((u: any) => u.role === key).length}
              </span>
            </strong>
            <p>{roleDescriptions[key]}</p>
          </button>
        ))}
      </div>
      <Panel
        title={role ? `${roleNames[role]} accounts` : "All staff accounts"}
        description="Synthetic demo staff. Select a role above to compare access. Changing roles or passwords is not available on this screen."
      >
        <label>
          Find a staff member
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email…"
          />
        </label>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable records"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sign-in email</th>
                <th>Role</th>
                <th>Open assigned jobs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>{u.email}</td>
                  <td>{roleNames[u.role]}</td>
                  <td>{u.role === "technician" ? u.open_jobs : "—"}</td>
                  <td>{u.active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">
          To test another role, sign out and sign in using its email and the
          configured demo password. This screen never changes your identity or
          bypasses sign-in.
        </p>
      </Panel>
    </>
  );
}
