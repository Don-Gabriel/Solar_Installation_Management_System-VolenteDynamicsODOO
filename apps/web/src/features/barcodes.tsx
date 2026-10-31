import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Link, useSearchParams } from "react-router";
import { Printer, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PageHead,
  Loading,
  ErrorNotice,
  Status,
  Blank,
} from "@/components/shared";
import { useData } from "@/lib/api";
export function Barcode({ serial }: { serial: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current)
      JsBarcode(ref.current, serial, {
        format: "CODE128",
        width: 2,
        height: 55,
        fontSize: 15,
        margin: 16,
        background: "#ffffff",
        lineColor: "#000000",
      });
  }, [serial]);
  return (
    <svg
      ref={ref}
      role="img"
      aria-label={`Barcode ${serial}`}
      className="device-barcode"
    />
  );
}
export function Barcodes() {
  const { data, error, isPending } = useData("/barcodes");
  const [params, setParams] = useSearchParams();
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const search = params.get("search") || "",
    sku = params.get("product") || "",
    status = params.get("status") || "";
  function filter(k: string, v: string) {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  }
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const items = data.items.filter(
    (a: any) =>
      (!sku || a.sku === sku) &&
      (!status || a.status === status) &&
      `${a.serial} ${a.product_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Barcode labels"
        description="Print or copy the exact serial numbers already saved in stock."
      >
        <Button onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Print these labels
        </Button>
      </PageHead>
      <div className="panel panel-body barcode-controls">
        <label>
          Find a serial
          <Input
            value={search}
            onChange={(e) => filter("search", e.target.value)}
            placeholder="Search a device…"
          />
        </label>
        <label>
          Product
          <select
            value={sku}
            onChange={(e) => filter("product", e.target.value)}
          >
            <option value="">All products</option>
            {[...new Set<string>(data.items.map((a: any) => a.sku))].map(
              (v) => (
                <option key={v} value={v}>
                  {data.items.find((a: any) => a.sku === v).product_name}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Stock status
          <select
            value={status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "available",
              "allocated",
              "dispatched",
              "delivered",
              "replaced",
            ].map((v) => (
              <option key={v} value={v}>
                {v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="barcode-note">
        <p>
          <strong>{items.length} labels shown.</strong> Each label identifies
          one physical device. Printing a label does not add stock or change its
          status.
        </p>
        <p>
          For a successful packing test, use an <strong>Available</strong>{" "}
          serial for the required product. An already-used label is useful for
          testing duplicate rejection. Print at 100% scale.
        </p>
        <Link to="/inventory">Back to stock</Link>
        {copyError && <p role="alert">{copyError}</p>}
      </div>
      <div className="barcode-grid">
        {items.map((a: any) => (
          <article className="barcode-card" key={a.id}>
            <header>
              <strong>{a.product_name}</strong>
              <Status value={a.status} />
            </header>
            <Barcode serial={a.serial} />
            <footer>
              <span>{a.sku}</span>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(a.serial);
                    setCopied(a.serial);
                    setCopyError("");
                  } catch {
                    setCopyError(
                      "Clipboard is unavailable. Select and copy the serial printed below the bars.",
                    );
                  }
                }}
              >
                {copied === a.serial ? <Check /> : <Copy />}
                {copied === a.serial ? "Copied" : "Copy serial"}
              </Button>
            </footer>
          </article>
        ))}
      </div>
      {!items.length && <Blank title="No matching labels" />}
    </>
  );
}
