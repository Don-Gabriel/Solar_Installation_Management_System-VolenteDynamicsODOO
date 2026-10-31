# Solar Installation Management System

A responsive operations application for a rooftop solar company, from first enquiry to installation, warranty service and job profitability.

Repository: [Don-Gabriel/Solar_Installation_Management_System-VolenteDynamicsODOO](https://github.com/Don-Gabriel/Solar_Installation_Management_System-VolenteDynamicsODOO)

## Current status

Requirements analysis, skill setup and the revised build plan are complete. Application implementation has not started. The repository was empty when inspected on 31 October 2026; this initial commit establishes its implementation contract.

The submission deadline supplied by the owner is **1 November 2026 at 09:00 IST (Asia/Kolkata)**. This is a solo entry.

## Product workflow

Enquiry → qualification → approved roof survey → itemized quotation → accepted order and payment → reserved stock → scanned dispatch → delivery and warranty activation → installation evidence and customer sign-off → service and job reporting.

The key demonstration is an **asset passport**: trace an inverter serial through its purchase, customer, delivery, warranty, installation evidence and repairs.

## Selected stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, React Router |
| UI | Tailwind CSS 4, shadcn/ui, Lucide icons |
| Forms and data | React Hook Form, TanStack Query, shared TypeBox schemas |
| Backend | Node.js 24, Fastify 5, REST/OpenAPI |
| Database | PostgreSQL 18, node-postgres, versioned SQL migrations |
| Access | Local accounts, hashed passwords, PostgreSQL-backed sessions and server-side roles |
| Field tools | Camera/file uploads, ZXing barcode scanning with manual fallback, signature_pad |
| Delivery | Responsive web app with a lightweight PWA shell; Docker Compose |
| Tests | Vitest, API integration tests using PostgreSQL, Playwright |

Exact dependencies will be locked and tested during scaffolding. These are selected technologies, not a claim that the application is already installed or running.

## Desktop and mobile

- Desktop: keyboard-accessible navigation, searchable tables, project detail panels and finance views.
- Mobile: single-column forms, large touch controls, photo capture, signatures and focused assigned-job views.
- One backend and shared records across devices; no separate native app is needed for the hackathon.
- Camera scanning and PWA installation require the appropriate HTTPS/browser setup. Basic file upload and manual serial entry remain available.

## Project documents

- [Build plan and acceptance gates](docs/BUILD_PLAN.md)
- [Technology decisions and compatibility](docs/TECH_STACK.md)
- [Installed skills and their intended use](docs/SKILLS.md)
- [Pinned upstream skill sources](docs/skill-sources.json)
- [Codex and Claude working instructions](AGENTS.md)

Local PDFs, machine-specific inventories, credentials and generated research previews are excluded from Git.
