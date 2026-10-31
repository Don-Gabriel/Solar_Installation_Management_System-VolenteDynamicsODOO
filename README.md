# SunPower · Solar Installation Management

A working responsive operations application for a rooftop solar company. Enquiries, approved surveys, itemized quotations, payments, serialized inventory, delivery-based warranties, installation evidence, repairs and financial reporting share one PostgreSQL database.

Built for a solo hackathon entry due **1 November 2026, 09:00 IST**. All seeded customers and records are synthetic.

## Start locally

Prerequisites: **Node.js 24**, npm, **PostgreSQL 18**. On Windows the helper expects PostgreSQL binaries at `C:/Program Files/PostgreSQL/18/bin`; override `PG_BIN` for a different installation. On Linux its default is `/usr/lib/postgresql/18/bin`; initialization must run as an ordinary user.

```sh
npm ci
npm run db:local
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Open **http://127.0.0.1:3001**. The helper creates a dedicated database cluster in `data/postgres`, listening only on `127.0.0.1:55432`, with a random database password in ignored `.env`. It does not modify another PostgreSQL installation's data. Run `npm run db:local` again after restarting the computer. Do not copy `.env.example` before automatic setup: the helper refuses to overwrite an existing `.env`.

To use an existing local database instead, copy `.env.example` to `.env`, set `DATABASE_URL` and `DEMO_PASSWORD`, and skip `db:local`. Migrations and demo seeding are repeatable; seeding does not reset an existing demo. Changing `DEMO_PASSWORD` afterward does not change existing account hashes.

Automatic local demo login: **admin@sunpower.local / SolarDemo!2026**. Other roles and the presentation script are in [DEMO.md](docs/DEMO.md). These credentials are for the synthetic local demo.

For development, run `npm run dev` and open http://127.0.0.1:5173. The frontend proxies API requests to port 3001. Stop `npm start` before starting the development backend on that same port.

## What works

- Sales pipeline, survey qualification and approval, 15 package recipes across 1–5 kW, immutable accepted quotation snapshots and itemized invoices.
- Payment recording, advance gate, stock receipts and costs, atomic reservations, mandatory device serial scans and delivery confirmation.
- Asset passports, warranties beginning at delivery, replacement serial traceability and inherited warranty dates.
- Technician assignment with overlap checks, installation checklist, commissioning values, private photos, drawn/uploaded signature and handover.
- Covered and expired repairs, separate internal repair cost and customer charge, customer confirmation and service invoices.
- Cash, outstanding invoices, completed-job contribution, loss-making projects, technician payable records, subsidy checklist, CSV export and printing.
- Server-side roles, session cookies, CSRF protection, request validation, retry-safe commands, audit events and private image access.
- Responsive desktop/phone layouts and a lightweight PWA shell. Private API responses are not cached for offline use.

## Stack

| Layer | Implementation |
| --- | --- |
| Client | React 19, TypeScript, Vite 8, React Router |
| UI | Tailwind 4, shadcn/Base UI, Lucide, local fonts |
| Forms/data | React Hook Form, TanStack Query, TypeBox |
| Server | Node 24, Fastify 5, REST/OpenAPI, Argon2 sessions |
| Persistence | PostgreSQL 18, node-postgres, versioned SQL migrations |
| Field tools | ZXing camera/manual scanning, signature_pad, sharp image validation |
| Verification | Vitest with real PostgreSQL, Playwright, axe accessibility checks |

Dependencies are locked in `package-lock.json`. OpenAPI is available to the signed-in owner at `/api/docs`.

## Verification

```sh
npm run typecheck
npm test
npx playwright install chromium webkit firefox
npm run test:e2e
```

Integration and browser tests create temporary, uniquely named schemas in the configured database, seed them and remove them afterward. They require a PostgreSQL account allowed to create schemas. They do not reset the demo's public schema. Browser reports are written under `output/`.

For the Windows machine where Playwright Firefox currently fails to launch:

```sh
npm run build
node scripts/test-e2e.mjs --project=chromium --project=webkit
```

See [VERIFICATION.md](docs/VERIFICATION.md) for actual results and limitations.

## Optional Docker packaging

Create an ignored `.env.compose` containing `POSTGRES_PASSWORD` and `DEMO_PASSWORD`, then run:

```sh
docker compose --env-file .env.compose up --build -d
```

The app uses port 3001 on loopback; stop a local server using that port first. Database and evidence have separate named volumes. See verification notes for packaging test status. Back up **both** database and evidence before moving or deleting volumes.

## Scope and demo policies

This release uses a 30% advance gate, 8 m²/kW roof requirement, 24-month serialized-device warranty and 240-month panel warranty. Replacements inherit original coverage. These are documented demo policies, not asserted manufacturer terms. Tax is unconfigured and subsidies are tracking only.

One lead technician is assigned per installation. Full payroll, tax filing, payment gateways, credit notes/cancellations, multi-company support, catalogue/account administration screens and offline transaction synchronization are outside this release. Contribution subtracts recorded materials, installation labour and service costs; it is not company net profit. See [ARCHITECTURE.md](docs/ARCHITECTURE.md).

Actual phone camera scanning requires reachable trusted HTTPS; laptop localhost does not secure a plain HTTP LAN URL. Manual serial entry and file upload are available. Physical phone hardware has not been verified.

## Project documentation

- [Screen guide, barcode pack and test helpers](docs/USER_GUIDE.md)
- [UI/UX research and implemented improvements](docs/UX_REVIEW.md)
- [Build plan and current status](docs/BUILD_PLAN.md)
- [Architecture, schema and policies](docs/ARCHITECTURE.md)
- [Technology decisions](docs/TECH_STACK.md)
- [Five-minute demonstration](docs/DEMO.md)
- [Verification evidence](docs/VERIFICATION.md)
- [Skills used](docs/SKILLS.md)

Local PDFs, credentials, database files, uploads, test output and machine-specific research are excluded from Git. No hackathon submission or public deployment is implied by this repository.
