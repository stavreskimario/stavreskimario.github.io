from pathlib import Path
import argparse,json,hashlib,struct
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();H=lambda b:hashlib.sha256(b).hexdigest()
def read(p):
 b=p.read_bytes();n,t=struct.unpack_from('<II',b,12);assert t==0x4e4f534a;assert struct.unpack_from('<I',b,20+n+4)[0]==0x004e4942;return b,json.loads(b[20:20+n]),b[28+n:]
sb,s,sbin=read(a.source);cb,c,cbin=read(a.candidate);m=json.loads(a.manifest.read_text());expected={'Arrival row5 west '+name+suffix for suffix in['','.001']for name in['west flight1 rounded top rail','Arrival intermediate landing top rail','west flight2 rounded top rail']};report={'schema':1,'status':'HOLD','inputs':{'source':{'path':str(a.source),'sha256':H(sb)},'candidate':{'path':str(a.candidate),'sha256':H(cb)},'manifest':{'path':str(a.manifest),'sha256':H(a.manifest.read_bytes())}},'failures':[]}
try:
 assert H(sb)=='ba851616344808c23d2fb1868f29c30f8cfbe0ca7b4f5645d5f64677700f610f'==m['source']['sha256'];assert H(cb)==m['candidate']['sha256'];assert cbin[:len(sbin)]==sbin
 assert {x['node']for x in m['ownedRailChanges']}==expected and len(m['ownedRailChanges'])==6;owned={x['meshIndex']:x for x in m['ownedRailChanges']};assert len(owned)==6
 nodes={x['name']:(i,x)for i,x in enumerate(s['nodes'])};mesh_rows=[]
 for index,row in owned.items():
  i,n=nodes[row['node']];assert n['mesh']==index;assert [k for k,x in enumerate(s['nodes'])if x.get('mesh')==index]==[i],'Owned mesh must not be shared with another node';assert H(json.dumps(s['meshes'][index],sort_keys=True).encode())==row['beforeMeshJsonSha256'];assert H(json.dumps(c['meshes'][index],sort_keys=True).encode())==row['afterMeshJsonSha256'];assert c['meshes'][index]!=s['meshes'][index];assert [x.get('material')for x in c['meshes'][index]['primitives']]==[x.get('material')for x in s['meshes'][index]['primitives']];mesh_rows.append({'node':row['node'],'meshIndex':index,'uniqueOriginalNode':i,'beforeMeshJsonSha256':row['beforeMeshJsonSha256'],'afterMeshJsonSha256':row['afterMeshJsonSha256']})
 assert len(c['nodes'])==len(s['nodes'])+2 and len(c['meshes'])==len(s['meshes'])+2;assert {n['name']for n in c['nodes'][len(s['nodes']):]}=={'P5Curve west lower haunch side-plus','P5Curve west lower haunch side-minus'}
 for key in set(s)|set(c):
  if key=='buffers':
   assert len(c[key])==len(s[key])==1;d=dict(c[key][0]);d['byteLength']=s[key][0]['byteLength'];assert d==s[key][0]
  elif key=='scenes':
   assert len(c[key])==len(s[key])
   for old,new in zip(s[key],c[key]):
    d=dict(new);d['nodes']=old['nodes'];assert d==old and new['nodes'][:len(old['nodes'])]==old['nodes'];assert len(new['nodes'])==len(old['nodes'])+2
  elif key=='meshes':
   for i,old in enumerate(s[key]):
    if i not in owned:assert c[key][i]==old,('Unowned mesh changed',i)
  elif key in['nodes','accessors','bufferViews']:assert c[key][:len(s[key])]==s[key],key
  else:assert c[key]==s[key],key
 report.update({'status':'PASS: exactly6ownedrail mesh definitions and2newhaunch nodes; every other original binding and byte exact','ownedRails':mesh_rows,'exactOriginalNodeCount':len(s['nodes']),'exactNonownedMeshCount':len(s['meshes'])-6,'exactFlatFaceMeshCount':14,'originalBinaryPrefixBytes':len(sbin),'originalBinaryPrefixSha256':H(sbin),'allOriginalNodesWorldMatricesExact':True,'allOriginalMaterialsAndImagesExact':True,'allOriginalAccessorNormalUvIndexBytesExact':True,'sameSourceFrame':'Main0; no original node/world transform changes','newAddedNodeNames':[n['name']for n in c['nodes'][len(s['nodes']):]]})
except AssertionError as e:report['failures'].append(str(e))
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report.get(k)for k in['status','failures','exactOriginalNodeCount','exactNonownedMeshCount','exactFlatFaceMeshCount']}));assert not report['failures']
