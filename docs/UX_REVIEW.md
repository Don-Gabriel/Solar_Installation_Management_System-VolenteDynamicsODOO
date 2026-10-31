# UI and UX review - SunPower

Reviewed 31 October 2026. This combines source-code inspection, application checks, automated browser tests and primary-source research. It is not a user study. The owner's priorities were finding the next step and returning between screens.

## Design decision

Keep a small, stable workspace menu, then guide work inside each customer project. The project shows the next task based on saved records, its responsible role and a link to the relevant section. Navigation does not perform a business action.

Visual direction: deep navy #132E3B text/navigation; white #FFFFFF work surfaces; grey #F5F6F8 background; blue #2D697F current work; amber #E5AE35 attention; green #176648 success. Manrope headings and DM Sans body text use static font weights. Body text is 15px, inputs 16px, labels 14px and headings 19-32px. Status labels include words, not color alone.

The generated rooftop-team photograph provides context on sign-in. The home screen prioritizes tasks instead of a decorative banner. The image is labelled as AI-generated and is never installation evidence.

## Findings and changes

| Finding | Impact | Implemented response |
| --- | --- | --- |
| Details always opened on the first tab | Users had to remember the work stage | Next-step panel and role-appropriate default section |
| Progress strip did not navigate | No direct way to revisit a stage | Stage buttons open accessible sections without changing saved progress |
| Search/page context was lost on return | Repeated searches | URL search/filter/page and explicit return destination |
| Stock tabs/search and report period were local state | Reload/back lost context | Relevant state stored in the URL |
| Phone menu lacked modal focus behavior | Keyboard users could leave the menu | Base UI dialog, title, focus containment, Escape and close |
| Phone destinations hidden behind a menu | Repeated menu opening | Labelled bottom links with More |
| Long project tabs needed sideways discovery | Sections overlooked | Two-column section controls on narrow phones |
| Role differences difficult to demonstrate | Responsibilities unclear | Team screen, role label, expanded synthetic staff and permission tests |
| Different field types mixed together | Excess reading and typing | Fieldsets, fixed choices and optional sample-fill helpers |
| Survey defaults looked like measurements | Assumed facts could be saved | Actual measurements start blank; explicit test preset |
| Device serials required repeated copying | Slow tests | Barcode library, print PDF, Copy serial and optional serial picker |
| Small text/inconsistent variable fonts | Readability issues | Clear type scale and local static weights |
| Overflow tables not keyboard reachable | Records could not be scrolled | Focusable labelled table regions |
| Stock status mainly a number/color | Ambiguous shortages | Available / Low stock / Out of stock labels |
| Hidden menu links still allowed confusing direct URLs | Unusable forms | Client role-boundary screens; backend command checks remain authoritative |

## Form categories

- Choose: capacity/type, source, staff, roof direction, payment method, service category, subsidy status, report period and barcode filters.
- Measure/type: names, addresses, actual readings, money amounts, receipt references and unusual complaint/work notes. These cannot safely be invented from a category.
- Scan/upload: unique serials, test photos and drawn/uploaded signatures.
- App-calculated: package items, totals, balances, record numbers, event dates, coverage and contribution.
- Test helpers fill fields only, require normal save/validation and are controlled by DEMO_TOOLS=true. They do not bypass sign-in or permissions.

## Reference billing project

Read-only inspection of retail-edge-billing/retail_edge_app supplied three useful patterns: barcode print preview with readable text, explicit stock classification, and separate read/mutate permissions. Files inspected:

- lib/features/barcode_label_printing/printing/adapters/pdf_preview_label_printer_adapter.dart
- lib/features/inventory/presentation/widgets/inventory_stock_status_chip.dart
- lib/core/security/action_permission_policy.dart

The solar app adapts these ideas in React/Fastify. The reference project was not modified, and its business data was not copied. Code 128 fits the solar app's alphanumeric asset identities; retail EAN conventions were not imposed on device serials.

## Primary research

- [GOV.UK task lists](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) informs visible task order and completion. Our inference: this solar process needs a next-action guide because its steps depend on other teams.
- [Nielsen Norman Group recognition and recall](https://www.nngroup.com/articles/recognition-and-recall/) supports exposing choices instead of requiring memorized destinations or codes. Applied to labelled navigation, responsibilities and serial selection.
- [W3C grouping controls](https://www.w3.org/WAI/tutorials/forms/grouping/) supports fieldsets and legends for related inputs. Applied to customer/site, system, follow-up and survey sections.
- [GOV.UK select controls](https://design-system.service.gov.uk/components/select/) cautions against indiscriminate long dropdowns. Short familiar sets suit repeated staff tasks here; genuinely variable facts remain free text. Large future staff/product lists would benefit from searchable pickers.
- [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) documents a 24 CSS px minimum with exceptions. This app targets 44px or more for primary phone controls; that is not a blanket conformance claim.
- [Vercel interface guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) informed URL state, semantic controls, focus, image dimensions and reduced motion.

## Rehearsal tasks

1. Sales: find Priya, identify who must survey her roof, return to the filtered list.
2. Surveyor: record measurements, approve and explain why quoting is now possible.
3. Stock: choose the required Available serials, demonstrate duplicate rejection, dispatch and deliver.
4. Installer: sign in as Arjun, open assigned work and confirm another installer's project is denied.
5. Support: compare covered and expired repair charges.
6. Accounts: inspect cash versus contribution and return from a project with the period preserved.

## Limits

This is a bounded review, not proof that every usability issue is solved. No recruited-user interviews or measured completion-time study was performed. Physical-phone camera/keyboard checks and a full manual screen-reader audit remain. There is no offline write synchronization. Staff administration, refunds and government submissions are outside scope. Forms warn on browser exit; general in-app route changes are not yet guarded, so save a form before leaving it.

See VERIFICATION.md for actual passed tests. A documented control is not permission for every role to execute it.
