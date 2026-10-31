"""Produce the requested filename plus exactly two purpose sentences, with no introduction."""
from pathlib import Path
import subprocess,json,csv,re
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'output/pdf/SunPower_All_Files_and_Purposes.pdf'
purpose={}
def add(path,first,second):purpose[path]=[first,second]
api={
'app':'Creates the Fastify application and attaches its plugins and routes|Applies the shared request handling and security setup used by the server and tests',
'db':'Connects to PostgreSQL and provides transaction and database helpers|Keeps failed operations from leaving partial records and writes audit history',
'routes':'Defines the application API endpoints and their permitted staff roles|Validates request bodies and prevents repeated commands from creating duplicates',
'server':'Starts the HTTP server using the configured host and port|Makes the built application and its API available to browsers',
'modules/customers':'Handles customer corrections, site access notes, contact history and customer merging|Keeps issued customer details traceable and rejects stale edits',
'modules/field':'Manages installation assignment, field completion, subsidy records and crew payouts|Requires the correct worker, delivery status and completion evidence',
'modules/finance':'Handles reviewed invoice credits, replacement invoices, payment verification, reversals and refunds|Preserves original financial records and checks refundable balances',
'modules/inventory':'Receives purchases, reserves stock, assigns serials and dispatches orders|Keeps quantities and acquisition costs consistent during concurrent work',
'modules/operational-tasks':'Creates and completes operational follow-ups and maintains company holidays|Makes capacity problems, hazards, appointment changes and customer contact actionable',
'modules/queries':'Builds the read models for projects, dashboards, equipment histories and reports|Returns information appropriate to the staff member viewing it',
'modules/sales':'Handles enquiry intake, site surveys, quotations, customer acceptance and receipts|Requires survey approval and preserves the accepted commercial terms',
'modules/scheduling':'Finds available crews and manages bookings, leave, acknowledgements and overruns|Checks skills, working hours, holidays, competing assignments and travel buffers',
'modules/service-operations':'Implements repair diagnosis, component coverage, estimates, replacements and completion|Creates itemized service invoices while preserving equipment and warranty history',
'modules/service-reviews':'Handles reviewed remote support, no-fault visits and installation disputes|Requires a separate reviewer for service outcomes and preserves documented reasons',
'modules/service':'Exports the service operations used by the API and related modules|Provides a stable entry point for repair workflow functions',
'modules/staff':'Changes staff roles, access and dispatch eligibility|Audits changes and protects ongoing work from unsafe account updates',
'modules/change-orders':'Creates linked projects for additional customer work|Keeps extra items separate from the original accepted order and invoice',
'modules/delivery':'Records line receipts, delivery incidents and damaged-device replacements|Starts coverage only on received goods and blocks unresolved delivery problems',
'modules/engineering':'Records approval for an alternative replacement model|Stores compatibility checks, customer agreement and the proposed price',
'modules/order-cancellation':'Requests and reviews cancellation before an order leaves the warehouse|Credits the remaining invoice and releases reserved stock and appointments',
'modules/parts':'Records required repair parts and warehouse readiness|Prevents a confirmed return appointment while required parts remain unavailable',
'modules/quote-discounts':'Requests and reviews quotation discounts under the demo policy|Creates a new quote version instead of rewriting accepted terms',
'modules/stock-review':'Quarantines damaged serials and processes reviewed physical material counts|Preserves reservations and rejects stale counts or unauthorized approvals',
'modules/supplier-claims':'Records external equipment and manages supplier claims and recoveries|Keeps supplier reimbursement separate from customer warranty entitlement',
'plugins/auth':'Handles login, sessions, password checking and role authorization|Protects authenticated requests with session and cross-site request checks',
'plugins/files':'Validates and stores private photos and signatures|Checks ownership, deduplicates evidence and removes failed partial uploads'}
for name,text in api.items():add('apps/api/src/'+name+'.ts',*(x+'.' for x in text.split('|')))
features={
'barcodes':'Shows searchable serial labels and barcode test tools|Lets permitted staff print or select device labels for warehouse checks',
'customer-contact':'Shows customer details, shared sites and call history|Offers verified edits, site access notes, reviewed merging and enquiry cancellation',
'help':'Shows the searchable screen guide inside the application|Filters guidance to the signed-in staff member and explains available actions',
'inventory':'Shows material stock, serials, purchase receipts and warehouse work|Connects receiving, stock review and supplier claim controls',
'invoice-ledger':'Shows receipts, credits, corrections, refunds and replacement invoices|Provides the authorized finance actions for each document',
'jobs':'Lists installation jobs and their current assignment or completion status|Helps field staff open the work relevant to them',
'login':'Displays the staff sign-in form and its validation messages|Starts an authenticated session and directs staff into the application',
'operational-tasks':'Shows open exceptions, holidays and visit follow-ups|Lets permitted staff record outcomes and review acknowledgement or scheduling issues',
'overview':'Displays the home screen and operational work queues|Provides direct links to the next task across customers, stock, visits and finance',
'projects':'Displays customer projects, enquiry forms and individual project workspaces|Connects each project to its survey, quote, delivery, installation and history panels',
'repair':'Provides the repair list and complete technician repair workspace|Connects appointments, diagnosis, approval, evidence and service documents',
'reports':'Displays financial and operational reporting screens|Separates collected cash, invoiced amounts, material costs and labour costs',
'sales-panels':'Provides survey, quotation and payment panels within a project|Connects customer acceptance with finance reviews, discounts and additional work',
'schedule':'Displays crew availability, appointments, leave and scheduling controls|Shows dispatch priorities and lets coordinators confirm conflict-checked bookings',
'service-review':'Displays remote-resolution, no-fault and installation-dispute reviews|Keeps requested outcomes separate from the reviewer decision',
'service':'Exports the repair screens for application routing|Keeps the route entry separate from the larger repair implementation',
'team':'Displays staff accounts and role or availability controls|Lets administrators manage access with recorded reasons',
'work-panels':'Provides the project delivery, installation, equipment and subsidy panels|Connects staff actions to packing, field evidence and customer handover',
'delivery-exceptions':'Shows individual delivery receipts and shipment incidents|Lets staff record custody, replacements and coordinator review before another delivery',
'order-cancellation':'Shows cancellation, discount and linked additional-work controls|Explains the independent approvals and preserved original documents',
'stock-review':'Provides physical-count requests and damaged-device quarantine forms|Shows separate finance review of counted quantities',
'supplier-claims':'Provides external-equipment, parts-readiness, supplier-claim and engineering forms|Connects technicians, warehouse staff and reviewers to the corresponding service records'}
for name,text in features.items():add('apps/web/src/features/'+name+'.tsx',*(x+'.' for x in text.split('|')))
other={
'apps/web/src/app/form-safety.tsx':'Tracks unsaved form changes and recoverable browser drafts|Shows stay-or-discard navigation choices and clears saved drafts after acknowledgement',
'apps/web/src/app/layout.tsx':'Builds the desktop sidebar, mobile navigation and page shell|Shows navigation options appropriate to the signed-in role',
'apps/web/src/app/session.tsx':'Stores the current staff session in React context|Provides sign-in state, sign-out handling and role-based rendering helpers',
'apps/web/src/components/capture.tsx':'Provides barcode input and photo or signature capture controls|Uploads evidence to the authorized installation or repair record',
'apps/web/src/components/shared.tsx':'Defines common forms, panels, actions and feedback components|Keeps validation, saving and error messages consistent across screens',
'apps/web/src/lib/api.ts':'Provides browser API calls, query caching and command submission|Handles request errors, repeat-request keys and shared date or money formatting',
'apps/web/src/lib/utils.ts':'Provides shared class-name composition utilities|Allows component styles to combine without conflicting utility classes',
'apps/web/src/lib/workflow.ts':'Maps project stages and roles to understandable labels and next steps|Helps the interface guide staff toward the correct workflow action',
'apps/web/src/main.tsx':'Starts React and registers application routes and providers|Connects the session, data cache and form-safety layer to the page',
'apps/web/src/styles.css':'Defines the application colors, spacing, typography and responsive layouts|Styles operational tables, forms, navigation and printable documents',
'apps/web/src/vite-env.d.ts':'Declares the browser environment types supplied by Vite|Lets TypeScript understand the frontend build environment',
'apps/web/index.html':'Provides the browser document and React mount point|Loads the frontend entry module and basic page metadata',
'apps/web/components.json':'Records the shadcn component configuration and local import aliases|Keeps component generation aligned with the chosen UI setup',
'apps/web/vite.config.ts':'Configures the frontend build, development proxy and progressive web app assets|Controls how the browser application is bundled and served during development',
'apps/web/public/icon.svg':'Contains the application icon in scalable vector form|Supplies a recognizable visual for browser and installed web-app surfaces',
'apps/web/public/images/solar-team.png':'Contains the solar-team illustration used by the application|Adds a solar-industry visual without representing an actual customer installation',
'db/seeds/demo.ts':'Creates the base synthetic users, products, packages and customer journeys|Provides repeatable demonstration data while preserving existing operations',
'db/seeds/expanded.ts':'Adds more synthetic customers, staff accounts and serialized equipment|Makes the demonstration cover different stages and stock situations',
'db/seeds/operations.ts':'Adds the coordinator roles and fifteen-person dispatch roster|Creates busy-calendar examples used to demonstrate technician availability',
'packages/contracts/src/index.ts':'Defines shared request schemas and staff role types|Rejects malformed inputs and keeps browser and server expectations aligned',
'tests/integration/lifecycle.test.ts':'Runs database-backed API tests across the business workflows and failure cases|Checks authorization, concurrency, billing, stock, scheduling and recorded scenario outcomes',
'tests/e2e/navigation.spec.ts':'Exercises navigation, returning-customer intake and draft recovery in browsers|Checks role-specific screens and responsive navigation behavior',
'tests/e2e/repairs.spec.ts':'Exercises repair, review, scheduling and stock-count journeys through the interface|Checks saved outcomes across desktop and mobile browser configurations',
'tests/e2e/workflow.spec.ts':'Exercises the core installation journey, public enquiry and accessible screens|Verifies that browser actions produce the expected visible workflow state',
'playwright.config.ts':'Defines desktop and mobile browser test configurations and reports|Controls screenshots, traces, timeouts and the browser test output locations',
'vitest.config.ts':'Configures the API integration test runner|Provides the environment and execution settings for database-backed tests',
'Dockerfile':'Defines the container build for the application|Packages the compiled frontend and server into a runnable image',
'compose.yaml':'Defines the local container services and their connections|Provides an alternative way to run the application with PostgreSQL',
'.dockerignore':'Lists files excluded from the container build context|Keeps local dependencies, credentials and unnecessary output out of the image build',
'.gitignore':'Lists generated files, credentials and runtime folders excluded from Git|Keeps the repository focused on project-owned source and configuration',
'.gitattributes':'Defines repository text and line-ending behavior|Helps files remain consistent across Windows and other development environments',
'.env.example':'Shows the environment settings needed to configure the application|Provides placeholders rather than real local secrets',
'.env':'Stores this machine’s private application and database settings|Its values are excluded from this document and from version control',
'.github/workflows/ci.yml':'Defines the automated repository build and test workflow|Runs validation in the hosted continuous-integration environment',
'AGENTS.md':'Records project-specific instructions for coding assistants|Defines the architecture, workflow constraints and expected verification discipline',
'CLAUDE.md':'Provides compatible project guidance for Claude-based coding tools|Keeps that assistant aligned with the shared repository rules',
'README.md':'Explains the project, setup commands and main workflow|Acts as the starting point for running and understanding the repository'}
for path,text in other.items():add(path,*(x+'.' for x in text.split('|')))
docs={
'ARCHITECTURE':'Explains the application layers, database relationships and business boundaries|Helps maintainers trace how screens, API rules and persisted records fit together',
'BUILD_PLAN':'Records the implementation plan, priorities and delivery gates|Distinguishes historical schedules from the current completion requirements',
'DEMO':'Provides instructions for demonstrating the original installation workflow|Identifies the synthetic journeys and actions used in the walkthrough',
'DESIGN':'Records the interface structure and visual design decisions|Guides consistent desktop and mobile screen implementation',
'IMAGE_ASSETS':'Documents the origin and intended use of image assets|Helps maintainers distinguish generated visuals from real operational evidence',
'OPERATIONS_DEMO':'Explains the staffing, scheduling and warranty demonstration journeys|Provides concrete cases for covered repairs, mixed charges and constrained capacity',
'SCENARIO_CATALOG':'Contains the readable catalogue of real-world acceptance scenarios|Pairs each requirement with its recorded execution information',
'SKILLS':'Records installed skills and when their guidance applies|Separates assistant capabilities from application dependencies',
'TECH_STACK':'Explains the selected frontend, API, database and build technologies|Records the reasons and limitations of the responsive web architecture',
'USER_GUIDE':'Provides the text guide to application screens and available actions|Supports staff learning and the illustrated PDF guide',
'UX_REVIEW':'Records usability findings and navigation improvements|Explains how interface choices support staff tasks and mobile use',
'VERIFICATION':'Records actual tests, measurements and known limitations|Prevents unverified physical-device or native-build claims from being mistaken for completed work',
'scenarios/EXECUTION':'Summarizes the latest acceptance register and linked test evidence|Reports passed, failed and blocked cases separately',
'scenarios/PLAN':'Defines the approach to scenario execution and prioritization|Keeps high-risk business workflows and evidence requirements visible'}
for name,text in docs.items():add('docs/'+name+'.md',*(x+'.' for x in text.split('|')))
for name,first,second in [
('screen-guide.json','Stores structured descriptions of every documented screen and its options','Feeds the in-app help and generated screen guide'),
('skill-sources.json','Records the sources and revisions of installed project skills','Provides traceability for the assistant guidance used during development'),
('scenarios/F15-fixture.json','Defines the fifteen-technician scheduling demonstration fixture','Identifies busy workers and the two candidates available in the example window'),
('scenarios/catalog-source.txt','Stores the canonical two-hundred-scenario acceptance requirements','Supplies the source used to generate the catalogue and scenario PDF'),
('scenarios/catalog.json','Stores the structured scenario catalogue with its execution snapshot','Allows scripts to check scenario coverage and generate readable reports'),
('scenarios/execution.json','Stores the latest result and evidence for each scenario','Includes the tested source revision and environment for traceability'),
('scenarios/review-overrides.json','Records acceptance cases that remain blocked despite partial evidence','Prevents a narrower automated test from being presented as a complete acceptance pass')]:add('docs/'+name,first+'.',second+'.')
scripts={
'build-scenario-register.mjs':'Builds the two-hundred-case execution register from test results|Applies explicit limitations and records the committed application revision',
'capture-guide.mjs':'Captures screen-guide images from the running local application|Uses browser automation to visit the documented desktop and mobile views',
'check-backup-restore.ts':'Backs up the application database and verifies a disposable restore|Compares persisted records, financial totals and private evidence bytes',
'create-scenario-document.py':'Builds the scenario catalogue, CSV register and scenario PDF|Keeps acceptance requirements separate from the actual execution evidence',
'create-scheduling-fixture.mjs':'Generates the structured fifteen-technician planning fixture|Makes the busy-worker demonstration repeatable and inspectable',
'create-user-guide.py':'Builds the illustrated screen guide and printable barcode PDF|Exports individual barcode images, their index and the downloadable test kit',
'export-guide-data.mjs':'Exports synthetic staff, projects and serial records for documentation|Supplies current demonstration data to the guide and barcode generators',
'local-database.mjs':'Sets up and manages a dedicated local development PostgreSQL instance|Keeps the project database separate from other installed database services',
'migrate.ts':'Applies ordered SQL migrations and tracks their recorded checksums|Detects changed migration history and avoids applying a migration twice',
'probe-review-scenarios.ts':'Replays the focused scenarios raised during the review|Produces direct evidence for the original operational failures and fixes',
'seed-service-rehearsal.ts':'Creates guarded synthetic service cases for a live demonstration|Prepares covered and mixed-charge repairs without treating sample photos as real evidence',
'test-e2e.mjs':'Creates an isolated database schema and server for browser tests|Seeds synthetic data, runs the selected browsers and removes the disposable schema',
'training-workspace.mjs':'Creates or resets an explicitly named isolated training dataset|Checks its marker before reset and leaves operational data outside that dataset unchanged',
'verify-guide.py':'Checks generated barcode images and PDF labels by decoding them|Renders guide contact sheets and checks readable extracted text',
'verify-scenario-document.py':'Checks scenario counts, fixture staffing and PDF text boundaries|Renders review pages and confirms that all scenario identifiers appear',
'create-file-inventory.py':'Builds the filename-and-purpose PDF requested for this project|Checks that each included file has exactly two purpose sentences'}
for name,text in scripts.items():add('scripts/'+name,*(x+'.' for x in text.split('|')))
# Each migration is an ordered, versioned change rather than a runtime reset.
migration_topics=['core business records','data integrity and immutable accepted terms','service visits, repair diagnosis and returns','separate labour warranty coverage','installation crews','diagnosis revision history','individual crew payments','linked follow-up requests','service callout charges','operational tasks and holidays','financial corrections and settlement','customer intake, contact history and document snapshots','component-linked and deduplicated evidence','reviewed service outcomes and installation disputes','external equipment and supplier recoveries','repair parts readiness','individual delivery receipts and incidents','damaged stock and physical-count reviews','reviewed order cancellation','reviewed quotation discounts','engineering-approved replacement models','linked change orders','transit-damage replacement records','private customer accounts and in-app notifications']
for p in sorted((ROOT/'db/migrations').glob('*.sql')):
 topic=migration_topics[int(p.name[:3])-1];add(p.relative_to(ROOT).as_posix(),f'Adds database support for {topic}.','Runs in sequence through the migration tool and preserves the existing migration history.')
