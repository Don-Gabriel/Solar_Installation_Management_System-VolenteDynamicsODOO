import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";

export function AppUpdate() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [error, setError] = useState("");
  const {
    needRefresh: [ready],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, worker) {
      registration.current = worker;
    },
  });
  useEffect(() => {
    const check = () => {
      if (navigator.onLine) void registration.current?.update().catch(() => {});
    };
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 60000);
    return () => {
      window.removeEventListener("focus", check);
      window.clearInterval(timer);
    };
  }, []);
  if (!ready) return null;
  return (
    <section className="app-update" aria-label="App update">
      <p role="status">
        A newer version is ready. Save your work, then reload.
      </p>
      <Button
        onClick={() => {
          void updateServiceWorker(true).catch(() =>
            setError("Could not reload. Try again when connected."),
          );
        }}
      >
        Reload latest version
      </Button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
