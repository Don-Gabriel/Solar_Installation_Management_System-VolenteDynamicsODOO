import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Package,
  HardHat,
  ShieldCheck,
  ChartNoAxesCombined,
  Sun,
  LogOut,
  Menu,
  WifiOff,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSession } from "./session";
import { api, queryClient, setCsrf, human } from "@/lib/api";
import { cn } from "@/lib/utils";
const links = [
  {
    to: "/",
    label: "Overview",
    icon: LayoutDashboard,
    roles: [
      "admin",
      "sales",
      "surveyor",
      "warehouse",
      "technician",
      "support",
      "accounts",
    ],
  },
  {
    to: "/projects",
    label: "Projects",
    icon: FolderKanban,
    roles: [
      "admin",
      "sales",
      "surveyor",
      "warehouse",
      "technician",
      "support",
      "accounts",
    ],
  },
  {
    to: "/inventory",
    label: "Warehouse",
    icon: Package,
    roles: ["admin", "warehouse", "accounts"],
  },
  {
    to: "/jobs",
    label: "Field schedule",
    icon: HardHat,
    roles: ["admin", "technician", "surveyor", "sales"],
  },
  {
    to: "/service",
    label: "Service & warranty",
    icon: ShieldCheck,
    roles: ["admin", "support", "accounts"],
  },
  {
    to: "/reports",
    label: "Reports & finance",
    icon: ChartNoAxesCombined,
    roles: ["admin", "accounts"],
  },
];
export function Layout() {
  const { user } = useSession();
  const [open, setOpen] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [logoutError, setLogoutError] = useState("");
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    addEventListener("online", yes);
    addEventListener("offline", no);
    return () => {
      removeEventListener("online", yes);
      removeEventListener("offline", no);
    };
  }, []);
  async function logout() {
    try {
      await api("/logout", { method: "POST" });
      setCsrf("");
      queryClient.clear();
      queryClient.setQueryData(["session"], null);
    } catch {
      setLogoutError("Could not sign out. Check your connection and retry.");
    }
  }
  const visible = links.filter((l) => l.roles.includes(user.role));
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={cn("sidebar", open && "is-open")}>
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Sun />
          </span>
          <span>
            sunpower<small>Operations workspace</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" />
          SunPower Solutions<span>IN</span>
        </div>
        <nav aria-label="Main navigation">
          {visible.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) => cn("nav-item", isActive && "active")}
            >
              <l.icon />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="solar-note">
            <Sun />
            <p>
              Every installation.
              <br />
              <strong>A brighter tomorrow.</strong>
            </p>
          </div>
          <Link to="/enquire" className="public-link">
            Customer enquiry form <ArrowUpRight />
          </Link>
          <div className="profile">
            <span className="profile-initials">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{human(user.role)}</small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut />
            </Button>
          </div>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </aside>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Menu />
            </Button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {links.find(
                  (l) => l.to !== "/" && location.pathname.startsWith(l.to),
                )?.label || "Overview"}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="demo-indicator">Demo workspace</span>
            <span className="today-date">
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date())}
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {!online && (
            <Alert>
              <WifiOff />
              <AlertDescription>
                You’re offline. Changes cannot be saved until you reconnect.
              </AlertDescription>
            </Alert>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>SunPower Solutions</span>
          <span>Enquiry to installation. All in one place.</span>
        </footer>
      </div>
      {user.role === "technician" && (
        <nav className="tech-bottom" aria-label="Technician navigation">
          {visible.slice(0, 4).map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"}>
              <l.icon />
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
