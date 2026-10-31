import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Download,
  Printer,
  IndianRupee,
  TrendingUp,
  Wallet,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
import { useData, money, projectNumber, date } from "@/lib/api";
export function Reports() {
  const [params, setParams] = useSearchParams();
  const period = params.get("period") || "month";
  const [pay, setPay] = useState<any>(null);
  const { data, error, isPending } = useData(`/reports?period=${period}`);
  return (
    <>
      <PageHead
        title="Money & reports"
        description="Follow the money, from collections to the cost of each installation."
      >
        <Field>
          <FieldLabel htmlFor="report-period" className="sr-only">
            Report period
          </FieldLabel>
          <NativeSelect
            id="report-period"
            value={period}
            onChange={(e) => setParams({ period: e.target.value })}
          >
            {[
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
              { value: "all", label: "All time" },
            ].map((o) => (
              <NativeSelectOption value={o.value} key={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button
          variant="outline"
          render={<a href={`/api/reports/export?period=${period}`} />}
          nativeButton={false}
        >
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Print
        </Button>
      </PageHead>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : (
        <>
          <div className="metrics">
            <div className="metric">
              <span>
                <Wallet />
                Cash received
              </span>
              <strong>{money(data.cash_received_minor)}</strong>
              <p>Payments recorded in this period</p>
            </div>
            <div className="metric">
              <span>
                <ReceiptText />
                Invoiced value
              </span>
              <strong>{money(data.invoiced_minor)}</strong>
              <p>Orders confirmed in this period</p>
            </div>
            <div className="metric">
              <span>
                <IndianRupee />
                Outstanding
              </span>
              <strong>{money(data.outstanding_minor)}</strong>
              <p>Invoice value less collections</p>
            </div>
            <div className="metric">
              <span>
                <TrendingUp />
                Completed contribution
              </span>
              <strong
                className={
                  data.completed_contribution_minor < 0 ? "negative" : ""
                }
              >
                {money(data.completed_contribution_minor)}
              </strong>
              <p>Completed jobs only · after direct costs</p>
            </div>
          </div>
          <Panel
            title="Project contribution"
            description="Orders confirmed in the selected period. Completed contribution = invoices − consumed materials − installation labour − repair costs. Work in progress is excluded."
          >
            {data.jobs.length ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Scrollable records"
              >
                <table className="data-table finance-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Invoiced</th>
                      <th>Collected</th>
                      <th>Direct costs</th>
                      <th>Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.map((j: any) => (
                      <tr key={j.project_id}>
                        <td>
                          <Link
                            to={`/projects/${j.project_id}?tab=quote`}
                            state={{ returnTo: "/reports?period=" + period }}
                          >
                            <strong>{j.customer_name}</strong>
                            <small>
                              {projectNumber(j.number)} · {j.stage}
                            </small>
                          </Link>
                        </td>
                        <td>{money(j.invoiced_minor)}</td>
                        <td>{money(j.collected_minor)}</td>
                        <td>
                          <details>
                            <summary>{money(j.direct_cost_minor)}</summary>
                            <small>
                              Materials {money(j.material_cost_minor)}
                              <br />
                              Labour {money(j.labour_cost_minor)}
                              <br />
                              Repairs {money(j.service_cost_minor)}
                            </small>
                          </details>
                        </td>
                        <td
                          className={j.contribution_minor < 0 ? "negative" : ""}
                        >
                          {j.contribution_minor === null ? (
                            <Status value="work_in_progress" />
                          ) : (
                            <strong>{money(j.contribution_minor)}</strong>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Blank title="No confirmed orders in this period" />
            )}
          </Panel>
          <div className="finance-note">
            <ReceiptText />
            <p>
              Stock purchases in this period:{" "}
              <strong>{money(data.purchases_minor)}</strong>. Purchases become
              job material costs when stock is dispatched; they are not all
              charged to a single installation. This is an operational
              contribution report, not a statutory profit statement.
            </p>
          </div>
          <Panel
            title="Technician payables"
            description="All completed jobs. Labour is calculated from recorded minutes and the rate saved at completion."
          >
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable records"
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Technician / job</th>
                    <th>Time</th>
                    <th>Rate / hour</th>
                    <th>Payable</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payroll.map((j: any) => (
                    <tr key={j.id}>
                      <td>
                        <strong>{j.name}</strong>
                        <small>{projectNumber(j.number)}</small>
                      </td>
                      <td>{(j.labour_minutes / 60).toFixed(1)} h</td>
                      <td>{money(j.hourly_rate_minor)}</td>
                      <td>{money(j.labour_cost_minor)}</td>
                      <td>
                        {j.paid_at ? (
                          <>
                            <Status value="paid" />
                            <small>
                              {date(j.paid_at)} · {j.reference}
                            </small>
                          </>
                        ) : (
                          <Button variant="outline" onClick={() => setPay(j)}>
                            Record paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      <Modal
        open={!!pay}
        onClose={() => setPay(null)}
        title="Record technician payment"
        description={pay ? `${pay.name} · ${money(pay.labour_cost_minor)}` : ""}
      >
        {pay && (
          <CommandForm
            path={`/jobs/${pay.id}/pay`}
            onDone={() => setPay(null)}
            submit="Record as paid"
            fields={[
              {
                name: "confirmed_by",
                label: "Payment / receipt reference",
                full: true,
              },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
