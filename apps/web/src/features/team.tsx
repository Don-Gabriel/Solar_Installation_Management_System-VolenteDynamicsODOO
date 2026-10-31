import { useState } from "react";
import {
  PageHead,
  Loading,
  ErrorNotice,
  Panel,
  Modal,
} from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useData, useCommand } from "@/lib/api";
import { roleNames, roleDescriptions } from "@/lib/workflow";
export function Team() {
  const { data, error, isPending } = useData("/team");
  const [editing, setEditing] = useState<any>(null);
  const save = useCommand(
    editing ? `/users/${editing.id}/access` : "/users",
    () => setEditing(null),
  );
  const [reason, setReason] = useState("");
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
        description="Synthetic demo staff. Manage named accounts, qualifications and dispatch availability. Historical work remains linked to its original staff member."
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
                <th>Manage</th>
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
                  <td>
                    {u.active ? "Active" : "Inactive"}
                    {u.role === "technician" &&
                      (u.dispatch_enabled
                        ? " · Dispatch roster"
                        : " · Historical roster")}
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing({ ...u });
                        setReason("");
                      }}
                    >
                      Edit {u.name.split(" ")[0]}
                    </Button>
                  </td>
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
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Staff access and availability"
        description="Changes apply immediately. Review future appointments after deactivating staff or changing their skills."
      >
        {editing && (
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
                role: editing.role,
                active: editing.active,
                dispatch_enabled: editing.dispatch_enabled,
                skills: editing.skills,
                working_days: editing.working_days,
                reason,
              });
            }}
          >
            <p>{editing.name}</p>
            <label>
              Permission role
              <select
                value={editing.role}
                onChange={(e) =>
                  setEditing({ ...editing, role: e.target.value })
                }
              >
                {Object.entries(roleNames).map(([key, name]) => (
                  <option value={key} key={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              Account active
            </label>
            {editing.role === "technician" && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={editing.dispatch_enabled}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        dispatch_enabled: e.target.checked,
                      })
                    }
                  />
                  Available for new dispatch
                </label>
                <fieldset>
                  <legend>Verified work skills</legend>
                  {[
                    "installation",
                    "inverter_repair",
                    "battery_repair",
                    "survey",
                    "crew_lead",
                  ].map((skill) => (
                    <label key={skill}>
                      <input
                        type="checkbox"
                        checked={editing.skills.includes(skill)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            skills: e.target.checked
                              ? [...editing.skills, skill]
                              : editing.skills.filter(
                                  (s: string) => s !== skill,
                                ),
                          })
                        }
                      />
                      {skill.replaceAll("_", " ")}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Working days</legend>
                  {[
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((name, i) => (
                    <label key={i}>
                      <input
                        type="checkbox"
                        checked={editing.working_days.includes(i)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            working_days: e.target.checked
                              ? [...editing.working_days, i]
                              : editing.working_days.filter(
                                  (d: number) => d !== i,
                                ),
                          })
                        }
                      />
                      {name}
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            <label>
              Reason for change
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={save.isPending}>
              Save staff access
            </Button>
            <ErrorNotice error={save.error} />
          </form>
        )}
      </Modal>
    </>
  );
}
