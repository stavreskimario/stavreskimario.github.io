import json,struct,argparse
from pathlib import Path
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();p=args.input;b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:]
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];sz={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',np.dtype(dtype).itemsize*sz)
 return np.ndarray((a['count'],sz),dtype=dtype,buffer=binary,offset=off,strides=(stride,np.dtype(dtype).itemsize))
results=[]
for m in g['meshes']:
 for q in m['primitives']:
  name=g['materials'][q['material']]['name']
  if name not in ['InteriorGranite','Travertine']:continue
  po=acc(q['attributes']['POSITION']);uv=acc(q['attributes']['TEXCOORD_1']);ix=acc(q['indices']).reshape(-1,3);pp=po[ix];tt=uv[ix];c=pp.mean(axis=1);area=np.linalg.norm(np.cross(pp[:,1]-pp[:,0],pp[:,2]-pp[:,0]),axis=1)*.5;ua=np.abs(np.cross(tt[:,1]-tt[:,0],tt[:,2]-tt[:,0]))*.5
  sels={'all_'+name:np.ones(len(ix),bool)}
  if name=='Travertine':sels['one_capital']=(c[:,0]>12.4)&(c[:,0]<16)&(c[:,1]>18.465)&(c[:,1]<21.1)&(np.abs(c[:,2]-14.072)<1.8)
  if name=='InteriorGranite':sels['one_shaft']=(c[:,0]>12.4)&(c[:,0]<16)&(np.abs(c[:,2]-14.072)<1.8)
  for label,mask in sels.items():
   results.append({'label':label,'triangles':int(mask.sum()),'worldAreaM2':float(area[mask].sum()),'atlasPixels':float(ua[mask].sum()*4096**2),'meanTexelsPerMetre':float(np.sqrt(ua[mask].sum()*4096**2/area[mask].sum())),'uvBounds':tt[mask].reshape(-1,2).min(axis=0).tolist()+tt[mask].reshape(-1,2).max(axis=0).tolist()})
print(json.dumps(results,indent=2))
args.output.write_text(json.dumps(results,indent=2)+'\n')
