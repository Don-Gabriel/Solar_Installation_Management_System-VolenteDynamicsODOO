# Five-minute demonstration

Use the seeded local workspace. All customers, phone numbers and operational records are synthetic. Keep the browser’s developer network panel available if judges ask to see persisted API calls.

The expanded workspace has **40 projects, 34 staff across eight roles and 198 device labels**. Start with Home task links and the next-step panel inside a project. Show that returning to Customers & projects preserves its search and filter. Use Barcode labels to print/copy a compatible Available device, or the optional test picker when DEMO_TOOLS=true. Open Team & access as administrator, then sign out and sign in as Arjun to demonstrate his assigned-work limits. Screen guide explains every section in plain language; the illustrated PDFs and label kit are described in [USER_GUIDE.md](USER_GUIDE.md).

1. **Overview (30 seconds):** show the lifecycle counts, crew schedule and distinction between cash and completed contribution.
2. **Sales (75 seconds):** create an enquiry. Try the quotation tab: it explains that approval is required. Record a suitable survey, approve it, generate the exact package BOM and accept it. Show the automatically created invoice, packing task and job.
3. **Warehouse (60 seconds):** record an advance or full payment. Reserve stock. Find available inverter/controller serials in Warehouse → Device serials. Scan/type them into the order. Repeat a serial to demonstrate the rejection. Dispatch; show that the passport is still empty. Confirm delivery; show locked warranty dates.
4. **Mobile installation (60 seconds):** open the installation tab at phone width. Assign a technician, start the job, upload a real test image, draw and save a signature, complete the checklist and commissioning values. Reload to demonstrate persisted evidence.
5. **Service and finances (60 seconds):** open Abdul Kareem’s covered inverter ticket and Mary Varghese’s expired ticket. Record a repair: covered customer charge is zero, expired charge becomes an itemized invoice. Both wait for customer confirmation. Show internal cost in the project report. Radhika Pillai’s deliberately expensive job demonstrates negative contribution.
6. **Technical close (15 seconds):** explain PostgreSQL row locks, immutable snapshots, server-side roles and the integration tests. Show the schema diagram and actual test report.

For the new reviewer examples, follow [the scheduling and warranty walkthrough](OPERATIONS_DEMO.md). It covers 13 busy technicians, the two available workers, fully covered replacement, parts-only cover, return custody and role boundaries.

## Useful demo identities

Coordinator: `coordinator@sunpower.local`; backup coordinator: `vishal@sunpower.local`; owner: `admin@sunpower.local`; sales: `sales@sunpower.local`; survey: `surveyor@sunpower.local`; warehouse: `warehouse@sunpower.local`; support: `support@sunpower.local`; accounts: `accounts@sunpower.local`; technician: `arjun@sunpower.local` (other technician emails use the first name).

The seed uses the local `DEMO_PASSWORD` value for these synthetic accounts. The automatic isolated Windows setup initially sets it to `SolarDemo!2026`. This is a local demo convenience; do not expose this seeded workspace to the public internet.

For an actual phone, the phone must reach the app through trusted HTTPS for camera scanning. Laptop `localhost` does not make an HTTP LAN address secure. File upload, a USB barcode scanner and manual serial entry remain available. Browser emulation is useful for layout checks but does not prove physical camera behavior.

No event submission has been made. The event’s actual submission channel, required video format and AI-use rules must be confirmed from the organizer’s instructions.
