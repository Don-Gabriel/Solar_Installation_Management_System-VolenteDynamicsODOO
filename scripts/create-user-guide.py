"""Build illustrated user guide and vector Code 128 label pack from exported demo records."""
import csv, json, math, zipfile, re
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfgen.canvas import Canvas
from reportlab.graphics.barcode import code128
from reportlab.platypus.tableofcontents import TableOfContents
import pymupdf

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
DATA=json.loads((ROOT/'output/guide-data/demo.json').read_text(encoding='utf-8-sig'))
SCREENS=json.loads((ROOT/'docs/screen-guide.json').read_text(encoding='utf-8-sig'))
SHOTS=ROOT/'output/guide-screens'
pdfmetrics.registerFont(TTFont('Guide','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('GuideBold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold',italic='Guide',boldItalic='GuideBold')
NAVY=colors.HexColor('#132E3B'); BLUE=colors.HexColor('#2D697F'); PALE=colors.HexColor('#EEF5F8'); GREY=colors.HexColor('#526875')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='Body',fontName='Guide',fontSize=10,leading=14,textColor=NAVY,spaceAfter=7))
styles.add(ParagraphStyle(name='SmallGuide',parent=styles['Body'],fontSize=8.5,leading=11.5))
styles.add(ParagraphStyle(name='GuideTitle',fontName='GuideBold',fontSize=27,leading=32,textColor=NAVY,spaceAfter=18))
styles.add(ParagraphStyle(name='ScreenTitle',fontName='GuideBold',fontSize=22,leading=27,textColor=NAVY,spaceAfter=10))
styles.add(ParagraphStyle(name='SectionGuide',fontName='GuideBold',fontSize=12,leading=16,textColor=BLUE,spaceBefore=7,spaceAfter=6))
styles.add(ParagraphStyle(name='MetaGuide',parent=styles['Body'],fontSize=9,leading=12,textColor=GREY))
def clean(s): return str(s).replace('–','-').replace('—','-').replace('→',' > ').replace('‑','-')
def p(s,style='Body'): return Paragraph(escape(clean(s)),styles[style])
def rich(s,style='Body'): return Paragraph(s,styles[style])
def bullets(lines,style='SmallGuide'): return [p('- '+s,style) for s in lines]
def footer(canvas,doc):
 canvas.saveState();canvas.setStrokeColor(colors.HexColor('#D7E3E9'));canvas.line(36,35,A4[0]-36,35);canvas.setFillColor(GREY);canvas.setFont('Guide',8);canvas.drawString(36,23,'SUNPOWER  |  Simple screen guide  |  Synthetic demonstration data');canvas.drawRightString(A4[0]-36,23,str(doc.page));canvas.restoreState()
class GuideDoc(SimpleDocTemplate):
 def afterFlowable(self,flowable):
  if isinstance(flowable,Paragraph) and flowable.style.name=='ScreenTitle':
   text=flowable.getPlainText();key='section-'+re.sub('[^a-z0-9]+','-',text.lower());self.canv.bookmarkPage(key);self.canv.addOutlineEntry(text,key,0,False);self.notify('TOCEntry',(0,text,self.page,key))
