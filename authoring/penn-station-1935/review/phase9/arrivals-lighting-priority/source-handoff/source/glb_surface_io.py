import json, struct
import numpy as np
def read_glb(path):
 b=path.read_bytes();n,t=struct.unpack_from('<II',b,12);j=json.loads(b[20:20+n]);off=20+n;bn,bt=struct.unpack_from('<II',b,off);buf=memoryview(b)[off+8:off+8+bn]
 widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};types={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
 def acc(i):
  z=j['accessors'][i];v=j['bufferViews'][z['bufferView']];assert not v.get('extensions',{}).get('EXT_meshopt_compression');dt=np.dtype(types[z['componentType']]);c=widths[z['type']];stride=v.get('byteStride',c*dt.itemsize);p=np.ndarray((z['count'],c),dt,buf,(v.get('byteOffset',0)+z.get('byteOffset',0)),strides=(stride,dt.itemsize)).astype(np.float64)
  if z.get('normalized'):p/=({5120:127,5121:255,5122:32767,5123:65535}[z['componentType']]);p=np.maximum(p,-1)if z['componentType']in[5120,5122]else p
  return p
 def local(n):
  if 'matrix'in n:return np.array(n['matrix'],float).reshape(4,4).T
  x,y,z,w=n.get('rotation',[0,0,0,1]);q=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])*np.array(n.get('scale',[1,1,1]));m=np.eye(4);m[:3,:3]=q;m[:3,3]=n.get('translation',[0,0,0]);return m
 allp=[];alln=[];allm=[];allnodes=[];named={};uvcounts={}
 def walk(i,parent):
  n=j['nodes'][i];m=parent@local(n)
  if 'mesh'in n:
   for p in j['meshes'][n['mesh']]['primitives']:
    v=acc(p['attributes']['POSITION']);vn=acc(p['attributes']['NORMAL']);idx=acc(p['indices']).astype(np.int64).reshape(-1,3);v=v@m[:3,:3].T+m[:3,3];vn=vn@np.linalg.inv(m[:3,:3]);vn/=np.maximum(1e-30,np.linalg.norm(vn,axis=1))[:,None]
    if np.linalg.det(m[:3,:3])<0:idx=idx[:,[0,2,1]]
    start=sum(len(x)for x in allp);allp.append(v[idx]);alln.append(vn[idx]);allm.extend([p.get('material',-1)]*len(idx));allnodes.extend([n.get('name','')]*len(idx));named.setdefault(n.get('name',''),[]).append((start,start+len(idx)));uvcounts[n.get('name','')]=[k for k in p['attributes']if k.startswith('TEXCOORD_')]
  for c in n.get('children',[]):walk(c,m)
 for i in j['scenes'][j.get('scene',0)]['nodes']:walk(i,np.eye(4))
 return {'json':j,'p':np.concatenate(allp),'n':np.concatenate(alln),'mat':np.array(allm),'node':allnodes,'named':named,'uvAttributes':uvcounts}

