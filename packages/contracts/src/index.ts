import { Type, type Static } from "typebox";
const text = (max = 500) => Type.String({ minLength: 1, maxLength: max });
const optionalText = (max = 2000) =>
  Type.Optional(Type.String({ maxLength: max }));
export const Id = Type.String({ format: "uuid" });
export const Money = Type.Integer({ minimum: 0, maximum: 1000000000000 });
export const Login = Type.Object(
  {
    email: Type.String({ format: "email", maxLength: 200 }),
    password: text(200),
  },
  { additionalProperties: false },
);
export const Enquiry = Type.Object(
  {
    name: text(150),
    phone: Type.String({ pattern: "^[+0-9 ()-]{7,20}$" }),
    address: text(1000),
    capacity_kw: Type.Integer({ minimum: 1, maximum: 5 }),
    system_type: Type.Union([
      Type.Literal("on_grid"),
      Type.Literal("off_grid"),
      Type.Literal("panel_set"),
    ]),
    source: text(100),
    notes: optionalText(),
    subsidy_interest: Type.Boolean(),
    owner_id: Type.Optional(Id),
    follow_up: Type.Optional(Type.String({ format: "date" })),
  },
  { additionalProperties: false },
);
export type EnquiryInput = Static<typeof Enquiry>;
export const Survey = Type.Object(
  {
    roof_area: Type.Number({ minimum: 1, maximum: 100000 }),
    bill_minor: Money,
    grid_suitable: Type.Boolean(),
    direction: text(80),
    tilt: Type.Number({ minimum: 0, maximum: 90 }),
    cable_distance: Type.Number({ minimum: 0, maximum: 10000 }),
    notes: optionalText(),
  },
  { additionalProperties: false },
);
export const Approval = Type.Object(
  { approved: Type.Boolean() },
  { additionalProperties: false },
);
export const Payment = Type.Object(
  {
    amount_minor: Type.Integer({ minimum: 1, maximum: 1000000000000 }),
    method: Type.Union(
      ["cash", "bank", "upi", "card"].map((v) => Type.Literal(v)),
    ),
    reference: text(120),
  },
  { additionalProperties: false },
);
export const Receipt = Type.Object(
  {
    product_id: Id,
    supplier: text(150),
    reference: text(150),
    quantity: Type.Integer({ minimum: 1, maximum: 10000 }),
    unit_cost_minor: Money,
    serials: Type.Array(Type.String({ minLength: 2, maxLength: 100 }), {
      maxItems: 10000,
    }),
  },
  { additionalProperties: false },
);
export const Scan = Type.Object(
  { serial: text(100) },
  { additionalProperties: false },
);
export const Assignment = Type.Object(
  {
    technician_id: Id,
    technician_ids: Type.Optional(Type.Array(Id, { minItems: 1, maxItems: 5 })),
    scheduled_at: Type.String({ format: "date-time" }),
    duration_hours: Type.Integer({ minimum: 1, maximum: 12 }),
  },
  { additionalProperties: false },
);
export const Completion = Type.Object(
  {
    capacity_kw: Type.Number({ minimum: 0.1, maximum: 5 }),
    generation_kw: Type.Number({ minimum: 0, maximum: 10 }),
    labour_minutes: Type.Integer({ minimum: 1, maximum: 10080 }),
    crew_minutes: Type.Optional(
      Type.Record(Id, Type.Integer({ minimum: 0, maximum: 10080 })),
    ),
    signer_name: text(150),
    checklist: Type.Object(
      {
        mounting: Type.Boolean(),
        earthing: Type.Boolean(),
        wiring: Type.Boolean(),
        inverter: Type.Boolean(),
        handover: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export const Ticket = Type.Object(
  {
    warranty_id: Type.Optional(Id),
    parent_ticket_id: Type.Optional(Id),
    project_id: Type.Optional(Id),
    complaint: text(2000),
    fault_code: text(100),
    assigned_to: Type.Optional(Id),
    priority: Type.Optional(
      Type.Union([Type.Literal("routine"), Type.Literal("urgent")]),
    ),
  },
  { additionalProperties: false },
);
export const Resolution = Type.Object(
  {
    resolution: text(2000),
    version: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);
export const Confirmation = Type.Object(
  { confirmed_by: text(150) },
  { additionalProperties: false },
);
export const Subsidy = Type.Object(
  {
    status: Type.Union(
      [
        "documents_pending",
        "submitted",
        "approved",
        "received",
        "not_applicable",
      ].map((v) => Type.Literal(v)),
    ),
    reference: Type.String({ maxLength: 150 }),
    next_action: Type.String({ maxLength: 1000 }),
    documents: Type.Object(
      {
        identity: Type.Boolean(),
        electricity_bill: Type.Boolean(),
        bank_details: Type.Boolean(),
        installation_proof: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    owner_id: Type.Optional(Id),
  },
  { additionalProperties: false },
);
export const Params = Type.Object({ id: Id });
export const Availability = Type.Object(
  {
    from: Type.String({ format: "date" }),
    to: Type.String({ format: "date" }),
    skill: text(80),
    duration_hours: Type.Integer({ minimum: 1, maximum: 8 }),
    crew_size: Type.Integer({ minimum: 1, maximum: 5 }),
    visit_id: Type.Optional(Id),
  },
  { additionalProperties: false },
);
export const VisitBooking = Type.Object(
  {
    ticket_id: Type.Optional(Id),
    project_id: Type.Optional(Id),
    visit_id: Type.Optional(Id),
    version: Type.Optional(Type.Integer({ minimum: 1 })),
    starts_at: Type.String({ format: "date-time" }),
    duration_hours: Type.Integer({ minimum: 1, maximum: 8 }),
    skill: text(80),
    technician_ids: Type.Array(Id, { minItems: 1, maxItems: 5 }),
    lead_id: Id,
    reason: optionalText(),
  },
  { additionalProperties: false },
);
export const VisitAction = Type.Object(
  {
    action: Type.Union(
      ["start", "cancel", "no_access", "diagnosis_done"].map((v) =>
        Type.Literal(v),
      ),
    ),
    version: Type.Integer({ minimum: 1 }),
    reason: optionalText(),
  },
  { additionalProperties: false },
);
export const Leave = Type.Object(
  {
    user_id: Id,
    starts_at: Type.String({ format: "date-time" }),
    ends_at: Type.String({ format: "date-time" }),
    reason: text(1000),
  },
  { additionalProperties: false },
);
export const Diagnosis = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    lines: Type.Array(
      Type.Object(
        {
          order_line_id: Id,
          asset_id: Type.Optional(Id),
          quantity: Type.Integer({ minimum: 1, maximum: 1000 }),
          finding: text(2000),
          action: Type.Union([Type.Literal("repair"), Type.Literal("replace")]),
          replacement_serial: optionalText(100),
          labour_minutes: Type.Integer({ minimum: 0, maximum: 10080 }),
          labour_price_minor: Money,
          callout_price_minor: Type.Optional(Money),
          unit_price_minor: Type.Optional(Money),
          unit_cost_minor: Type.Optional(Money),
          coverage: Type.Optional(
            Type.Union(
              ["auto", "covered", "chargeable"].map((v) => Type.Literal(v)),
            ),
          ),
          labour_coverage: Type.Optional(
            Type.Union(
              ["auto", "covered", "chargeable"].map((v) => Type.Literal(v)),
            ),
          ),
          coverage_reason: optionalText(),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 50 },
    ),
  },
  { additionalProperties: false },
);
export const EstimateApproval = Type.Object(
  { version: Type.Integer({ minimum: 1 }), confirmed_by: text(200) },
  { additionalProperties: false },
);
export const TicketNote = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    action: Type.Union(
      ["note", "cancel", "dispute"].map((v) => Type.Literal(v)),
    ),
    note: text(2000),
  },
  { additionalProperties: false },
);
export const ListQuery = Type.Object({
  search: Type.Optional(Type.String({ maxLength: 150 })),
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  status: Type.Optional(Type.String({ maxLength: 40 })),
});
export type Role =
  | "admin"
  | "sales"
  | "surveyor"
  | "warehouse"
  | "technician"
  | "support"
  | "accounts"
  | "coordinator";
// Coordinators schedule and review service work; they do not gain financial administration.
export type User = { id: string; name: string; email: string; role: Role };

export const StaffUpdate = Type.Object(
  {
    role: Type.Union(
      [
        "admin",
        "sales",
        "surveyor",
        "warehouse",
        "technician",
        "support",
        "accounts",
        "coordinator",
      ].map((v) => Type.Literal(v)),
    ),
    active: Type.Boolean(),
    dispatch_enabled: Type.Boolean(),
    skills: Type.Array(
      Type.Union(
        [
          "installation",
          "inverter_repair",
          "battery_repair",
          "survey",
          "crew_lead",
        ].map((v) => Type.Literal(v)),
      ),
      { maxItems: 5, uniqueItems: true },
    ),
    working_days: Type.Array(Type.Integer({ minimum: 0, maximum: 6 }), {
      maxItems: 7,
      uniqueItems: true,
    }),
    reason: text(1000),
  },
  { additionalProperties: false },
);

export const CrewPayment = Type.Object(
  { technician_id: Id, confirmed_by: text(150) },
  { additionalProperties: false },
);
