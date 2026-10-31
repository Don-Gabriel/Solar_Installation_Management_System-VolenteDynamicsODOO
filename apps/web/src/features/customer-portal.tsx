import { useQuery } from "@tanstack/react-query";
import { DemoSwitcher } from "@/app/demo-switcher";
import { useState } from "react";
import { useSession } from "@/app/session";
import { clearDrafts } from "@/app/form-safety";
import { api, money, queryClient, setCsrf, useCommand } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorNotice, Loading, Status } from "@/components/shared";

const when = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " IST";
function Notice({ item }: { item: any }) {
  const read = useCommand(`/customer/notifications/${item.id}/read`);
  return (
    <article className="customer-notice">
      <h3>
        {item.title}{" "}
        {!item.read_at && <span className="customer-unread">New</span>}
      </h3>
      <p>{item.body}</p>
      <small>{when(item.created_at)}</small>
      {!item.read_at && (
        <Button
          variant="outline"
          disabled={read.isPending}
          onClick={() => read.mutate({})}
        >
          Mark as read
        </Button>
      )}
      <ErrorNotice error={read.error} />
    </article>
  );
}
export function CustomerPortal() {
  const { user } = useSession();
  const [logoutError, setLogoutError] = useState<Error | null>(null);
  const query = useQuery({
    queryKey: ["/customer/home"],
    queryFn: () => api("/customer/home"),
    refetchInterval: 15000,
  });
  async function logout() {
    try {
      await api("/logout", { method: "POST" });
      clearDrafts();
      setCsrf("");
      await queryClient.cancelQueries();
      queryClient.setQueryData(["session"], null);
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== "session",
      });
    } catch (e) {
      setLogoutError(e as Error);
    }
  }
  const data = query.data;
  return (
    <main className="customer-portal">
      <header className="customer-portal-head">
        <div>
          <p>SunPower · Customer account</p>
          <h1>My solar service</h1>
          <p>Welcome, {user.name}</p>
        </div>
        <DemoSwitcher />
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </header>
      <ErrorNotice error={logoutError || query.error} />
      <nav aria-label="Customer sections" className="button-row">
        <a href="#customer-updates">Updates</a>
        <a href="#customer-visits">Visits</a>
        <a href="#customer-repairs">Repairs</a>
        <a href="#customer-bills">Bills</a>
      </nav>
      <p className="field-hint">
        Updates appear here automatically while this page is open. This demo
        uses an in-app inbox; it does not send SMS, email or phone push alerts.
      </p>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        Refresh updates
      </Button>
      {query.isPending && <Loading />}
      {data && (
        <>
          <section id="customer-updates" className="panel panel-body">
            <h2>Your updates</h2>
            <p role="status">
              {data.notifications.filter((n: any) => !n.read_at).length} unread
              updates
            </p>
            {data.notifications.map((n: any) => (
              <Notice key={n.id} item={n} />
            ))}
            {!data.notifications.length && (
              <p>
                No updates yet. New repair and appointment changes will appear
                here.
              </p>
            )}
          </section>
          <section className="panel panel-body">
            <h2>Your solar systems</h2>
            {data.projects.map((p: any) => (
              <article key={p.id} className="customer-notice">
                <h3>Project P-{p.number}</h3>
                <p>{p.address}</p>
                <p>
                  {p.capacity_kw ? `${p.capacity_kw} kW · ` : ""}
                  {p.system_type.replaceAll("_", " ")}
                </p>
                <Status value={p.stage} />
              </article>
            ))}
          </section>
          <section id="customer-visits" className="panel panel-body">
            <h2>Your visits</h2>
            {data.visits.map((v: any) => (
              <article className="customer-notice" key={v.id}>
                <h3>
                  {v.kind === "installation"
                    ? "Installation"
                    : v.kind === "survey"
                      ? "Site survey"
                      : "Repair visit"}
                </h3>
                <p>
                  {when(v.starts_at)} – {when(v.ends_at)}
                </p>
                <p>Team: {v.crew || "Awaiting assignment"}</p>
                <Status value={v.status} />
              </article>
            ))}
            {!data.visits.length && (
              <p>No visits booked yet. Call support to arrange a visit.</p>
            )}
          </section>
          <section id="customer-repairs" className="panel panel-body">
            <h2>Your repair requests</h2>
            {data.tickets.map((t: any) => (
              <article className="customer-notice" key={t.id}>
                <h3>Repair SR-{t.number}</h3>
                <p>{t.complaint}</p>
                <Status value={t.status} />
              </article>
            ))}
            {!data.tickets.length && (
              <p>
                No repair requests. Call support if your system needs attention.
              </p>
            )}
            <p className="field-hint">
              Contact support to report a fault, approve an estimate or confirm
              that a repair is working.
            </p>
          </section>
          <section id="customer-bills" className="panel panel-body">
            <h2>Your bills</h2>
            {data.invoices.map((i: any) => (
              <article className="customer-notice" key={i.id}>
                <h3>
                  Invoice INV-{i.number} · {i.kind}
                </h3>
                <p>{when(i.issued_at)}</p>
                <ul>
                  {i.lines.map((l: any, index: number) => (
                    <li key={index}>
                      {l.description} · {l.quantity} ×{" "}
                      {money(l.unit_price_minor)} = {money(l.amount_minor)}
                    </li>
                  ))}
                </ul>
                <p>
                  Original total: {money(i.total_minor)} · Credits:{" "}
                  {money(i.credited_minor)} · Net paid: {money(i.paid_minor)}
                </p>
                <strong>Amount due: {money(i.due_minor)}</strong>
              </article>
            ))}
            {!data.invoices.length && <p>No invoices issued yet.</p>}
          </section>
        </>
      )}
    </main>
  );
}
