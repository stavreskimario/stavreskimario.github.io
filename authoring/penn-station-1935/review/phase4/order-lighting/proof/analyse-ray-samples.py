import json,math,argparse
from pathlib import Path
import numpy as np
from PIL import Image
parser=argparse.ArgumentParser();parser.add_argument('--work',type=Path,required=True);args=parser.parse_args();work=args.work
r=json.loads((work/'waiting-material-diagnostics-samples/diagnostic-report.json').read_text())
base=np.asarray(Image.open(work/'waiting-material-diagnostics-samples/baseline.png').convert('RGB'))
ao=np.asarray(Image.open(work/'phase4-baked-final/lighting-waiting-room-masonry-ao.png').convert('RGB'))
lm=np.asarray(Image.open(work/'phase4-denoised-final/lighting-waiting-room-masonry-sky.png').convert('RGB'))
rows=[]
for s in r['samples']:
 if s['region']=='right-shaft' or s['material']!='Travertine':continue
 uv=s.get('uv1');tri=s['triangleUV']
 if uv is None:continue
 x=min(4095,max(0,int(uv[0]*4096)));y=min(4095,max(0,int(uv[1]*4096)))
 s['screenRGB']=base[s['y'],s['x']].tolist();s['atlasAO']=ao[y,x].tolist();s['atlasLMsRGB']=lm[y,x].tolist();s['trianglePixelArea']=abs((tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0]))*.5*4096**2
 rows.append(s)
rows.sort(key=lambda x:sum(x['screenRGB']))
print('Cap hits',len(rows),'darkest',json.dumps(rows[:5],indent=2),'brightest',json.dumps(rows[-3:],indent=2))
(work/'waiting-material-diagnostics/capital-ray-uv-samples.json').write_text(json.dumps({'scope':'Browser same-camera actual nearest-triangle ray hits; exact atlas sample values; unfiltered base texture texels','darkest':rows[:20],'brightest':rows[-20:]},indent=2)+'\n')
