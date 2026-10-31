import { useState } from "react";
import { useSearchParams, Link } from "react-router";
import { ShieldCheck, Search, Plus, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  PageHead,
  Panel,
  Modal,
  CommandForm,
  Loading,
  ErrorNotice,
  Status,
  Blank,
} from "@/components/shared";
import { useData, date, money } from "@/lib/api";
import { Can, useSession } from "@/app/session";
export function Service() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const [selected, setSelected] = useState<any>(null),
    [resolving, setResolving] = useState<any>(null),
    [confirm, setConfirm] = useState<any>(null);
  const { user } = useSession();
  const { data: assets, error: assetError } = useData(
    `/passports?search=${encodeURIComponent(search)}`,
    user.role !== "accounts",
  );
  const { data: tickets, error, isPending } = useData("/tickets");
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  return (
    <>
      <PageHead
        title="Repairs & warranty"
        description="Keep every customer’s system generating, long after handover."
      />
      <Can roles={["admin", "support"]}>
        <Panel
          title="Find a customer or device"
          description="Search by serial, customer name or phone to check delivery-based coverage."
        >
          <Field>
            <FieldLabel className="sr-only" htmlFor="service-search">
              Customer or device search
            </FieldLabel>
            <div className="search-field">
              <Search />
              <Input
                id="service-search"
                placeholder="Try SP-INV3-0001, a customer name or phone…"
                value={search}
                onChange={(e) =>
                  setParams(e.target.value ? { search: e.target.value } : {}, {
                    replace: true,
                  })
                }
              />
            </div>
          </Field>
          <ErrorNotice error={assetError} />
          {assets?.length ? (
            <div className="asset-results">
              {assets.slice(0, search ? 20 : 4).map((a: any) => (
                <div className="asset-result" key={a.id}>
                  <div className="asset-icon">
                    <ShieldCheck />
                  </div>
                  <div>
                    <strong>{a.serial || a.product_name}</strong>
                    <span>
                      {a.customer_name} · {a.product_name}
                    </span>
                    <small>
                      Delivered {date(a.starts_at)} · Expires{" "}
                      {date(a.expires_at)}
                      {a.asset_status === "replaced"
                        ? " · Device replaced"
                        : ""}
                    </small>
                  </div>
                  <Status value={a.covered ? "covered" : "expired"} />
                  <Button
                    variant="outline"
                    disabled={a.asset_status === "replaced"}
                    onClick={() => setSelected(a)}
                  >
                    <Plus data-icon="inline-start" />
                    Open ticket
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Blank title="No matching delivered assets">
              Try a customer name or check whether the equipment has been
              delivered.
            </Blank>
          )}
        </Panel>
      </Can>
      <Panel
        title="Service workboard"
        description={`${tickets.filter((t: any) => t.status !== "closed").length} cases still need attention or customer confirmation.`}
      >
        <div className="ticket-list">
          {tickets.length ? (
            tickets.map((t: any) => (
              <article className="ticket-card" key={t.id}>
                <div className="ticket-top">
                  <div>
                    <span className="ticket-ref">
                      SR-{String(t.number).padStart(4, "0")}
                    </span>
                    <h3>{t.customer_name}</h3>
                  </div>
                  <Status value={t.status} />
                </div>
                <p>{t.complaint}</p>
                <div className="ticket-meta">
                  <span>{t.serial || t.product_name}</span>
                  <span>Fault {t.fault_code}</span>
                  <Status value={t.covered ? "covered" : "expired"} />
                </div>
                <p className="field-hint">{t.coverage_reason}</p>
                {t.resolution && (
                  <div className="resolution">
                    <strong>Resolution</strong>
                    <p>{t.resolution}</p>
                    <div className="ticket-finance">
                      <span>
                        Customer charge{" "}
                        <strong>{money(t.customer_charge_minor)}</strong>
                      </span>
                      <span>
                        Internal cost{" "}
                        <strong>
                          {money(t.parts_cost_minor + t.labour_cost_minor)}
                        </strong>
                      </span>
                    </div>
                    {t.replacement_serial && (
                      <p>
                        Replacement: {t.serial} → {t.replacement_serial}
                      </p>
                    )}
                    {t.confirmed_by && (
                      <p>
                        Confirmed by {t.confirmed_by} on {date(t.confirmed_at)}
                      </p>
                    )}
                  </div>
                )}
                <div className="button-row">
                  <Can roles={["admin", "support"]}>
                    {t.status === "open" && (
                      <Button onClick={() => setResolving(t)}>
                        Record repair / replacement
                      </Button>
                    )}
                    {t.status === "awaiting_confirmation" && (
                      <Button onClick={() => setConfirm(t)}>
                        Record customer confirmation
                      </Button>
                    )}
                  </Can>
                  <Button
                    variant="ghost"
                    render={
                      <Link
                        to={`/projects/${t.project_id}?tab=${user.role === "accounts" ? "quote" : "passport"}`}
                        state={{
                          returnTo:
                            "/service" +
                            (params.size ? "?" + params.toString() : ""),
                        }}
                      />
                    }
                    nativeButton={false}
                  >
                    Open project <ArrowUpRight data-icon="inline-end" />
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <Blank title="No service tickets" />
          )}
        </div>
      </Panel>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Open a service ticket"
        description={
          selected
            ? `${selected.customer_name} · ${selected.serial || selected.product_name}`
            : ""
        }
      >
        {selected && (
          <CommandForm
            path="/tickets"
            onDone={() => setSelected(null)}
            submit="Create service ticket"
            defaults={{ fault_code: "", complaint: "" }}
            transform={(b) => ({ ...b, warranty_id: selected.id })}
            fields={[
              {
                name: "fault_code",
                label: "Problem category",
                type: "select",
                options: [
                  "No power",
                  "Low generation",
                  "Inverter warning",
                  "Battery issue",
                  "Wiring or connection",
                  "Physical damage",
                  "Other",
                ].map((v) => ({ value: v, label: v })),
              },
              {
                name: "complaint",
                label: "Customer complaint",
                type: "textarea",
                full: true,
              },
            ]}
          />
        )}
      </Modal>
      <Modal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title="Record service resolution"
        description={
          resolving?.covered
            ? "Covered repair: customer charge is zero. Internal parts and labour still count toward project cost."
            : "Expired coverage: parts and labour create an itemized service invoice."
        }
      >
        {resolving && (
          <CommandForm
            path={`/tickets/${resolving.id}/resolution`}
            onDone={() => setResolving(null)}
            submit="Save resolution & request confirmation"
            defaults={{
              parts_cost_minor: 0,
              labour_cost_minor: 0,
              replacement_serial: "",
            }}
            fields={[
              {
                name: "resolution",
                label: "Work performed",
                type: "textarea",
                full: true,
              },
              {
                name: "parts_cost_minor",
                label: "Parts cost (₹)",
                type: "number",
                money: true,
                min: 0,
              },
              {
                name: "labour_cost_minor",
                label: "Labour cost (₹)",
                type: "number",
                money: true,
                min: 0,
              },
              {
                name: "replacement_serial",
                label: "Replacement serial (if replacing device)",
                required: false,
                full: true,
                hint: "Use available stock of the same product. Its acquisition cost replaces the entered parts cost. Original warranty dates carry forward.",
              },
            ]}
          />
        )}
      </Modal>
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Customer confirmation"
        description="Record confirmation only after the customer agrees the issue is resolved."
      >
        {confirm && (
          <CommandForm
            path={`/tickets/${confirm.id}/confirmation`}
            onDone={() => setConfirm(null)}
            submit="Confirm resolution & close ticket"
            defaults={{ confirmed_by: confirm.customer_name }}
            fields={[
              {
                name: "confirmed_by",
                label: "Customer who confirmed",
                full: true,
              },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
