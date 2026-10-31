import { clearDrafts } from "./form-safety";
import { DemoSwitcher } from "./demo-switcher";
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
  ScanLine,
  Users,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSession } from "./session";
import { api, queryClient, setCsrf } from "@/lib/api";
import { roleNames } from "@/lib/workflow";
import { cn } from "@/lib/utils";
export const navigation = [
  { to: "/", label: "Home", short: "Home", icon: LayoutDashboard },
  {
    to: "/schedule",
    label: "Visits & scheduling",
    short: "Visits",
    icon: HardHat,
    roles: ["admin", "coordinator", "technician", "support", "surveyor"],
  },
  {
    to: "/projects",
    label: "Customers & projects",
    short: "Projects",
    icon: FolderKanban,
  },
  {
    to: "/inventory",
    label: "Stock & deliveries",
    short: "Stock",
    icon: Package,
    roles: ["admin", "warehouse", "accounts"],
  },
  {
    to: "/jobs",
    label: "Installation jobs",
    short: "Jobs",
    icon: HardHat,
    roles: ["admin", "technician", "surveyor", "sales", "coordinator"],
  },
  {
    to: "/service",
    label: "Repairs & warranty",
    short: "Repairs",
    icon: ShieldCheck,
    roles: [
      "admin",
      "support",
      "accounts",
      "coordinator",
      "technician",
      "warehouse",
    ],
  },
  {
    to: "/reports",
    label: "Money & reports",
    short: "Money",
    icon: ChartNoAxesCombined,
    roles: ["admin", "accounts"],
  },
  {
    to: "/barcodes",
    label: "Barcode labels",
    short: "Labels",
    icon: ScanLine,
    roles: ["admin", "warehouse", "accounts"],
  },
  {
    to: "/team",
    label: "Team & access",
    short: "Team",
    icon: Users,
    roles: ["admin"],
  },
  { to: "/help", label: "Screen guide", short: "Guide", icon: BookOpen },
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
      clearDrafts();
      setCsrf("");
      await queryClient.cancelQueries();
      queryClient.setQueryData(["session"], null);
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== "session",
      });
    } catch {
      setLogoutError("Could not sign out. Check your connection and retry.");
    }
  }
  const visible = navigation.filter(
    (l) => !l.roles || l.roles.includes(user.role),
  );
  const current = navigation.find(
    (l) => l.to !== "/" && location.pathname.startsWith(l.to),
  );
  const bottom = visible.filter((l) => l.to !== "/help").slice(0, 3);
  const nav = (mobile = false) => (
    <nav aria-label={mobile ? "Mobile menu" : "Main navigation"}>
      {visible.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === "/"}
          onClick={() => setOpen(false)}
          className={({ isActive }) => cn("nav-item", isActive && "active")}
        >
          <l.icon aria-hidden="true" />
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
  const profile = (
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
        <small>{roleNames[user.role]}</small>
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
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Sun />
          </span>
          <span>
            sunpower<small>Installation workspace</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" />
          SunPower Solutions
        </div>
        {nav()}
        <div className="sidebar-bottom">
          <Link className="public-link" to="/enquire">
            Customer enquiry form
          </Link>
          {profile}
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="navigation-dialog">
          <DialogTitle>Go to a screen</DialogTitle>
          <DialogDescription>
            {user.name} · {roleNames[user.role]}
          </DialogDescription>
          {nav(true)}
          {profile}
        </DialogContent>
      </Dialog>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu />
            </Button>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              {current && (
                <>
                  <span>/</span>
                  <Link to={current.to}>{current.label}</Link>
                </>
              )}
              {/^\/projects\/[^/]+/.test(location.pathname) && (
                <>
                  <span>/</span>
                  <strong>
                    {location.pathname.endsWith("/new")
                      ? "New enquiry"
                      : "Project details"}
                  </strong>
                </>
              )}
            </nav>
          </div>
          <div className="topbar-right">
            <DemoSwitcher />
            <span className="demo-indicator">Demo workspace</span>
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
          <Link to="/help">Need help? Open the screen guide</Link>
        </footer>
      </div>
      <nav className="mobile-bottom" aria-label="Quick navigation">
        {bottom.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"}>
            <l.icon aria-hidden="true" />
            <span>{l.short}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          <Menu />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
