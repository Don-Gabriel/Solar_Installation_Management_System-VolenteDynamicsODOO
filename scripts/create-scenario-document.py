"""Build a traceable scenario specification; never infer execution passes from source status."""
from pathlib import Path
from collections import Counter
import csv, json, re
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, CondPageBreak
from reportlab.platypus.tableofcontents import TableOfContents

ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'docs/scenarios'
OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
assessment={'P':'Present in source','L':'Partial','M':'Missing workflow','V':'Needs verification','D':'Policy decision'}
groups=[]; cases=[]
for line in (BASE/'catalog-source.txt').read_text(encoding='utf-8').splitlines():
    if line.startswith('## '):
        code,name=[s.strip() for s in line[3:].split('|')];group={'code':code,'name':name,'cases':[]};groups.append(group)
    elif line and not line.startswith('#'):
        values=[s.strip() for s in line.split('|')]
        assert len(values)==6,(len(values),line)
        title,given,when,expected,priority,status=values
        case={'id':f"{group['code']}-{len(group['cases'])+1:02d}",'area':group['name'],'title':title,'given':given,'when':when,'expected':expected,'priority':priority,'build_assessment':assessment[status]}
        group['cases'].append(case);cases.append(case)
assert len(cases)==200 and len(groups)==20
assert all(len(g['cases'])==10 for g in groups)
assert len({c['id'] for c in cases})==len({c['title'] for c in cases})==200
execution_path=BASE/'execution.json'
execution=json.loads(execution_path.read_text(encoding='utf-8')) if execution_path.exists() else {}
for c in cases:
    c['execution']=execution.get(c['id'],{'status':'NOT RUN','evidence':'No scenario-specific execution recorded.'})
catalog={'baseline_commit':'d0d1038','working_deadline':'2026-10-31T14:45:00+05:30','scenario_count':len(cases),'groups':[{'code':g['code'],'name':g['name']} for g in groups],'cases':cases}
(BASE/'catalog.json').write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
csvpath=ROOT/'output/SunPower_Scenario_Test_Register.csv'
with csvpath.open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.writer(f);writer.writerow(['ID','Area','Scenario','Given','When','Expected','Priority','Source assessment','Execution','Evidence','Observed result','Defect','Tested commit','Environment'])
    for c in cases:
        e=c['execution'];writer.writerow([c['id'],c['area'],c['title'],c['given'],c['when'],c['expected'],c['priority'],c['build_assessment'],e['status'],e.get('evidence',''),e.get('observed',''),e.get('defect',''),e.get('commit',''),e.get('environment','')])
plan=(BASE/'PLAN.md').read_text(encoding='utf-8')
counts=Counter(c['build_assessment'] for c in cases)
run_counts=Counter(c['execution']['status'] for c in cases)
md=[plan,'\n## Catalogue status summary\n','Historical source review at d0d1038 is separate from current execution. Counts below are generated from the 200 named cases.\n']
md += [f'- {k}: {v}' for k,v in counts.items()]
md += ['\nExecution: '+', '.join(f'{k}: {v}' for k,v in run_counts.items())+'.\n']
for g in groups:
    md.append(f"\n## {g['code']} {g['name']}\n")
    for c in g['cases']:
        e=c['execution'];md += [f"### {c['id']} {c['title']}",f"{c['priority']} | Source: {c['build_assessment']} | Execution: {e['status']}\n",f"**Given:** {c['given']}\n",f"**When:** {c['when']}\n",f"**Expected:** {c['expected']}\n",f"**Evidence:** {e.get('evidence','No evidence recorded.')}\n"]
        if e.get('observed'):md.append(f"**Observed:** {e['observed']}\n")
(ROOT/'docs/SCENARIO_CATALOG.md').write_text('\n'.join(md),encoding='utf-8')

pdfmetrics.registerFont(TTFont('Scenario','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ScenarioBold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Scenario',normal='Scenario',bold='ScenarioBold',italic='Scenario',boldItalic='ScenarioBold')
styles=getSampleStyleSheet()
for name,size,leading,after in [('BodyScenario',10.5,14.2,7),('SmallScenario',9,12,5),('CaseScenario',12,15,7),('HeadingScenario',17,21,12),('TitleScenario',25,30,17)]:
    styles.add(ParagraphStyle(name=name,fontName='ScenarioBold' if name in ['CaseScenario','HeadingScenario','TitleScenario'] else 'Scenario',fontSize=size,leading=leading,spaceAfter=after,textColor=colors.black,keepWithNext=name in ['CaseScenario','HeadingScenario']))
def fmt(s):
    s=escape(s.replace('**','~B~').replace('`',''))
    parts=s.split('~B~');s=''.join(('<b>' if i%2 else '</b>')+v if i else v for i,v in enumerate(parts))
    return s
def para(s,style='BodyScenario'):return Paragraph(fmt(s),styles[style])
def table(rows,widths=None):
    width=524
    if widths is None:
        widths=([104,44,116,136,124] if len(rows[0])==5 and 'Permission role' in rows[0][0] else [180,44,100,100,100] if len(rows[0])==5 else [width/len(rows[0])]*len(rows[0]))
    t=Table([[para(v,'SmallScenario') for v in row] for row in rows],colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E6EDF1')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F7F9FA')]),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#D9D9D9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));return t
