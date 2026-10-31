import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Search,
  ArrowLeft,
  MapPin,
  Phone,
  Sun,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Truck,
  HardHat,
  ShieldCheck,
  History,
  FolderCheck,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  PageHead,
  Panel,
  Loading,
  ErrorNotice,
  NewProjectLink,
  ProjectList,
  Status,
  Blank,
  SmartForm,
  CommandForm,
  stages,
  type FormField,
} from "@/components/shared";
import {
  api,
  useData,
  useCommand,
  human,
  date,
  projectNumber,
} from "@/lib/api";
import { Can, useSession } from "@/app/session";
import { SurveyPanel, QuotePanel, SubsidyPanel } from "./sales-panels";
import { DeliveryPanel, InstallationPanel, PassportPanel } from "./work-panels";
export const enquiryFields: FormField[] = [
  { name: "name", label: "Customer name" },
  { name: "phone", label: "Phone number", type: "tel" },
  {
    name: "address",
    label: "Installation address",
    type: "textarea",
    full: true,
  },
  {
    name: "capacity_kw",
    label: "System capacity",
    type: "select",
    options: [1, 2, 3, 4, 5].map((n) => ({
      value: String(n),
      label: `${n} kW`,
    })),
  },
  {
    name: "system_type",
    label: "System type",
    type: "select",
    options: [
      { value: "on_grid", label: "On-grid" },
      { value: "off_grid", label: "Off-grid + battery" },
      { value: "panel_set", label: "Panel hardware set" },
    ],
  },
  {
    name: "source",
    label: "Enquiry source",
    type: "select",
    options: ["Website", "Referral", "Phone", "WhatsApp", "Walk-in"].map(
      (s) => ({ value: s, label: s }),
    ),
  },
  { name: "follow_up", label: "Follow-up date", type: "date", required: false },
  {
    name: "notes",
    label: "Requirements / notes",
    type: "textarea",
    required: false,
    full: true,
  },
  {
    name: "subsidy_interest",
    label: "Interested in subsidy assistance",
    type: "checkbox",
    required: false,
    full: true,
  },
];
export function Projects() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const status = params.get("status") || "",
    page = Number(params.get("page") || 1);
  const { data, error, isPending } = useData(
    `/projects?search=${encodeURIComponent(search)}&page=${page}&limit=20${status ? `&status=${status}` : ""}`,
  );
  return (
    <>
      <PageHead
        title="Projects"
        description="One connected journey from first enquiry to handover."
      >
        <Can roles={["admin", "sales"]}>
          <NewProjectLink />
        </Can>
      </PageHead>
      <section className="panel">
        <div className="list-toolbar">
          <Field>
            <FieldLabel className="sr-only" htmlFor="project-search">
              Search projects
            </FieldLabel>
            <div className="search-field">
              <Search aria-hidden="true" />
              <Input
                id="project-search"
                placeholder="Search customer, phone or site…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setParams(status ? { status } : {});
                }}
              />
            </div>
          </Field>
          <Field>
            <FieldLabel className="sr-only" htmlFor="stage-filter">
              Filter by stage
            </FieldLabel>
            <NativeSelect
              id="stage-filter"
              value={status}
              onChange={(e) =>
                setParams(e.target.value ? { status: e.target.value } : {})
              }
            >
              <NativeSelectOption value="">All stages</NativeSelectOption>
              {stages.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {human(s)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {isPending ? (
          <Loading />
        ) : error ? (
          <ErrorNotice error={error} />
        ) : (
          <>
            <ProjectList items={data.items} />
            <div className="list-footer">
              <span>
                {data.total} projects · Page {page}
              </span>
              <div>
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() =>
                    setParams({
                      ...(status ? { status } : {}),
                      page: String(page - 1),
                    })
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page * 20 >= data.total}
                  onClick={() =>
                    setParams({
                      ...(status ? { status } : {}),
                      page: String(page + 1),
                    })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
export function NewProject({ publicForm = false }: { publicForm?: boolean }) {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const { data: users } = useData("/users", !publicForm);
  const command = useCommand("/projects", (data) =>
    navigate(`/projects/${data.id}`),
  );
  const publicCommand = useMutation({
    mutationFn: (body: any) =>
      api("/enquiries/public", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => setDone(true),
  });
  const mutation = publicForm ? publicCommand : command;
  const fields = publicForm
    ? enquiryFields.filter((f) => !["source", "follow_up"].includes(f.name))
    : [
        ...enquiryFields,
        {
          name: "owner_id",
          label: "Follow-up owner",
          type: "select" as const,
          options: users?.items
            .filter((u: any) => ["admin", "sales"].includes(u.role))
            .map((u: any) => ({ value: u.id, label: u.name })),
          required: false,
        },
      ];
  const content = (
    <>
      <PageHead
        title={publicForm ? "Your solar journey starts here" : "New enquiry"}
        description={
          publicForm
            ? "Tell us about your home. Our team will help you plan the next step."
            : "Capture the customer’s needs. A site survey comes next."
        }
      />
      {done ? (
        <Panel title="Enquiry received">
          <p>
            Thank you. The SunPower team will contact you about a site survey.
          </p>
          <Button onClick={() => setDone(false)}>Send another enquiry</Button>
        </Panel>
      ) : (
        <Panel
          title="Customer & installation site"
          description="Fields marked * are required."
        >
          <SmartForm
            fields={fields}
            defaults={{
              capacity_kw: "3",
              system_type: "on_grid",
              source: "Website",
              subsidy_interest: false,
              notes: "",
            }}
            submit={publicForm ? "Send enquiry" : "Create project"}
            onSubmit={(body) => {
              body.capacity_kw = Number(body.capacity_kw);
              if (!body.follow_up) delete body.follow_up;
              if (!body.owner_id) delete body.owner_id;
              mutation.mutate(body);
            }}
            pending={mutation.isPending}
            error={mutation.error}
          />
        </Panel>
      )}
    </>
  );
  return publicForm ? (
    <div className="public-page">
      <Link className="public-brand" to="/">
        <Sun /> sunpower
      </Link>
      {content}
      <Link to="/">Staff sign in</Link>
    </div>
  ) : (
    <div className="narrow-page">
      <Link className="back-link" to="/projects">
        <ArrowLeft />
        Projects
      </Link>
      {content}
    </div>
  );
}
export function ProjectDetail() {
  const { id } = useParams(),
    [params, setParams] = useSearchParams();
  const { user } = useSession();
  const { data, error, isPending } = useData(`/projects/${id}`);
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const p = data.project;
  const tabs = [
    {
      value: "survey",
      label: "Site survey",
      icon: ClipboardCheck,
      show: ["admin", "sales", "surveyor"].includes(user.role),
    },
    {
      value: "quote",
      label: "Quotation & payment",
      icon: FileText,
      show: ["admin", "sales", "accounts"].includes(user.role),
    },
    {
      value: "delivery",
      label: "Packing & delivery",
      icon: Truck,
      show: ["admin", "warehouse", "sales"].includes(user.role),
    },
    {
      value: "installation",
      label: "Installation",
      icon: HardHat,
      show: ["admin", "technician", "sales", "surveyor", "support"].includes(
        user.role,
      ),
    },
    {
      value: "passport",
      label: "Asset passport",
      icon: ShieldCheck,
      show: true,
    },
    {
      value: "subsidy",
      label: "Subsidy",
      icon: FolderCheck,
      show: ["admin", "sales", "accounts"].includes(user.role),
    },
    { value: "activity", label: "Activity", icon: History, show: true },
  ].filter((t) => t.show);
  const active = params.get("tab") || tabs[0].value;
  return (
    <>
      <Link to="/projects" className="back-link">
        <ArrowLeft />
        All projects
      </Link>
      <PageHead
        title={p.customer_name}
        description={`${projectNumber(p.number)} · ${p.capacity_kw} kW ${human(p.system_type)}`}
      >
        <Status value={p.stage} />
      </PageHead>
      <div className="project-meta">
        <span>
          <MapPin />
          {p.address}
        </span>
        <a href={`tel:${p.phone}`}>
          <Phone />
          {p.phone}
        </a>
        <span>Owner: {p.owner_name || "Unassigned"}</span>
      </div>
      <ol className="journey" aria-label="Installation stages">
        {stages.map((s, i) => (
          <li
            key={s}
            className={i <= stages.indexOf(p.stage) ? "reached" : ""}
            aria-current={p.stage === s ? "step" : undefined}
          >
            <span>{i < stages.indexOf(p.stage) ? "✓" : i + 1}</span>
            {human(s)}
            {i < stages.length - 1 && <ChevronRight aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <Tabs
        value={tabs.some((t) => t.value === active) ? active : tabs[0].value}
        onValueChange={(value) => setParams({ tab: String(value) })}
      >
        <div className="tabs-scroll">
          <TabsList variant="line" className="project-tabs">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                <t.icon />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="survey">
          <SurveyPanel data={data} />
        </TabsContent>
        <TabsContent value="quote">
          <QuotePanel data={data} />
        </TabsContent>
        <TabsContent value="delivery">
          <DeliveryPanel data={data} />
        </TabsContent>
        <TabsContent value="installation">
          <InstallationPanel data={data} />
        </TabsContent>
        <TabsContent value="passport">
          <PassportPanel data={data} />
        </TabsContent>
        <TabsContent value="subsidy">
          <SubsidyPanel data={data} />
        </TabsContent>
        <TabsContent value="activity">
          <Panel
            title="Project activity"
            description="A record of saved changes and the people behind them."
          >
            {data.audit.length ? (
              <ol className="activity-list">
                {data.audit.map((a: any) => (
                  <li key={a.id}>
                    <span className="activity-dot" />
                    <div>
                      <strong>{human(a.action.replaceAll(".", " "))}</strong>
                      <p>
                        {a.actor_name || "System"} · {date(a.created_at, true)}
                      </p>
                      {a.detail && Object.keys(a.detail).length > 0 && (
                        <small>
                          {Object.entries(a.detail)
                            .map(
                              ([key, value]) =>
                                `${human(key)}: ${String(value)}`,
                            )
                            .join(" · ")}
                        </small>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Blank />
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
