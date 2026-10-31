import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Camera, Upload, RotateCcw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { ErrorNotice } from "./shared";
import { api, queryClient, useCommand, useData } from "@/lib/api";
export function SerialScanner({ orderId }: { orderId: string }) {
  const { data: demo } = useData("/demo-tools");
  const { data: available } = useData(
    `/orders/${orderId}/available-serials`,
    !!demo?.enabled,
  );
  const [serial, setSerial] = useState(""),
    [camera, setCamera] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const scan = useCommand(`/orders/${orderId}/scans`, () => setSerial(""));
  useEffect(() => {
    let cancelled = false;
    if (camera) {
      (async () => {
        try {
          if (!window.isSecureContext)
            throw Error(
              "Live camera needs HTTPS. Use manual entry or a USB scanner on this connection.",
            );
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const c = await reader.decodeFromVideoDevice(
            undefined,
            video.current!,
            (result) => {
              if (result && !cancelled) {
                setSerial(result.getText());
                setCamera(false);
              }
            },
          );
          if (cancelled) c.stop();
          else controls.current = c;
        } catch (e) {
          setError(e as Error);
          setCamera(false);
        }
      })();
    }
    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [camera]);
  return (
    <div className="scanner">
      {demo?.enabled && (
        <div className="sample-fill">
          <label htmlFor="demo-serial">
            Testing: choose an available device
          </label>
          <select
            id="demo-serial"
            value=""
            onChange={(e) => setSerial(e.target.value)}
          >
            <option value="">Choose the device to check</option>
            {available?.items.map((a: any) => (
              <option key={a.serial} value={a.serial}>
                {a.product_name} — {a.serial}
              </option>
            ))}
          </select>
          <small>
            This fills the serial field only. Select Add serial to run the
            normal stock checks.
          </small>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (serial.trim()) scan.mutate({ serial });
        }}
      >
        <Field>
          <FieldLabel htmlFor="serial-scan">Device serial number</FieldLabel>
          <Input
            id="serial-scan"
            placeholder="Scan barcode or type serial"
            autoComplete="off"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          />
        </Field>
        <div className="button-row">
          <Button type="submit" disabled={!serial.trim() || scan.isPending}>
            <ScanLine data-icon="inline-start" />
            {scan.isPending ? "Checking…" : "Add serial"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(null);
              setCamera(!camera);
            }}
          >
            <Camera data-icon="inline-start" />
            {camera ? "Stop camera" : "Use camera"}
          </Button>
        </div>
      </form>
      {camera && (
        <video
          ref={video}
          className="scanner-video"
          autoPlay
          muted
          playsInline
          aria-label="Barcode scanner camera"
        />
      )}
      <ErrorNotice error={scan.error || error} />
      {scan.isSuccess && (
        <p role="status" className="saved-feedback">
          Serial verified and allocated to this order.
        </p>
      )}
      <p className="field-hint">
        USB scanners work in the serial field. Live camera requires a secure
        HTTPS connection.
      </p>
    </div>
  );
}
export function EvidenceCapture({
  jobId,
  evidence,
  ticketId,
  components = [],
}: {
  jobId: string;
  evidence: any[];
  ticketId?: string;
  components?: any[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    pad = useRef<SignaturePad | null>(null);
  const [component, setComponent] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState<Error | null>(null),
    [saved, setSaved] = useState("");
  useEffect(() => {
    if (!canvas.current) return;
    const c = canvas.current;
    pad.current = new SignaturePad(c, {
      penColor: "#132e3b",
      backgroundColor: "#ffffff",
    });
    const resize = () => {
      const prior = pad.current!.toData(),
        ratio = window.devicePixelRatio || 1;
      c.width = c.offsetWidth * ratio;
      c.height = 180 * ratio;
      c.getContext("2d")!.scale(ratio, ratio);
      pad.current!.clear();
      pad.current!.fromData(prior);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    return () => {
      observer.disconnect();
      pad.current?.off();
    };
  }, []);
  async function upload(file: File | Blob, kind: "photo" | "signature") {
    setError(null);
    setBusy(kind);
    setSaved("");
    try {
      const body = new FormData();
      body.append("kind", kind);
      if (component && kind === "photo") {
        const c = components.find(
          (c: any) =>
            (c.order_line_id || c.id) + ":" + (c.asset_id || "") === component,
        );
        if (c) {
          body.append("order_line_id", c.order_line_id || c.id);
          if (c.asset_id) body.append("asset_id", c.asset_id);
        }
      }
      body.append(
        "file",
        file,
        kind === "signature"
          ? "signature.png"
          : file instanceof File
            ? file.name
            : "photo.png",
      );
      await api(
        ticketId ? `/tickets/${ticketId}/evidence` : `/jobs/${jobId}/evidence`,
        { method: "POST", body },
      );
      await queryClient.invalidateQueries();
      setSaved(
        `${kind === "photo" ? "Photo" : "Signature"} saved to the ${ticketId ? "repair visit" : "installation record"}.`,
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy("");
    }
  }
  function saveSignature() {
    if (pad.current?.isEmpty()) {
      setError(Error("Draw the homeowner’s signature before saving."));
      return;
    }
    canvas.current?.toBlob((blob) => {
      if (blob) void upload(blob, "signature");
    }, "image/png");
  }
  return (
    <div className="evidence-capture">
      <div>
        <h3>Test photo</h3>
        {components.length > 0 && (
          <label>
            Photo relates to
            <select
              value={component}
              onChange={(e) => setComponent(e.target.value)}
            >
              <option value="">Whole system / general evidence</option>
              {components.map((c: any) => (
                <option
                  key={(c.order_line_id || c.id) + ":" + (c.asset_id || "")}
                  value={(c.order_line_id || c.id) + ":" + (c.asset_id || "")}
                >
                  {c.description}
                  {c.serial ? " · " + c.serial : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <p>Upload a clear photo of the completed system or generation test.</p>
        <Field>
          <FieldLabel htmlFor="test-photo">
            <Camera /> Choose photo
          </FieldLabel>
          <input
            id="test-photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            disabled={!!busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file, "photo");
              e.target.value = "";
            }}
          />
        </Field>
      </div>
      <div>
        <h3>Homeowner signature</h3>
        <p>
          Ask the homeowner to sign inside the box, then save the signature.
        </p>
        <canvas
          ref={canvas}
          className="signature-canvas"
          aria-label="Homeowner signature drawing area"
        />
        <div className="button-row">
          <Button
            type="button"
            disabled={!!busy}
            variant="outline"
            onClick={saveSignature}
          >
            <Upload data-icon="inline-start" />
            Save signature
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => pad.current?.clear()}
          >
            <RotateCcw data-icon="inline-start" />
            Clear
          </Button>
        </div>
        <details>
          <summary>Upload an existing signature instead</summary>
          <Field>
            <FieldLabel htmlFor="signature-file">
              Signature image (PNG)
            </FieldLabel>
            <input
              id="signature-file"
              type="file"
              accept="image/png"
              disabled={!!busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, "signature");
                e.target.value = "";
              }}
            />
          </Field>
        </details>
      </div>
      {busy && <p role="status">Uploading {busy}…</p>}
      <ErrorNotice error={error} />
      {saved && (
        <p className="saved-feedback" role="status">
          {saved}
        </p>
      )}
      <EvidenceList evidence={evidence} />
    </div>
  );
}
export function EvidenceList({ evidence }: { evidence: any[] }) {
  return evidence.length ? (
    <div className="evidence-list">
      {evidence.map((e) => (
        <a
          href={`/api/evidence/${e.id}`}
          target="_blank"
          rel="noreferrer"
          key={e.id}
        >
          <img
            width={150}
            height={95}
            loading="lazy"
            src={`/api/evidence/${e.id}`}
            alt={
              e.kind === "signature"
                ? "Saved homeowner signature"
                : "Saved work photo"
            }
          />
          <span>
            {e.kind === "signature" ? "Signature" : "Test photo"} · saved
            {e.component_description && (
              <small>
                {e.component_description} {e.serial}
              </small>
            )}
          </span>
        </a>
      ))}
    </div>
  ) : null;
}