def footer(canvas,doc):
    canvas.saveState();canvas.setFont('Scenario',8);canvas.setFillColor(colors.HexColor('#52606A'));canvas.drawString(44,26,'SUNPOWER | Scenario specification | 31 October 2026');canvas.drawRightString(568,26,str(doc.page));canvas.restoreState()
class SpecDoc(SimpleDocTemplate):
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and f.style.name=='HeadingScenario':
            text=f.getPlainText();key='sec-'+re.sub('[^a-z0-9]+','-',text.lower());self.canv.bookmarkPage(key);self.canv.addOutlineEntry(text,key,0,False);self.notify('TOCEntry',(0,text,self.page,key))
story=[Spacer(1,60),para('SunPower real world scenarios','TitleScenario'),para('Acceptance specification and staffing plan','HeadingScenario'),para('200 distinct scenarios across 20 operational areas'),Spacer(1,20),para('Prepared for the revised working deadline of 31 October 2026 at 14:45 IST.'),para('Covers phone-led intake, competing requests, 15-technician scheduling, crews, installed-component diagnosis, mixed warranties, replacement invoices and mobile or Windows delivery.'),Spacer(1,20),para('This is a specification with an honest execution register. Source support and a test pass are different facts. No claim is made that all 200 scenarios already work.'),PageBreak(),para('Contents','HeadingScenario')]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle(name='ScenarioTOC',fontName='Scenario',fontSize=9.5,leading=11.5,spaceBefore=0,spaceAfter=0,textColor=colors.black)];story += [toc,PageBreak()]
lines=plan.splitlines();i=0
while i<len(lines):
    line=lines[i].strip()
    if line.startswith('# '):i+=1;continue
    if not line:i+=1;continue
    if line.startswith('## '):
        if line[3:]=='Source map and references':story.append(PageBreak())
        story += [Spacer(1,8),para(line[3:],'HeadingScenario')]
    elif line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            row=[x.strip() for x in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[-: ]+',x) for x in row):rows.append(row)
            i+=1
        story += [table(rows),Spacer(1,12)];continue
    else:story.append(para(line))
    i+=1
story += [PageBreak(),para('Catalogue status summary','HeadingScenario'),para('Historical source review at d0d1038 and current scenario execution are counted separately. Missing implementation is never treated as a passing test.'),table([['Source assessment','Cases']]+[[k,str(v)] for k,v in counts.items()],[390,134]),Spacer(1,12),table([['Execution result','Cases']]+[[k,str(v)] for k,v in run_counts.items()],[390,134]),Spacer(1,12),para('Each following case supplies its starting conditions, action and required result. Use the matching CSV register for evidence, defect links, environment and tested commit. The test plan defines fixtures and shared financial, access and retry checks.')]
for g in groups:
    story += [CondPageBreak(240),Spacer(1,12),para(g['code']+' '+g['name'],'HeadingScenario')]
    for c in g['cases']:
        e=c['execution'];block=[para(c['id']+' '+c['title'],'CaseScenario'),para(c['priority']+' | Baseline: '+c['build_assessment']+' | Execution: '+e['status'],'SmallScenario'),para('**Given** '+c['given']),para('**When** '+c['when']),para('**Expected** '+c['expected'])]
        if e['status']!='NOT RUN':block.append(para('**Evidence** '+e.get('evidence','See execution register.')+' See the execution register for commit, environment and partial checks.','SmallScenario'))
        if e.get('observed'):block.append(para('**Observed** '+e['observed'],'SmallScenario'))
        block.append(Spacer(1,14));story.append(KeepTogether(block))
path=OUT/'SunPower_Real_World_Scenarios.pdf'
doc=SpecDoc(str(path),pagesize=letter,rightMargin=44,leftMargin=44,topMargin=44,bottomMargin=44,title='SunPower real world scenarios and acceptance plan',author='SunPower project')
doc.multiBuild(story,onFirstPage=footer,onLaterPages=footer)
print(json.dumps({'cases':len(cases),'groups':len(groups),'source_assessment':dict(counts),'execution':dict(run_counts),'pdf':str(path)}))
