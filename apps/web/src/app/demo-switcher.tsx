import { useState } from "react";
import { useSession } from "./session";
import { useFormSafety } from "./form-safety";
import { api, queryClient, setCsrf, useData } from "@/lib/api";
import { roleNames } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/shared";
export function DemoSwitcher() {
  const { user, canSwitchDemoUser } = useSession();
  const safety = useFormSafety();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [role, setRole] = useState("");
  const [target, setTarget] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const users = useData<any[]>("/demo-users", open && !!canSwitchDemoUser);
  async function switchTo(person: any) {
    if (safety.dirty && target?.id !== person.id) {
      setTarget(person);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/demo-switch", {
        method: "POST",
        body: JSON.stringify({ user_id: person.id }),
      });
      safety.discard();
      setCsrf("");
      await queryClient.cancelQueries();
      queryClient.clear();
      window.location.replace("/");
    } catch (e) {
      setError(e as Error);
      setBusy(false);
    }
  }
  if (!canSwitchDemoUser)
    return <span className="role-indicator">{roleNames[user.role]}</span>;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Switch demo user"
      >
        {roleNames[user.role]} ▾
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) {
            setOpen(v);
            setTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Switch demo user</DialogTitle>
          <DialogDescription>
            Signed in as {user.name}. The selected person keeps their usual
            permissions.
          </DialogDescription>
          <label>
            Search people
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
            />
          </label>
          <label>
            Filter by role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {Object.entries(roleNames).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {target && (
            <div role="alert">
              <p>Discard unsaved changes and switch to {target.name}?</p>
              <Button disabled={busy} onClick={() => switchTo(target)}>
                Discard and switch
              </Button>
              <Button variant="outline" onClick={() => setTarget(null)}>
                Keep editing
              </Button>
            </div>
          )}
          <ErrorNotice error={error || users.error} />
          <div className="demo-user-list">
            {users.data
              ?.filter(
                (p) =>
                  (!role || p.role === role) &&
                  `${p.name} ${p.email}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((p) => (
                <Button
                  variant="outline"
                  key={p.id}
                  disabled={busy || p.id === user.id}
                  onClick={() => switchTo(p)}
                >
                  <span>
                    {p.name}
                    <small>
                      {roleNames[p.role as keyof typeof roleNames]} · {p.email}
                    </small>
                  </span>
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
