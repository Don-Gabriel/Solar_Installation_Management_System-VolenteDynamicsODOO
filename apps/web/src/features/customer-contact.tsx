import { useState } from "react";
import { Link } from "react-router";
import { Panel, CommandForm } from "@/components/shared";
import { useData, date } from "@/lib/api";
import { Can, useSession } from "@/app/session";

export function CustomerContact({ data: d }: { data: any }) {
  const p = d.project,
    { user } = useSession();
  const [search, setSearch] = useState(""),
    [target, setTarget] = useState("");
  const { data: matches } = useData(
    `/customers?search=${encodeURIComponent(search)}`,
    user.role === "admin",
  );
  const { data: history } = useData(
    `/customers/${p.customer_id}/history`,
    ["admin", "support"].includes(user.role),
  );
  const candidate = matches?.items.find((c: any) => c.id === target);
  return (
    <details className="panel">
      <summary>Customer, sites & call history</summary>
      <p>Service address: {p.address}</p>
      <p>
        Site access: {p.access_notes || "No special instructions recorded."}
      </p>
      <p>
        Preferred visit:{" "}
        {p.preferred_date ? date(p.preferred_date) : "Not specified"} ·{" "}
        {p.preferred_window}. This is a request, not a confirmed appointment.
      </p>
      {p.hazard_notes && (
        <p role="alert">
          Reported hazard: {p.hazard_notes}. Coordinator review is required.
        </p>
      )}
      {d.related_systems?.length > 0 && (
        <div>
          <h3>Customer sites and systems</h3>
          {d.related_systems.map((s: any) => (
            <p key={s.id}>
              <Link to={`/projects/${s.id}`}>
                SP-{s.number} · {s.address} ·{" "}
                {s.capacity_kw ? s.capacity_kw + " kW" : "Size pending survey"}
              </Link>
              {s.site_id === p.site_id ? " · Same site" : ""}
            </p>
          ))}
        </div>
      )}
      <Can roles={["admin", "sales", "support"]}>
        <details>
          <summary>Edit customer contact</summary>
          <CommandForm
            key={p.customer_version}
            path={`/customers/${p.customer_id}/contact`}
            submit="Save verified contact"
            defaults={{
              name: p.customer_name,
              phone: p.phone,
              billing_address: p.billing_address,
              phone_verified: false,
            }}
            transform={(b) => ({ ...b, version: p.customer_version })}
            fields={[
              { name: "name", label: "Correct customer name" },
              { name: "phone", label: "Current contact phone", type: "tel" },
              {
                name: "phone_verified",
                label: "I verified a changed phone with the customer",
                type: "checkbox",
                required: false,
              },
              {
                name: "billing_address",
                label: "Billing address (blank uses service address)",
                type: "textarea",
                required: false,
              },
              { name: "reason", label: "Contact change reason" },
            ]}
          />
        </details>
      </Can>
      <Can roles={["admin", "sales", "support", "coordinator"]}>
        <details>
          <summary>Edit site access</summary>
          <CommandForm
            key={p.site_version}
            path={`/sites/${p.site_id}/access`}
            submit="Save site instructions"
            defaults={{ access_notes: p.access_notes }}
            transform={(b) => ({ ...b, version: p.site_version })}
            fields={[
              {
                name: "access_notes",
                label: "Gate, roof and site access instructions",
                type: "textarea",
                required: false,
              },
              { name: "reason", label: "Site instruction change reason" },
            ]}
          />
        </details>
        <CommandForm
          path={`/projects/${p.id}/contact-notes`}
          submit="Save call note"
          fields={[
            {
              name: "note",
              label: "Customer call / follow-up note",
              type: "textarea",
            },
          ]}
        />
        {!d.order && !p.cancelled_at && (
          <details>
            <summary>Cancel this enquiry</summary>
            <CommandForm
              path={`/projects/${p.id}/cancellation`}
              submit="Cancel enquiry and release future visits"
              fields={[
                {
                  name: "reason",
                  label: "Customer cancellation reason",
                  type: "textarea",
                },
              ]}
            />
          </details>
        )}
      </Can>
      {d.contacts?.map((n: any) => (
        <p key={n.id}>
          {date(n.created_at, true)} · {n.actor_name}: {n.note}
        </p>
      ))}
      {history?.items.length > 0 && (
        <details>
          <summary>Restricted contact change history</summary>
          {history.items.map((h: any) => (
            <p key={h.id}>
              {date(h.created_at, true)} · {h.actor_name} · {h.reason}:{" "}
              {h.before_value.name} / {h.before_value.phone} →{" "}
              {h.after_value.merged_into
                ? "Merged into " + h.after_value.merged_into
                : h.after_value.name + " / " + h.after_value.phone}
            </p>
          ))}
        </details>
      )}
      <Can roles={["admin"]}>
        <details>
          <summary>Review duplicate customer merge</summary>
          <p>
            All sites move to the selected customer. Project identifiers, issued
            invoices, warranties and evidence remain unchanged.
          </p>
          <label>
            Find merge destination
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setTarget("");
              }}
            />
          </label>
          <label>
            Keep this customer
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose reviewed match</option>
              {matches?.items
                .filter((c: any) => c.id !== p.customer_id)
                .map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone} ·{" "}
                    {c.sites.map((s: any) => s.address).join("; ")}
                  </option>
                ))}
            </select>
          </label>
          {candidate && (
            <CommandForm
              key={candidate.id + candidate.version}
              path={`/customers/${p.customer_id}/merge`}
              submit="Merge reviewed customer records"
              transform={(b) => ({
                ...b,
                version: p.customer_version,
                target_id: candidate.id,
                target_version: candidate.version,
              })}
              fields={[
                {
                  name: "confirmed_same_customer",
                  label: "I checked these are the same customer",
                  type: "checkbox",
                },
                { name: "reason", label: "Merge review reason" },
              ]}
            />
          )}
        </details>
      </Can>
    </details>
  );
}