for p in (ROOT/'apps/web/src/components/ui').glob('*.tsx'):
 label=p.stem.replace('-',' ');add(p.relative_to(ROOT).as_posix(),f'Defines the shared {label} interface component.','Provides consistent styling and interaction behavior wherever the application uses it.')
files=set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines())
files={f for f in files if (ROOT/f).is_file()}
if (ROOT/'.env').exists():files.add('.env')
for f in files:
 if f.endswith('package.json'):
  scope={'package.json':'workspace','apps/api/package.json':'API server','apps/web/package.json':'browser application','packages/contracts/package.json':'shared request contracts'}[f]
  add(f,f'Declares the {scope} package and its dependencies.','Defines the package commands or exports used by the build and development tools.')
 elif f.endswith('tsconfig.json'):add(f,'Configures TypeScript compilation for this directory and its source files.','Defines the language checks and module settings inherited or used by the build.')
 elif f=='package-lock.json':add(f,'Pins the exact installed dependency versions for the workspace.','Makes installation repeatable across development and continuous-integration environments.')
final={
'output/pdf/SunPower_All_Files_and_Purposes.pdf':'Lists every included project file and its purpose in two sentences|Provides the requested file-by-file reference without an introduction',
'output/pdf/SunPower_Real_World_Scenarios.pdf':'Contains the two-hundred-scenario acceptance document and execution information|Explains the business situations and distinguishes verified results from remaining limitations',
'output/pdf/SunPower_Screen_Guide.pdf':'Explains each application screen with images and available actions|Helps staff understand the workflows and their role-specific options',
'output/pdf/SunPower_Test_Barcodes.pdf':'Contains printable labels for the synthetic serialized equipment|Lets testers scan existing demo serials without typing each value',
'output/SunPower_Barcode_Test_Kit.zip':'Packages the printable barcode PDF, serial index and individual barcode images|Provides the complete barcode testing kit in one download',
'output/SunPower_Scenario_Test_Register.csv':'Lists every scenario with its requirement, result and evidence|Supports filtering and reviewing the acceptance results in a spreadsheet',
'output/barcodes/serial-index.csv':'Maps each generated barcode serial to its product and exported stock status|Helps testers select the appropriate device and compare it with the live application',
'output/social/SunPower_Hackathon_Post.png':'Contains the generated hackathon social-post artwork|Uses the application scheduling screen with the solo-builder story',
'output/social/Hackathon_Post_Captions.txt':'Stores the initial LinkedIn and Instagram captions and image alternative text|Provides an editable local copy of the first social-post draft',
'output/social/Visual_Prompt.txt':'Records the generation prompt and reference used for the social artwork|Allows the visual concept to be reproduced or revised'}
for f,text in final.items():
 if (ROOT/f).exists() or f==OUT.relative_to(ROOT).as_posix():files.add(f);add(f,*(x+'.' for x in text.split('|')))
