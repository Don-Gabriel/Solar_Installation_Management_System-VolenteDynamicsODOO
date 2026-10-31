import { useEffect, useId, useRef, useState } from "react";
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
    [error, setError] = useState<Error | null>(null),
    [readingPhoto, setReadingPhoto] = useState(false),
    [scanMessage, setScanMessage] = useState("");
  const fieldId = useId();
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const serialInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoAttempt = useRef(0);
  const scan = useCommand(`/orders/${orderId}/scans`, () => {
    setSerial("");
    setScanMessage("");
  });
  useEffect(
    () => () => {
      photoAttempt.current++;
    },
    [],
  );
  function acceptRead(value: string) {
    setSerial(value.trim());
    setScanMessage(
      `Barcode read: ${value.trim()}. Select Add serial to check and save it.`,
    );
    setCamera(false);
    serialInput.current?.focus();
  }
  async function readPhoto(file?: File) {
    if (!file) return;
    setCamera(false);
    setError(null);
    setScanMessage("");
    if (
      !/^image\/(png|jpeg|webp)$/.test(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError(
        Error("Choose a JPG, PNG or WebP barcode photo smaller than 8 MB."),
      );
      return;
    }
    const attempt = ++photoAttempt.current;
    setReadingPhoto(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(
        url,
      );
      if (photoAttempt.current === attempt) acceptRead(result.getText());
    } catch {
      if (photoAttempt.current === attempt)
        setError(
          Error(
            "No readable barcode found. Use a sharp photo with the entire barcode and white space on both sides, or type the serial below the bars.",
          ),
        );
    } finally {
      URL.revokeObjectURL(url);
      if (photoAttempt.current === attempt) setReadingPhoto(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const preview = video.current;
    if (camera) {
      (async () => {
        try {
          if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
            throw Error(
              "Live camera needs HTTPS or localhost. Use Read barcode photo, type the serial, or connect a USB scanner on this connection.",
            );
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });
          if (cancelled || !preview) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          preview.srcObject = stream;
          await preview.play();
          if (cancelled) return;
          setScanMessage(
            "Camera ready. Fit the entire barcode inside the box and hold still.",
          );
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { willReadFrequently: true });
          const readFrame = () => {
            if (cancelled) return;
            if (
              preview.readyState >= 2 &&
              preview.videoWidth &&
              frame.current &&
              context
            ) {
              // Match the visible box to the camera pixels, including object-fit: cover cropping.
              const bounds = preview.getBoundingClientRect();
              const target = frame.current.getBoundingClientRect();
              const scale = Math.max(
                bounds.width / preview.videoWidth,
                bounds.height / preview.videoHeight,
              );
              if (scale > 0) {
                const x =
                  (target.left -
                    bounds.left +
                    (preview.videoWidth * scale - bounds.width) / 2) /
                  scale;
                const y =
                  (target.top -
                    bounds.top +
                    (preview.videoHeight * scale - bounds.height) / 2) /
                  scale;
                canvas.width = Math.round(target.width / scale);
                canvas.height = Math.round(target.height / scale);
                context.drawImage(
                  preview,
                  x,
                  y,
                  canvas.width,
                  canvas.height,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                try {
                  acceptRead(reader.decodeFromCanvas(canvas).getText());
                  stream?.getTracks().forEach((track) => track.stop());
                  return;
                } catch {
                  /* Keep trying while the barcode comes into focus. */
                }
              }
            }
            timer = setTimeout(readFrame, 200);
          };
          readFrame();
        } catch (e) {
          if (cancelled) return;
          const failure = e as Error;
          setError(
            Error(
              failure.name === "NotAllowedError"
                ? "Camera permission was denied. Allow camera access in your browser settings and try again, or select Read barcode photo."
                : failure.name === "NotFoundError"
                  ? "No camera was found. Select Read barcode photo, use a USB scanner, or type the serial."
                  : failure.name === "NotReadableError"
                    ? "The camera is busy. Close other apps using it and try again, or select Read barcode photo."
                    : failure.message,
            ),
          );
          setScanMessage("");
          setCamera(false);
        }
      })();
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (preview) preview.srcObject = null;
    };
  }, [camera]);
  return (
    <div className="scanner">
      {demo?.enabled && (
        <div className="sample-fill">
          <label htmlFor={`${fieldId}-demo`}>
            Testing: choose an available device
          </label>
          <select
            id={`${fieldId}-demo`}
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
          <FieldLabel htmlFor={`${fieldId}-serial`}>
            Device serial number
          </FieldLabel>
          <Input
            id={`${fieldId}-serial`}
            ref={serialInput}
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
            disabled={readingPhoto}
            onClick={() => {
              setError(null);
              setScanMessage(camera ? "Camera stopped." : "Opening camera…");
              setCamera(!camera);
            }}
          >
            <Camera data-icon="inline-start" />
            {camera ? "Stop camera" : "Use camera"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={readingPhoto}
            onClick={() => photoInput.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {readingPhoto ? "Reading photo…" : "Read barcode photo"}
          </Button>
          <input
            ref={photoInput}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            aria-label="Barcode photo"
            onChange={(e) => {
              void readPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </form>
      {camera && (
        <div className="scanner-preview">
          <video
            ref={video}
            className="scanner-video"
            autoPlay
            muted
            playsInline
            aria-label="Barcode scanner camera"
          />
          <div ref={frame} className="scanner-frame" aria-hidden="true" />
          <p className="scanner-guide">
            Keep the whole barcode inside this box
          </p>
        </div>
      )}
      {camera && (
        <p className="field-hint">
          Keep the bars upright, leave white space at both ends, and move back
          until the whole label fits. Avoid glare and hold still.
        </p>
      )}
      {scanMessage && (
        <p role="status" className="scanner-status">
          {scanMessage}
        </p>
      )}
      <ErrorNotice error={scan.error || error} />
      {scan.isSuccess && (
        <p role="status" className="saved-feedback">
          Serial verified and allocated to this order.
        </p>
      )}
      <p className="field-hint">
        Reading a barcode fills the serial field. Select Add serial to save it.
        USB scanners also work in this field. Barcode photos are read on this
        device and are not uploaded.
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
