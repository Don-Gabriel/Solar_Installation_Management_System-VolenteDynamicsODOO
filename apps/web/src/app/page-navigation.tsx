import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/api";
export function PageNavigation() {
  const navigate = useNavigate();
  useLocation();
  const [busy, setBusy] = useState(false);
  return (
    <nav className="page-navigation" aria-label="Page controls">
      <Button
        variant="outline"
        disabled={!(window.history.state?.idx > 0)}
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} /> Back
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await queryClient.invalidateQueries();
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw size={16} /> {busy ? "Refreshing…" : "Refresh"}
      </Button>
      <span className="field-hint">
        {busy ? "Updating this screen…" : "Refresh keeps your unsaved entries."}
      </span>
    </nav>
  );
}