for p in sorted((ROOT/'output/barcodes/png').glob('*.png')):
 f=p.relative_to(ROOT).as_posix();files.add(f);add(f,f'Contains the scannable label for demo serial {p.stem}.','Use this image to test that specific device; current allocation and warranty status must be checked in the live app.')
add('apps/api/src/modules/customer-portal.ts','Serves customer-owned systems, visits, repairs, invoices and inbox messages.','Enforces customer identity and prevents reading or marking another customer’s messages.')
add('apps/web/src/features/customer-portal.tsx','Displays the private customer service portal and automatically refreshes its inbox.','Shows appointments, repair status and bills while keeping staff controls outside the customer view.')
add('db/seeds/customer-portal.ts','Creates two synthetic customer logins linked to existing demo customer records.','Preserves existing accounts and adds an explicitly labelled welcome message.')
add('scripts/seed-customer-portal.ts','Adds the customer portal demo accounts to an existing demonstration database.','Requires demo mode and hashes the configured password before creating accounts.')
add('tests/e2e/customer-portal.spec.ts','Tests customer login, private views, inbox interaction and account switching in browsers.','Checks accessibility and horizontal layout on the configured desktop and phone viewports.')
add('docs/MANUAL_CHECKS.md','Gives step-by-step instructions for the six remaining acceptance gates and customer notification demo.','Separates physical-device checks from native installers that have not been built.')
add('apps/web/src/app/app-update.tsx','Detects newer offline app versions and shows a visible reload notice.','Lets the user save unfinished work before loading the updated interface.')
missing=sorted(files-purpose.keys());assert not missing,missing
for f in files:
 assert len(purpose[f])==2 and all(s.endswith('.') for s in purpose[f]),f
