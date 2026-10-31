import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, api, setCsrf, ApiError } from "@/lib/api";
import { SessionContext } from "@/app/session";
import { Layout } from "@/app/layout";
import { Login } from "@/features/login";
import { Loading, ErrorNotice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import "./styles.css";
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
  return (
    <SessionContext value={{ user: session.data.user }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<NewProject />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="service" element={<Service />} />
          <Route path="reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SessionContext>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/enquire" element={<NewProject publicForm />} />
            <Route path="*" element={<Workspace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