def title(text): return p(text,'ScreenTitle')
story=[Spacer(1,18),p('SunPower','GuideTitle'),p('Screen guide & testing handbook','ScreenTitle'),p('Every screen explained in simple words. Includes available options, field categories, staff roles, test routes and the design review.'),Spacer(1,12)]
photo=ROOT/'apps/web/public/images/solar-team.png'
if photo.exists():story+=[Image(str(photo),width=510,height=340),p('AI-generated illustration. It is not customer installation evidence.','MetaGuide')]
story += [Spacer(1,20),p('40 customer projects  |  32 staff accounts  |  198 device barcodes','SectionGuide'),p('Prepared 31 October 2026. The app uses a real local PostgreSQL database. All demo names, addresses and records are synthetic.'),p('Open http://127.0.0.1:3001 on the computer running the app. Barcode labels are supplied as a separate printable PDF.'),PageBreak()]
story += [title('Contents'),p('Use the PDF bookmarks or the contents below. The app also has a Screen guide menu item.')]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle(name='TocGuide',fontName='Guide',fontSize=10,leading=17,textColor=NAVY,leftIndent=0,firstLineIndent=0)];story += [toc,PageBreak()]
story += [title('The journey in plain language'),p('Enquiry > site survey > approved quote > customer acceptance > payment > packing > delivery > installation > repairs and reporting.','SectionGuide')]
for a,b in [('Before a quote','A suitable site survey must be approved.'),('Before packing','The required advance must be recorded and stock must be available.'),('Before sending equipment','Every required serialized inverter, battery and controller must be scanned.'),('At delivery','Warranties start. Repeating delivery does not restart them.'),('At installation','An assigned installer saves a photo, signature, safety checks and readings.'),('If a repair is needed','Coverage determines the customer charge. Internal costs remain recorded.'),('When reviewing money','Cash received and completed-job contribution are different figures.')]:story += [p(a,'SectionGuide'),p(b)]
story += [p('Navigation tip','SectionGuide'),p('The next-step box explains the current task and responsible team. Go to this step opens the right section. It never approves, pays or dispatches anything. Back to project list keeps your previous search; other project links return to their source screen.'),PageBreak()]
roles={'admin':'Administrator','sales':'Sales','surveyor':'Site surveyor','warehouse':'Stock team','technician':'Installer','support':'Customer support','accounts':'Accounts','public':'Visitor'}
rolejobs={'admin':'Full workflow, assignment, approvals, team and money reports.','sales':'Customers, quotes, acceptance, payments and subsidy tracking.','surveyor':'Record and approve/reject surveys; view relevant job information.','warehouse':'Receive, reserve, scan, dispatch, deliver and print device labels.','technician':'Only assigned projects: start, evidence and handover.','support':'Warranty lookup, repair/replacement and customer confirmation.','accounts':'Payments, repair charges, subsidy, job costs and staff payables.'}
story += [title('Who can do what?'),p('RBAC means role-based access control: your account determines which actions are allowed. The server checks permissions even if someone types an API address directly.')]
rows=[[p('Role','SectionGuide'),p('Main responsibility','SectionGuide'),p('Demo sign-in','SectionGuide')]]
for role in rolejobs:rows.append([p(roles[role]),p(rolejobs[role]),p(('arjun' if role=='technician' else role)+'@sunpower.local','SmallGuide')])
t=Table(rows,colWidths=[92,258,165]);t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),PALE),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#D7E3E9')),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story += [t,Spacer(1,14),p('For this local synthetic workspace, use the configured DEMO_PASSWORD. The automatic setup default is SolarDemo!2026. A different setup may use a different value. Sign out before testing another staff account.'),p('Customers use the public enquiry form; they are not staff users. Team & access is an administrator-only directory, not a role-editing or password-changing tool.'),PageBreak()]
story += [title('Less typing, clearer fields')]
for h,text in [('Choose from a list','Use choices for system size/type, source, compass direction, staff member, payment method, problem category, subsidy status and report period.'),('Measure or type the real value','Names, site addresses, actual measurements, costs, references and unusual repair notes remain manual. The app should not guess these facts.'),('Scan or attach evidence','Use the barcode label or serial picker for device identity. Choose a photo and draw or upload a PNG signature for handover.'),('Filled by the app','Package items, prices, totals, balances, record numbers, event dates and warranty dates are calculated or copied from saved records.'),('Optional test helpers','DEMO_TOOLS=true enables Fill sample enquiry, Fill sample survey and an available-device picker. These fill fields only. Review them and use the normal save/check action. Set DEMO_TOOLS=false outside a training workspace.'),('Required versus optional','An asterisk marks required fields. Empty optional choices are allowed. Survey measurements begin blank; the sample preset is explicitly synthetic.'),('Error recovery','Read the message, correct the fields and retry. Saved actions use retry protection. Do not repeatedly invent a new receipt reference to force a duplicate payment through.')]:story += [p(h,'SectionGuide'),p(text)]
story += [PageBreak()]
for s in SCREENS:
 story += [title(s['title']),p('Where: '+s['path']+'   |   Roles: '+', '.join(roles.get(r,r) for r in s['roles']),'MetaGuide'),p(s['purpose'])]
 img=SHOTS/(s['id']+'.png')
 if img.exists():
  with pymupdf.open(img) as im: w,h=im[0].rect.width,im[0].rect.height
  width=min(480,280*w/h);story += [Image(str(img),width=width,height=width*h/w),Spacer(1,9)]
 cols=[[p('Available options','SectionGuide'),*bullets(s['options'])],[p('Fields and choices','SectionGuide'),*bullets(s['fields'])]]
 table=Table([[cols[0],cols[1]]],colWidths=[257,257]);table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),0)]));story += [table,Spacer(1,7),p('What happens next','SectionGuide'),p(s['next'],'SmallGuide'),PageBreak()]
