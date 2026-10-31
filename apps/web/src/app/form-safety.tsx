import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useBlocker } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Entry = { discard: () => void };
const Context = createContext<{
  set: (id: string, value: Entry | null) => void;
}>({ set: () => {} });
export function FormSafety({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, Entry>()),
    [dirty, setDirty] = useState(false);
  const set = useCallback((id: string, value: Entry | null) => {
    if (value) entries.current.set(id, value);
    else entries.current.delete(id);
    setDirty(entries.current.size > 0);
  }, []);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      entries.current.size > 0 &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  return (
    <Context value={{ set }}>
      {children}
      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogContent>
          <DialogTitle>Leave unsaved changes?</DialogTitle>
          <DialogDescription>
            Your changes have not been submitted. Stay to finish, or discard the
            changes before leaving.
          </DialogDescription>
          <div className="button-row">
            <Button
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
              }}
            >
              Stay on this screen
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                for (const e of entries.current.values()) e.discard();
                entries.current.clear();
                setDirty(false);
                if (blocker.state === "blocked") blocker.proceed();
              }}
            >
              Discard changes and leave
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Context>
  );
}
export const useFormSafety = () => useContext(Context);
export const draftPrefix = "sunpower-draft:";
export function clearDrafts() {
  for (const k of Object.keys(sessionStorage))
    if (k.startsWith(draftPrefix) || k.startsWith("sunpower-attempt:"))
      sessionStorage.removeItem(k);
  window.dispatchEvent(new CustomEvent("solar:clear-drafts"));
}
export function readDraft(key: string) {
  try {
    const d = JSON.parse(sessionStorage.getItem(key) || "null");
    if (d && Date.now() - d.saved_at < 86400000) return d.values;
    sessionStorage.removeItem(key);
  } catch {}
  return null;
}
