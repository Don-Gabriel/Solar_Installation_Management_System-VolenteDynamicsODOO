export const roleNames: Record<string, string> = {
  coordinator: "Service coordinator",
  admin: "Administrator",
  sales: "Sales",
  surveyor: "Site surveyor",
  warehouse: "Stock team",
  technician: "Installer",
  support: "Customer support",
  accounts: "Accounts",
};
export const roleDescriptions: Record<string, string> = {
  coordinator:
    "Plan visits and crews, check availability, manage leave and review repair estimates.",
  admin:
    "Manage the full journey, approve work, assign installers and view money reports.",
  sales:
    "Add customers, prepare quotes after survey approval and record payments.",
  surveyor: "Record roof measurements and approve or reject site surveys.",
  warehouse:
    "Receive stock, reserve equipment, scan serials and confirm delivery.",
  technician:
    "See only your assigned projects. Start work, save evidence and finish installation.",
  support: "Check warranties, record repairs and obtain customer confirmation.",
  accounts:
    "Record customer payments, manage subsidy records and review costs and staff payments.",
};
type Step = { title: string; detail: string; tab: string; roles: string[] };
export function nextProjectStep(d: any): Step {
  const p = d.project,
    survey = d.surveys[0],
    order = d.order,
    job = d.job;
  if (!survey || survey.status === "rejected")
    return {
      title: "Record a site survey",
      detail:
        "A site surveyor checks the roof and records the actual measurements.",
      tab: "survey",
      roles: ["admin", "surveyor"],
    };
  if (survey.status !== "approved" && !order)
    return {
      title: "Review the site survey",
      detail: "Approve a suitable roof before the sales team prepares a quote.",
      tab: "survey",
      roles: ["admin", "surveyor"],
    };
  if (!order && p.stage !== "quoted" && !d.quotes.length)
    return {
      title: "Prepare the customer quote",
      detail:
        "The approved system package fills the equipment list and prices for you.",
      tab: "quote",
      roles: ["admin", "sales"],
    };
  if (!order)
    return {
      title: "Record customer acceptance",
      detail:
        "Check the itemized quote with the customer, then accept it to create an order.",
      tab: "quote",
      roles: ["admin", "sales"],
    };
  if (order.status === "packing") {
    if (!order.advance_received)
      return {
        title: "Record the advance payment",
        detail:
          "Sales or accounts records the payment before the stock team reserves equipment.",
        tab: "quote",
        roles: ["admin", "sales", "accounts"],
      };
    if (
      !order.lines
        .filter((l: any) => l.kind !== "service")
        .every((l: any) => l.reserved)
    )
      return {
        title: "Reserve the equipment",
        detail:
          "Set aside the required quantities. Shortages must be received into stock first.",
        tab: "delivery",
        roles: ["admin", "warehouse"],
      };
    const missing = order.lines
      .filter((l: any) => l.kind === "serialized")
      .some(
        (l: any) =>
          d.assets.filter(
            (a: any) => a.order_line_id === l.id && a.status !== "replaced",
          ).length < l.quantity,
      );
    return {
      title: missing
        ? "Scan the required devices"
        : "Confirm packing and send equipment",
      detail: missing
        ? "Use the printed barcodes, camera or test serial picker. Every required device must be checked."
        : "All required devices are recorded. Check the packing list before dispatch.",
      tab: "delivery",
      roles: ["admin", "warehouse"],
    };
  }
  if (order.status === "dispatched")
    return {
      title: "Confirm customer delivery",
      detail:
        "Record delivery only after the customer receives the equipment. This starts the warranties.",
      tab: "delivery",
      roles: ["admin", "warehouse"],
    };
  if (!job?.technician_id)
    return {
      title: "Assign an installer and time",
      detail:
        "The administrator chooses an installer and a time without an overlapping job.",
      tab: "installation",
      roles: ["admin"],
    };
  if (job.status !== "completed")
    return {
      title:
        job.status === "in_progress"
          ? "Finish the installation checklist"
          : "Start the installation",
      detail:
        "The assigned installer saves a photo, customer signature, measurements and safety checks.",
      tab: "installation",
      roles: ["admin", "technician"],
    };
  return {
    title: "Installation completed",
    detail:
      "Review the device history and saved handover. Support handles any future repair request.",
    tab: "passport",
    roles: [
      "admin",
      "sales",
      "surveyor",
      "warehouse",
      "technician",
      "support",
      "accounts",
    ],
  };
}
export const stageTabs: Record<string, string> = {
  enquiry: "survey",
  survey: "survey",
  quoted: "quote",
  confirmed: "delivery",
  dispatched: "delivery",
  delivered: "installation",
  completed: "passport",
};
