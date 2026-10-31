# Screen guide and barcode test pack

The application includes **Screen guide**, a searchable explanation of all available screens and project sections. Its source is `docs/screen-guide.json`; the PDF uses the same content. **Barcode labels** lets authorized staff filter, copy and print labels from the actual saved device records. **Team & access** is an administrator-only staff directory with audited role, access, skill and working-day changes.

The expanded synthetic seed contains 40 projects, 34 staff across eight roles plus two private customer accounts (15 active dispatch technicians and four historical technician identities) and 199 serialized devices. The extra seed is additive and idempotent; rerunning it does not reset used serials or completed work. Quantity-tracked panels and installation materials do not require individual device serials under this application's rules.

## Local deliverables

- `output/pdf/SunPower_Screen_Guide.pdf`: illustrated guide, choices, responsibilities, test walkthrough, design research and staff directory.
- `output/pdf/SunPower_Test_Barcodes.pdf`: printable Code 128 labels for all 199 saved devices, including their stock status at export time.
- `output/SunPower_Barcode_Test_Kit.zip`: individual PNG labels, CSV index and barcode PDF.

These generated outputs are intentionally ignored by Git. The app's barcode screen always reads current stock status. Printed labels identify devices; reprinting or rescanning does not make an allocated device available again. For a new test order choose a compatible **Available** device. Its normal scan action still checks reservations, identity, quantity and duplicates.

## Test helpers

Set `DEMO_TOOLS=true` only for the synthetic training workspace to show sample enquiry/survey presets and the available-serial picker. The example configuration defaults to false. Helpers fill fields; the user still saves through normal validation and role checks. Survey measurements start blank for real work.

## Rebuild the artifacts

With the app running at `http://127.0.0.1:3001`, seeded database and `.env` configured:

```sh
node --env-file=.env scripts/export-guide-data.mjs
node --env-file=.env scripts/capture-guide.mjs
python scripts/create-user-guide.py
python scripts/verify-guide.py
```

The capture script signs in as the demo administrator and reads screens; it does not create business transactions. It uses Playwright Chromium. The PDF scripts require Python packages `reportlab`, `pymupdf`, `Pillow` and `zxing-cpp`, and currently use Windows Arial font paths. Adjust the font registration for another OS. Generated files are local and are not automatically uploaded.

The verification script decodes all individual PNGs and all PDF labels against the exported database identities, extracts guide text, and renders contact sheets for visual review. A successful software decode does not substitute for a physical printer/scanner or phone-camera check.

See [UX review](UX_REVIEW.md) for sources, design decisions and remaining usability limitations, and [image provenance](IMAGE_ASSETS.md) for the generated asset and prompt.
