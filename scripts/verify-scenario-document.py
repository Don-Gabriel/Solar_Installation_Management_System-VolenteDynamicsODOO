from pathlib import Path
import json,re
import pymupdf
from PIL import Image,ImageDraw

root=Path(__file__).resolve().parent.parent
catalog=json.loads((root/'docs/scenarios/catalog.json').read_text(encoding='utf-8'))
assert len(catalog['cases'])==200
assert len({c['id'] for c in catalog['cases']})==200
for c in catalog['cases']:
    assert all(c[k] for k in ['title','given','when','expected','priority','build_assessment'])
    assert c['execution']['status'] in ['PASS','FAIL','BLOCKED','NOT RUN']
fixture=json.loads((root/'docs/scenarios/F15-fixture.json').read_text())
assert len(fixture['people'])==27
assert len({p['role'] for p in fixture['people']})==8
assert len([p for p in fixture['people'] if p['role']=='technician'])==15
assert len(fixture['busy_blocks'])==39
for date in fixture['calendar']['working_dates']:
    busy={b['technician_id'] for b in fixture['busy_blocks'] if b['start'].startswith(date)}
    eligible={p['id'] for p in fixture['people'] if p['role']=='technician' and 'inverter_repair' in p['skills'] and p['id'] not in busy}
    assert eligible=={'T14','T15'}
doc=pymupdf.open(root/'output/pdf/SunPower_Real_World_Scenarios.pdf')
text='\n'.join(p.get_text() for p in doc)
assert '\ufffd' not in text
for c in catalog['cases']:
    assert re.search(r'\b'+c['id']+r'\b',text),c['id']
assert all(s in text for s in ['INR 1700','27 distinct','extended the deadline','PASS','BLOCKED'])
review=root/'output/scenario-review';review.mkdir(exist_ok=True)
tiles=[];overflow=[]
for i,page in enumerate(doc):
    for word in page.get_text('words'):
        if word[0]<40 or word[2]>page.rect.width-40 or word[1]<30 or word[3]>page.rect.height-20:overflow.append((i+1,word))
    pix=page.get_pixmap(matrix=pymupdf.Matrix(.4,.4));im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);im.thumbnail((220,300));tile=Image.new('RGB',(240,330),'#E1E6EB');tile.paste(im,((240-im.width)//2,6));ImageDraw.Draw(tile).text((8,312),str(i+1),fill='black');tiles.append(tile)
    if i in [1,3,5,6,9,10,25,38,len(doc)-1]:page.get_pixmap(matrix=pymupdf.Matrix(1.3,1.3)).save(review/f'final-page-{i+1}.png')
for k in range(0,len(tiles),16):
    subset=tiles[k:k+16];canvas=Image.new('RGB',(960,330*((len(subset)+3)//4)),'white')
    for j,t in enumerate(subset):canvas.paste(t,((j%4)*240,(j//4)*330))
    canvas.save(review/f'final-contact-{k//16+1}.png')
assert not overflow,overflow[:10]
print(json.dumps({'pages':len(doc),'scenarios':200,'fixture_staff':27,'fixture_technicians':15,'text_bounds':'passed','all_scenario_ids_present':True,'execution':{s:sum(c['execution']['status']==s for c in catalog['cases']) for s in ['PASS','FAIL','BLOCKED','NOT RUN']}}))
