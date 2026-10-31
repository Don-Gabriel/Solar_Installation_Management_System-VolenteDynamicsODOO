import { writeFile } from "node:fs/promises";
const people = [];
const add = (id, name, role, skills = []) =>
  people.push({
    id,
    name,
    email: `${id.toLowerCase()}@scenario.sunpower.local`,
    role,
    skills,
    active: true,
  });
add("OFF01", "Anil Menon", "admin");
add("OFF02", "Asha Nair", "sales");
add("OFF03", "Rohit Joseph", "sales");
add("OFF04", "Vikram Menon", "surveyor", ["survey"]);
add("OFF05", "Fathima Ali", "surveyor", ["survey"]);
add("OFF06", "Meera Shah", "support");
add("OFF07", "Anita Das", "support");
add("OFF08", "Isha Raman", "coordinator");
add("OFF09", "Vishal Nair", "coordinator");
add("OFF10", "Ravi Kumar", "warehouse");
add("OFF11", "George Paul", "warehouse");
add("OFF12", "Neha Rao", "accounts");
const names = [
  "Arjun Nair",
  "Dev Patel",
  "Kiran Das",
  "Rahul Menon",
  "Akash Jain",
  "Ishaan Shah",
  "Nikhil Rao",
  "Om Sharma",
  "Pranav Iyer",
  "Sanjay Rao",
  "Tariq Khan",
  "Uday Menon",
  "Zubin Ali",
  "Varun Das",
  "Yash Shah",
];
names.forEach((name, i) =>
  add(
    `T${String(i + 1).padStart(2, "0")}`,
    name,
    "technician",
    i === 11 || i === 12
      ? ["supervised_assistant"]
      : i < 4
        ? ["installation", "inverter_repair", "battery_repair", "crew_lead"]
        : ["installation", "inverter_repair"],
  ),
);
const dates = ["2026-11-05", "2026-11-06", "2026-11-07"];
const blocks = dates.flatMap((date) =>
  people
    .filter((p) => p.role === "technician")
    .slice(0, 13)
    .map((p, i) => ({
      id: `BUSY-${date}-${p.id}`,
      technician_id: p.id,
      start: `${date}T09:00:00+05:30`,
      end: `${date}T17:00:00+05:30`,
      kind: i % 2 ? "installation" : "repair",
      customer_reference: `SYNTHETIC-${i + 1}`,
    })),
);
const fixture = {
  name: "F15",
  status: "Specification only; not imported into the current application",
  timezone: "Asia/Kolkata",
  clock: "2026-11-02T09:00:00+05:30",
  people,
  calendar: {
    working_dates: dates,
    working_hours: ["09:00", "17:00"],
    travel_buffer_minutes: 30,
    routine_window_days: [3, 5],
    window_basis:
      "calendar days; these three fixture dates are explicitly working days",
  },
  busy_blocks: blocks,
  request: {
    id: "CALL-F15",
    received_at: "2026-11-02T09:00:00+05:30",
    duration_minutes: 120,
    required_skill: "inverter_repair",
    preferred_start_time: "10:00",
    crew_size: 1,
  },
  expected: {
    eligible_technicians: ["T14", "T15"],
    race_same_slot_success_count: 1,
    two_person_crew_all_or_nothing: true,
  },
  variants: [
    {
      name: "T14 on leave",
      leave: [{ technician_id: "T14", dates }],
      expected_eligible: ["T15"],
    },
    {
      name: "Both absent",
      leave: [
        { technician_id: "T14", dates },
        { technician_id: "T15", dates },
      ],
      expected_eligible: [],
    },
    {
      name: "Two-person crew",
      crew_size: 2,
      required_members: ["T14", "T15"],
      expected: "Reserve both atomically or neither",
    },
  ],
};
if (
  people.length !== 27 ||
  people.filter((p) => p.role === "technician").length !== 15 ||
  new Set(people.map((p) => p.id)).size !== 27 ||
  blocks.length !== 39
)
  throw new Error("Invalid staffing fixture");
await writeFile(
  "docs/scenarios/F15-fixture.json",
  JSON.stringify(fixture, null, 2) + "\n",
);
console.log(
  "Created specification fixture: 27 named staff, 8 roles, 15 technicians, 39 busy intervals. No application records changed.",
);
