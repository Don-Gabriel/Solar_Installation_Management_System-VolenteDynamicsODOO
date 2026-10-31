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
    capacity_kw: Type.Union([
      Type.Integer({ minimum: 1, maximum: 5 }),
      Type.Null(),
    ]),
    customer_id: Type.Optional(Id),
    site_id: Type.Optional(Id),
    billing_address: optionalText(1000),
    access_notes: optionalText(2000),
    preferred_date: Type.Optional(Type.String({ format: "date" })),
    preferred_window: Type.Optional(
      Type.Union([
        Type.Literal("any"),
        Type.Literal("morning"),
        Type.Literal("afternoon"),
      ]),
    ),
    hazard_notes: optionalText(2000),
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
export const CustomerEdit = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    name: text(150),
    phone: Type.String({ pattern: "^[+0-9 ()-]{7,20}$" }),
    phone_verified: Type.Boolean(),
    billing_address: Type.String({ maxLength: 1000 }),
    reason: text(2000),
  },
  { additionalProperties: false },
);
export const SiteEdit = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    access_notes: Type.String({ maxLength: 2000 }),
    reason: text(2000),
  },
  { additionalProperties: false },
);
export const CustomerMerge = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    target_id: Id,
    target_version: Type.Integer({ minimum: 1 }),
    confirmed_same_customer: Type.Boolean(),
    reason: text(2000),
  },
  { additionalProperties: false },
);
export const ContactNote = Type.Object(
  { note: text(2000) },
  { additionalProperties: false },
);
export const Survey = Type.Object(
  {
    capacity_kw: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
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
export const QuoteAcceptance = Type.Object(
  { quote_id: Type.Optional(Id) },
  { additionalProperties: false },
);
export const ReviewDecision = Type.Object(
  { approved: Type.Boolean(), note: text(2000) },
  { additionalProperties: false },
);
export const FinancialReason = Type.Object(
  { reason: text(2000) },
  { additionalProperties: false },
);
export const InvoiceCorrection = Type.Object(
  {
    reason: text(2000),
    credit_minor: Type.Integer({ minimum: 1, maximum: 1000000000000 }),
    replacement_lines: Type.Optional(
      Type.Array(
        Type.Object(
          {
            description: text(500),
            quantity: Type.Integer({ minimum: 1, maximum: 10000 }),
            unit_price_minor: Money,
          },
          { additionalProperties: false },
        ),
        { maxItems: 50 },
      ),
    ),
  },
  { additionalProperties: false },
);
export const Refund = Type.Object(
  {
    amount_minor: Type.Integer({ minimum: 1, maximum: 1000000000000 }),
    reference: text(150),
    reason: text(2000),
  },
  { additionalProperties: false },
);
export const Payment = Type.Object(
  {
    amount_minor: Type.Integer({ minimum: 1, maximum: 1000000000000 }),
    method: Type.Union(
      ["cash", "bank", "upi", "card"].map((v) => Type.Literal(v)),
    ),
    reference: text(120),
    status: Type.Optional(
      Type.Union([Type.Literal("pending"), Type.Literal("verified")]),
    ),
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
    job_id: Type.Optional(Id),
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
      [
        "start",
        "cancel",
        "no_access",
        "diagnosis_done",
        "acknowledge",
        "decline",
      ].map((v) => Type.Literal(v)),
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
export const ServiceOutcome = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    kind: Type.Union([Type.Literal("remote"), Type.Literal("no_fault")]),
    observations: text(2000),
    customer_confirmation: Type.Optional(Type.String({ maxLength: 500 })),
    minutes: Type.Optional(Type.Integer({ minimum: 0, maximum: 720 })),
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
          entitlement_review: optionalText(),
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
  | "coordinator"
  | "customer";
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
export const ScheduleSearch = Type.Object(
  {
    ...Availability.properties,
    ticket_id: Type.Optional(Id),
    project_id: Type.Optional(Id),
  },
  { additionalProperties: false },
);
export const TaskOutcome = Type.Object(
  { version: Type.Integer({ minimum: 1 }), outcome: text(2000) },
  { additionalProperties: false },
);
export const Holiday = Type.Object(
  { day: Type.String({ format: "date" }), reason: text(500) },
  { additionalProperties: false },
);
export const VisitExtension = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    ends_at: Type.String({ format: "date-time" }),
    reason: text(1000),
  },
  { additionalProperties: false },
);

export const ExternalEquipment = Type.Object(
  { name: text(150), serial: optionalText(100), findings: text(2000) },
  { additionalProperties: false },
);
export const SupplierClaim = Type.Object(
  {
    supplier: text(150),
    reference: text(150),
    tracking_reference: text(150),
    requested_minor: Type.Integer({ minimum: 1, maximum: 1000000000000 }),
  },
  { additionalProperties: false },
);
export const SupplierDecision = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    status: Type.Union(
      ["approved", "declined", "disputed"].map((v) => Type.Literal(v)),
    ),
    amount_minor: Money,
    note: text(2000),
  },
  { additionalProperties: false },
);
export const SupplierRecovery = Type.Object(
  {
    amount_minor: Type.Integer({ minimum: 1, maximum: 1000000000000 }),
    reference: text(150),
  },
  { additionalProperties: false },
);

export const PartsRequest = Type.Object(
  {
    product_id: Id,
    quantity: Type.Integer({ minimum: 1, maximum: 1000 }),
    expected_on: Type.Optional(Type.String({ format: "date" })),
    note: text(2000),
  },
  { additionalProperties: false },
);

export const DeliveryReceipt = Type.Object(
  {
    line_ids: Type.Optional(
      Type.Array(Id, { minItems: 1, maxItems: 100, uniqueItems: true }),
    ),
    received_by: optionalText(150),
  },
  { additionalProperties: false },
);
export const DeliveryIncident = Type.Object(
  {
    kind: Type.Union(
      ["wrong_destination", "refused", "transit_damage"].map((v) =>
        Type.Literal(v),
      ),
    ),
    custody: text(500),
    reason: text(2000),
  },
  { additionalProperties: false },
);
export const DeliveryReview = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    status: Type.Union(["retry", "returned"].map((v) => Type.Literal(v))),
    custody: text(500),
    outcome: text(2000),
  },
  { additionalProperties: false },
);

export const StockCount = Type.Object(
  {
    product_id: Id,
    counted_quantity: Type.Integer({ minimum: 0, maximum: 10000000 }),
    reason: text(2000),
  },
  { additionalProperties: false },
);

export const QuoteDiscount = Type.Object(
  { percent: Type.Integer({ minimum: 1, maximum: 20 }), reason: text(2000) },
  { additionalProperties: false },
);

export const EngineeringSubstitute = Type.Object(
  {
    asset_id: Id,
    replacement_product_id: Id,
    compatibility_note: text(2000),
    customer_agreement: text(2000),
    unit_price_minor: Money,
  },
  { additionalProperties: false },
);

export const ChangeOrder = Type.Object(
  {
    reason: text(2000),
    lines: Type.Array(
      Type.Object(
        {
          product_id: Id,
          quantity: Type.Integer({ minimum: 1, maximum: 1000 }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 30 },
    ),
  },
  { additionalProperties: false },
);

export const TransitReplacement = Type.Object(
  { asset_id: Id, replacement_serial: text(100), note: text(2000) },
  { additionalProperties: false },
);