pdfmetrics.registerFont(TTFont('Inventory','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('InventoryBold','C:/Windows/Fonts/arialbd.ttf'))
nameStyle=ParagraphStyle('File',fontName='InventoryBold',fontSize=9.5,leading=12,textColor=colors.HexColor('#143543'),spaceAfter=4,splitLongWords=True)
bodyStyle=ParagraphStyle('Purpose',fontName='Inventory',fontSize=9.5,leading=13,spaceAfter=0)
story=[]
for f in sorted(files):story.append(KeepTogether([Paragraph(escape(f),nameStyle),Paragraph(escape(' '.join(purpose[f])),bodyStyle),Spacer(1,13)]))
def footer(c,d):c.setFont('Inventory',8);c.setFillColor(colors.HexColor('#526875'));c.drawRightString(A4[0]-38,20,str(d.page))
OUT.parent.mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(str(OUT),pagesize=A4,leftMargin=38,rightMargin=38,topMargin=36,bottomMargin=36,title='Project files and purposes').build(story,onFirstPage=footer,onLaterPages=footer)
doc=pymupdf.open(OUT);text='\n'.join(p.get_text() for p in doc)
for f in files:assert re.sub(r'\s','',f) in re.sub(r'\s','',text),f
for page in doc:
 for word in page.get_text('words'):assert word[0]>=36 and word[2]<=page.rect.width-35 and word[1]>=18 and word[3]<=page.rect.height-15,(page.number,word)
(ROOT/'output/file-inventory.json').write_text(json.dumps({'count':len(files),'files':[{'file':f,'sentences':purpose[f]} for f in sorted(files)]},indent=2),encoding='utf-8')
print(json.dumps({'files':len(files),'pages':len(doc),'pdf':str(OUT),'all_names_verified':True,'sentences_per_file':2}))