story += [title('Quick testing plan')]
for h,b in [('Sales and survey','Sign in as sales, create an enquiry or use a synthetic project. Open its next step. Sign in as surveyor, save real test measurements or the labelled sample preset, then approve. Sales can now generate and accept the quotation.'),('Stock and barcodes','Record the advance, then sign in as stock staff. Reserve equipment, open Barcode labels and filter Available plus the required product. Scan or copy the serial. Alternatively use the local test picker. Repeat a serial once to prove rejection. Dispatch, then confirm delivery.'),('Installation','The administrator assigns an installer and time. Sign in as that installer, start the job, save a real test image and a test signature, complete the checklist and hand over. Reload and confirm both images remain.'),('Service and money','Use Abdul Kareem for covered service and Mary Varghese for expired coverage. Record repairs and customer confirmation. Accounts can see customer charges, internal costs and separate cash totals.'),('A useful permission test','As an installer, try /reports or /team. The screen should explain that the role cannot open it. The corresponding protected API must also reject the request. Another installer\'s project is not accessible.'),('More test runs','Use another Available serial or add a new synthetic stock receipt with new unique serials. A used serial cannot be made available by printing its label again. Rerunning the seed does not erase your existing work.')]:story += [p(h,'SectionGuide'),p(b)]
story += [PageBreak(),title('Design review: what changed')]
findings=[('Next step was unclear','A project now says what to do next, why, and which team is responsible.'),('Returning meant searching again','Project search, filters and page are in the URL. Return links keep that context.'),('The phone menu was too hidden','Labelled bottom navigation exposes common destinations. More opens an accessible modal menu.'),('Project sections needed sideways discovery','Phone project sections use a two-column layout, with clickable stage navigation.'),('Too much free typing','Related fields are grouped. Fixed categories use choices. Barcode copying/scanning and explicit test presets reduce repetition.'),('Roles were difficult to show','The team directory and expanded data make responsibilities visible; actual permissions remain enforced by the server.'),('Readability needed consistency','Static-weight fonts, larger inputs, visible status text and a restrained navy/blue palette improve clarity.'),('Decorative home artwork competed with work','The home screen prioritizes work shortcuts. A generated, clearly labelled solar photograph appears on sign-in.')]
for a,b in findings:story += [p(a,'SectionGuide'),p(b)]
story += [PageBreak(),title('Research and review boundaries'),p('This work combines source-code inspection, primary-source desk research, browser walkthroughs and automated checks. It does not claim recruited user interviews, a usability study or complete WCAG certification.')]
sources=[('GOV.UK task lists','https://design-system.service.gov.uk/patterns/complete-multiple-tasks/','Visible task order and completion; adapted here to cross-team handoffs.'),('Nielsen Norman Group: recognition and recall','https://www.nngroup.com/articles/recognition-and-recall/','Visible choices reduce reliance on remembered destinations and codes.'),('W3C: grouping form controls','https://www.w3.org/WAI/tutorials/forms/grouping/','Fieldsets and legends give related controls a meaningful group.'),('GOV.UK: select controls','https://design-system.service.gov.uk/components/select/','Avoid treating every free-text field as a long dropdown. Match controls to the data.'),('W3C: target size','https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum','Minimum target-size rules have exceptions. Primary phone controls here aim for 44px or more.'),('Vercel interface guidelines','https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md','URL state, labelled controls, focus, image dimensions and reduced motion.')]
for a,url,b in sources:story += [rich('<b>'+escape(a)+'</b>','Body'),p(b),rich('<link href="'+url+'" color="#2D697F">'+escape(url)+'</link>','SmallGuide')]
story += [Spacer(1,10),p('Reference software','SectionGuide'),p('The Rajasingh billing project was inspected read-only for label printing, explicit stock status and separate view/edit permissions. These ideas were adapted to this app; its business records were not copied.'),p('Remaining checks','SectionGuide'),p('Physical-phone camera behavior and a complete manual screen-reader review remain unverified. Offline writes, full payroll, refunds, staff administration and government submission are outside this build. See the repository verification record for exact test coverage.'),PageBreak(),title('Synthetic staff directory')]
rows=[[p('Name','SmallGuide'),p('Role','SmallGuide'),p('Email','SmallGuide')]]+[[p(u['name'],'SmallGuide'),p(roles[u['role']],'SmallGuide'),p(u['email'],'SmallGuide')] for u in DATA['users']]
t=Table(rows,colWidths=[155,135,225],repeatRows=1);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#D7E3E9')),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]));story += [p('All accounts below are synthetic. Each uses the configured demo password. There are two administrators and 19 installers.'),t]
guide=OUT/'SunPower_Screen_Guide.pdf'
GuideDoc(str(guide),pagesize=A4,rightMargin=36,leftMargin=36,topMargin=35,bottomMargin=48,title='SunPower Screen Guide',author='SunPower Project').multiBuild(story,onFirstPage=footer,onLaterPages=footer)

