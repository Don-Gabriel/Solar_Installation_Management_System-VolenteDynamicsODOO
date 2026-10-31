from pathlib import Path
import json,pymupdf,zxingcpp
from PIL import Image,ImageOps,ImageDraw
root=Path.cwd();out=root/'output/guide-review';out.mkdir(parents=True,exist_ok=True)
expected=json.loads((root/'output/guide-data/demo.json').read_text())['assets'];fail=[]
for a in expected:
 results=zxingcpp.read_barcodes(Image.open(root/'output/barcodes/png'/f"{a['serial']}.png"))
 if a['serial'] not in [r.text for r in results]:fail.append(a['serial'])
print('Barcode images decoded:',len(expected)-len(fail),'/',len(expected),'failures:',fail)
assert not fail
for name in ['SunPower_Screen_Guide','SunPower_Test_Barcodes']:
 doc=pymupdf.open(root/'output/pdf'/f'{name}.pdf');thumbs=[]
 for i,page in enumerate(doc):
  pix=page.get_pixmap(matrix=pymupdf.Matrix(.45,.45));im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples).convert('RGB');im.thumbnail((230,325));tile=Image.new('RGB',(250,355),'#d7e1e7');tile.paste(im,((250-im.width)//2,18));ImageDraw.Draw(tile).text((10,337),f'Page {i+1}',fill='black');thumbs.append(tile)
  if name.endswith('Guide') and i in [0,3,4,9,12,22,25,28]:page.get_pixmap(matrix=pymupdf.Matrix(1.2,1.2)).save(out/f'guide-page-{i+1}.png')
 for offset in range(0,len(thumbs),12):
  selected=thumbs[offset:offset+12];sheet=Image.new('RGB',(1000,355*((len(selected)+3)//4)),'white')
  for j,tile in enumerate(selected):sheet.paste(tile,((j%4)*250,(j//4)*355))
  sheet.save(out/f'{name}-contact-{offset//12+1}.png')
 if name.endswith('Guide'):
  txt='\n'.join(p.get_text() for p in doc);assert '\ufffd' not in txt
  print('Guide text extraction:',len(txt),'characters; page count:',len(doc))
 else:
  decoded=[]
  for page in doc:
   pix=page.get_pixmap(matrix=pymupdf.Matrix(3,3));im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);decoded += [r.text for r in zxingcpp.read_barcodes(im)]
  assert set(decoded)=={a['serial'] for a in expected};print('Full PDF pages decoded:',len(set(decoded)),'unique serials')
