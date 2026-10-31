import { FormSafety } from "./app/form-safety";
import { PageNavigation } from "./app/page-navigation";
import { AppUpdate } from "./app/app-update";
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Routes,
  Route,
  Navigate,
} from "react-router";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, api, setCsrf, ApiError } from "@/lib/api";
import { SessionContext, useSession } from "@/app/session";
import { Layout } from "@/app/layout";
import { Login } from "@/features/login";
import { Loading, ErrorNotice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import "./styles.css";
const Barcodes = lazy(() =>
  import("@/features/barcodes").then((m) => ({ default: m.Barcodes })),
);
const CustomerPortal = lazy(() =>
  import("@/features/customer-portal").then((m) => ({
    default: m.CustomerPortal,
  })),
);
const Team = lazy(() =>
  import("@/features/team").then((m) => ({ default: m.Team })),
);
const Schedule = lazy(() =>
  import("@/features/schedule").then((m) => ({ default: m.Schedule })),
);
const Help = lazy(() =>
  import("@/features/help").then((m) => ({ default: m.Help })),
);
function RolePage({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { user } = useSession();
  return roles.includes(user.role) ? (
    children
  ) : (
    <div className="panel panel-body">
      <h1>This screen belongs to another team</h1>
      <p>
        Your account cannot open this screen. Use the menu to return to your
        work.
      </p>
    </div>
  );
}
const Overview = lazy(() =>
  import("@/features/overview").then((m) => ({ default: m.Overview })),
);
const Projects = lazy(() =>
  import("@/features/projects").then((m) => ({ default: m.Projects })),
);
const NewProject = lazy(() =>
  import("@/features/projects").then((m) => ({ default: m.NewProject })),
);
const ProjectDetail = lazy(() =>
  import("@/features/projects").then((m) => ({ default: m.ProjectDetail })),
);
const Inventory = lazy(() =>
  import("@/features/inventory").then((m) => ({ default: m.Inventory })),
);
const Jobs = lazy(() =>
  import("@/features/jobs").then((m) => ({ default: m.Jobs })),
);
const Service = lazy(() =>
  import("@/features/service").then((m) => ({ default: m.Service })),
);
const Reports = lazy(() =>
  import("@/features/reports").then((m) => ({ default: m.Reports })),
);
function Workspace() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const data = await api("/me");
        setCsrf(data.csrfToken);
        return data;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: Infinity,
  });
  if (session.isPending) return <Loading />;
  if (session.error)
    return (
      <div className="public-page">
        <ErrorNotice error={session.error} />
        <Button onClick={() => session.refetch()}>Retry connection</Button>
      </div>
    );
  if (!session.data) return <Login />;
  if (session.data.user.role === "customer")
    return (
      <SessionContext
        value={{
          user: session.data.user,
          canSwitchDemoUser: session.data.canSwitchDemoUser,
        }}
      >
        <Suspense fallback={<Loading />}>
          <CustomerPortal />
        </Suspense>
      </SessionContext>
    );
  return (
    <SessionContext
      value={{
        user: session.data.user,
        canSwitchDemoUser: session.data.canSwitchDemoUser,
      }}
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="projects" element={<Projects />} />
          <Route
            path="projects/new"
            element={
              <RolePage roles={["admin", "sales", "support", "coordinator"]}>
                <NewProject />
              </RolePage>
            }
          />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route
            path="schedule"
            element={
              <RolePage
                roles={[
                  "admin",
                  "coordinator",
                  "technician",
                  "support",
                  "surveyor",
                ]}
              >
                <Schedule />
              </RolePage>
            }
          />
          <Route
            path="inventory"
            element={
              <RolePage roles={["admin", "warehouse", "accounts"]}>
                <Inventory />
              </RolePage>
            }
          />
          <Route path="jobs" element={<Jobs />} />
          <Route
            path="service"
            element={
              <RolePage
                roles={[
                  "admin",
                  "support",
                  "accounts",
                  "coordinator",
                  "technician",
                  "warehouse",
                ]}
              >
                <Service />
              </RolePage>
            }
          />
          <Route
            path="reports"
            element={
              <RolePage roles={["admin", "accounts"]}>
                <Reports />
              </RolePage>
            }
          />
          <Route
            path="barcodes"
            element={
              <RolePage roles={["admin", "warehouse", "accounts"]}>
                <Barcodes />
              </RolePage>
            }
          />
          <Route
            path="team"
            element={
              <RolePage roles={["admin"]}>
                <Team />
              </RolePage>
            }
          />
          <Route path="help" element={<Help />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SessionContext>
  );
}
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <FormSafety>
        <PageNavigation />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/enquire" element={<NewProject publicForm />} />
            <Route path="*" element={<Workspace />} />
          </Routes>
        </Suspense>
      </FormSafety>
    ),
  },
]);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppUpdate />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