labels=OUT/'SunPower_Test_Barcodes.pdf'; c=Canvas(str(labels),pagesize=A4);c.setTitle('SunPower Test Barcode Pack'); W,H=A4
def label_footer(page):
 c.setFillColor(GREY);c.setFont('Guide',8);c.drawString(30,20,'Synthetic device labels | Code 128 | Print at 100% | Snapshot: 31 October 2026');c.drawRightString(W-30,20,str(page))
c.setFillColor(NAVY);c.setFont('GuideBold',28);c.drawString(36,H-65,'SunPower');c.setFont('GuideBold',21);c.drawString(36,H-100,'Test barcode pack')
y=H-145
cover=[f"{len(DATA['assets'])} unique labels for the devices currently saved in the database.",'Use these for manual scanning, camera scanning, clipboard entry and printed test sheets.','Each label contains the exact device serial, product and status at export time.','1. Open Stock & deliveries and select a packing project.','2. Record its advance and reserve equipment first.','3. Find an Available serial of the required product in this pack or the live Barcode labels screen.','4. Scan or paste the serial into the project, then choose Add serial.','5. Repeat a used serial to check duplicate rejection.','Printing does not add stock, reserve equipment or make a used serial available again.','The live app is the source of truth: status can change after this PDF was generated.','Use new unique serials for additional receipts. Rerunning the seed preserves existing records.','Panels, cable, connectors, stands and other quantity-tracked materials do not require individual device serials in this demo.','Camera access requires a secure connection. Manual entry, USB scanning and the optional local test picker remain available.']
for line in cover:
 flow=p(line);_,height=flow.wrap(W-72,H);flow.drawOn(c,36,y-height);y-=height+13
label_footer(1);c.showPage()
rects=[]; assets=DATA['assets']; perpage=12; margin=28; gap=12; cellw=(W-margin*2-gap)/2; cellh=115
for idx,a in enumerate(assets):
 slot=idx%perpage; page=idx//perpage+2;col=slot%2;row=slot//2;x=margin+col*(cellw+gap);top=H-40-row*(cellh+9);y=top-cellh
 c.setStrokeColor(colors.HexColor('#BFCFD8'));c.roundRect(x,y,cellw,cellh,5,stroke=1,fill=0);c.setFillColor(NAVY);c.setFont('GuideBold',9);c.drawString(x+10,top-16,a['product_name'].replace('·','-'))
 c.setFont('Guide',8);c.drawString(x+10,top-29,f"{a['sku']} | {a['status'].capitalize()}")
 bar=code128.Code128(a['serial'],barWidth=.82,barHeight=38,humanReadable=False,quiet=True);bx=x+(cellw-bar.width)/2;bar.drawOn(c,bx,y+29)
 c.setFillColor(colors.black);c.setFont('GuideBold',10);c.drawCentredString(x+cellw/2,y+14,a['serial'])
 rects.append((page-1,a['serial'],(x,H-top,x+cellw,H-y)))
 if slot==perpage-1 or idx==len(assets)-1:label_footer(page);c.showPage()
c.save()
pack=ROOT/'output/barcodes';pack.mkdir(parents=True,exist_ok=True);pngdir=pack/'png';pngdir.mkdir(exist_ok=True)
doc=pymupdf.open(labels)
for pg,serial,rect in rects:doc[pg].get_pixmap(matrix=pymupdf.Matrix(3,3),clip=pymupdf.Rect(rect)).save(pngdir/(serial+'.png'))
with (pack/'serial-index.csv').open('w',newline='',encoding='utf-8') as f:
 writer=csv.DictWriter(f,fieldnames=['serial','status','sku','product_name']);writer.writeheader();writer.writerows(assets)
with zipfile.ZipFile(ROOT/'output/SunPower_Barcode_Test_Kit.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(labels,labels.name);z.write(pack/'serial-index.csv','serial-index.csv')
 for file in sorted(pngdir.glob('*.png')):z.write(file,'png/'+file.name)
with pymupdf.open(guide) as g: print(json.dumps({'guide_pages':len(g),'barcode_pages':len(doc),'barcode_labels':len(assets),'guide':str(guide),'labels':str(labels)}))
