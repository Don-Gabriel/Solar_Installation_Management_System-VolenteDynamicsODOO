import { useState } from "react";
import {
  PackagePlus,
  Package,
  ScanLine,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PageHead,
  Panel,
  Modal,
  CommandForm,
  Loading,
  ErrorNotice,
  Status,
  Blank,
} from "@/components/shared";
import { useData, date, money } from "@/lib/api";
import { Can } from "@/app/session";
export function Inventory() {
  const { data, error, isPending } = useData("/inventory"),
    { data: projects } = useData("/projects?status=confirmed");
  const [receive, setReceive] = useState(false),
    [search, setSearch] = useState("");
  if (isPending) return <Loading />;
  if (error) return <ErrorNotice error={error} />;
  const products = data.products.filter((p: any) => p.kind !== "service"),
    assets = data.assets.filter((a: any) =>
      `${a.serial} ${a.product_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <PageHead
        title="Warehouse"
        description="Know what’s available, what’s reserved and where every device goes."
      >
        <Can roles={["admin", "warehouse"]}>
          <Button onClick={() => setReceive(true)}>
            <PackagePlus data-icon="inline-start" />
            Receive stock
          </Button>
        </Can>
      </PageHead>
      <div className="metrics three">
        <div className="metric">
          <span>
            <Package />
            Stocked products
          </span>
          <strong>{products.length}</strong>
          <p>Hardware and installation materials</p>
        </div>
        <div className="metric">
          <span>
            <ScanLine />
            Available serialized devices
          </span>
          <strong>
            {data.assets.filter((a: any) => a.status === "available").length}
          </strong>
          <p>Ready for allocation to projects</p>
        </div>
        <div className="metric">
          <span>
            <PackagePlus />
            Packing queue
          </span>
          <strong>{projects?.total || 0}</strong>
          <p>Confirmed orders awaiting dispatch</p>
        </div>
      </div>
      {projects?.items.length > 0 && (
        <Panel
          title="Ready for the next step"
          description="Open a project to reserve stock and scan its devices."
        >
          <div className="packing-queue">
            {projects.items.map((p: any) => (
              <Link key={p.id} to={`/projects/${p.id}?tab=delivery`}>
                <Package />
                <div>
                  <strong>{p.customer_name}</strong>
                  <small>
                    {p.capacity_kw} kW · {p.system_type.replaceAll("_", " ")}
                  </small>
                </div>
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        </Panel>
      )}
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock levels</TabsTrigger>
          <TabsTrigger value="serials">Device serials</TabsTrigger>
          <TabsTrigger value="receipts">Purchase receipts</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <Panel
            title="Product availability"
            description="Available = on hand − reserved for confirmed projects."
          >
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>On hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>{p.sku}</small>
                      </td>
                      <td>{p.stock_qty}</td>
                      <td>{p.reserved_qty}</td>
                      <td>
                        <span
                          className={
                            p.stock_qty - p.reserved_qty < 5
                              ? "warning-number"
                              : "stock-number"
                          }
                        >
                          {p.stock_qty - p.reserved_qty}
                        </span>
                      </td>
                      <td>
                        <Status value={p.kind} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="serials">
          <Panel
            title="Serial register"
            description="Serials are unique across the entire inventory."
          >
            <Field>
              <FieldLabel htmlFor="asset-search" className="sr-only">
                Search serials
              </FieldLabel>
              <div className="search-field">
                <Search />
                <Input
                  id="asset-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find serial or product…"
                />
              </div>
            </Field>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Serial number</th>
                    <th>Product</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a: any) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.serial}</strong>
                      </td>
                      <td>{a.product_name}</td>
                      <td>
                        <Status value={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!assets.length && <Blank title="No matching devices" />}
          </Panel>
        </TabsContent>
        <TabsContent value="receipts">
          <Panel
            title="Purchase receipts"
            description="Acquisition costs feed the cost of dispatched materials."
          >
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference / supplier</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Purchase total</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.receipts.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.reference}</strong>
                        <small>{r.supplier}</small>
                      </td>
                      <td>{r.product_name}</td>
                      <td>{r.quantity}</td>
                      <td>{money(r.quantity * r.unit_cost_minor)}</td>
                      <td>{date(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
      <Modal
        open={receive}
        onClose={() => setReceive(false)}
        title="Receive purchased stock"
        description="Enter one serial per line for inverters, batteries and controllers. Leave serials empty for quantity-tracked materials."
      >
        <CommandForm
          path="/receipts"
          onDone={() => setReceive(false)}
          submit="Receive into inventory"
          defaults={{
            product_id: products[0]?.id,
            quantity: 1,
            unit_cost_minor: 0,
            serials: "",
          }}
          transform={(b) => ({
            ...b,
            serials: b.serials
              .split(/[\n,]+/)
              .map((s: string) => s.trim())
              .filter(Boolean),
          })}
          fields={[
            {
              name: "product_id",
              label: "Product",
              type: "select",
              full: true,
              options: products.map((p: any) => ({
                value: p.id,
                label: `${p.sku} · ${p.name}`,
              })),
            },
            { name: "supplier", label: "Supplier" },
            { name: "reference", label: "Purchase reference" },
            {
              name: "quantity",
              label: "Quantity received",
              type: "number",
              min: 1,
              max: 10000,
            },
            {
              name: "unit_cost_minor",
              label: "Unit acquisition cost (₹)",
              type: "number",
              money: true,
              min: 0,
            },
            {
              name: "serials",
              label: "Device serials (one per line)",
              type: "textarea",
              required: false,
              full: true,
            },
          ]}
        />
      </Modal>
    </>
  );
}
