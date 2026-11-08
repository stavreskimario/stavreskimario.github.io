"""Unlink exactly two proven non-rendering source templates from context scenes.

All nodes, meshes, materials, accessors and BIN remain; only scene-root or
parent-child references to those exact node identities can change.
"""
from pathlib import Path
import argparse,copy,hashlib,json,struct,itertools,gzip
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--exterior',type=Path,required=True);ap.add_argument('--main',type=Path,required=True);ap.add_argument('--visibility',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();OUT=a.out.resolve();assert not OUT.exists();OUT.mkdir(parents=True)
H=lambda b:hashlib.sha256(b).hexdigest();visibility_bytes=a.visibility.read_bytes();visibility_bytes=gzip.decompress(visibility_bytes)if a.visibility.suffix=='.gz'else visibility_bytes;visibility=json.loads(visibility_bytes);base=visibility['sources']['core-c96'];candidate=visibility['sources']['core-c4aa']
assert base['sha256']=='c96fb37215d4ebfc7bbbba9154fe7f96a8daf8500e9c61778136e286c4a03739'
assert candidate['sha256']=='c4aa88af40c449bb111a7e3d9d41a9b071bde2205a6d0c2525f25c5d00815fcc'
def mul(a,b):return [[sum(a[i][k]*b[k][j]for k in range(4))for j in range(4)]for i in range(4)]
def local(n):
 if 'matrix'in n:return [[n['matrix'][j*4+i]for j in range(4)]for i in range(4)]
 x,y,z,w=n.get('rotation',[0,0,0,1]);s=n.get('scale',[1,1,1]);t=n.get('translation',[0,0,0]);m=[[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w,t[0]],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w,t[1]],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y,t[2]],[0,0,0,1]]
 for i in range(3):
  for j in range(3):m[i][j]*=s[j]
 return m
def world_matrix(j,index):
 parents=[i for i,n in enumerate(j['nodes'])if index in n.get('children',[])];assert len(parents)<=1
 return mul(world_matrix(j,parents[0]),local(j['nodes'][index]))if parents else local(j['nodes'][index])
def bounds(j,index):
 n=j['nodes'][index];m=world_matrix(j,index);points=[]
 for primitive in j['meshes'][n['mesh']]['primitives']:
  access=j['accessors'][primitive['attributes']['POSITION']]
  for q in itertools.product(*zip(access['min'],access['max'])):points.append([sum(m[i][k]*q[k]for k in range(3))+m[i][3]for i in range(3)])
 return [[min(p[k]for p in points)for k in range(3)],[max(p[k]for p in points)for k in range(3)]]
def reachable(j):
 found=set();pending=[i for s in j.get('scenes',[])for i in s.get('nodes',[])]
 while pending:
  i=pending.pop()
  if i in found:continue
  found.add(i);pending+=j['nodes'][i].get('children',[])
 return found
specs=[('exterior',a.exterior,'Doric column master — 35ft','Doric column master — 35ft',0.,'retained-exterior-visible-occluder.glb'),('main',a.main,'Fluted Corinthian shaft master.001','Fluted Corinthian shaft master',-4.2672,'retained-main-visible-occluder-main0.glb')]
report={'schema':1,'operation':'JSON scene-reference-only render-visibility derivative; frozen authorities unchanged','sourceVisibilityInventorySha256':H(visibility_bytes),'sourceProofs':{'c96':base['sha256'],'c4aa':candidate['sha256']},'files':[]}
for zone,path,node_name,source_name,height,outname in specs:
 records=[q for q in base['hiddenRenderObjects']if q['name']==source_name];new_records=[q for q in candidate['hiddenRenderObjects']if q['name']==source_name];assert len(records)==len(new_records)==1 and records[0]==new_records[0]and records[0]['hide_render']is True
 old=path.read_bytes();assert old[:4]==b'glTF';size,kind=struct.unpack('<II',old[12:20]);j=json.loads(old[20:20+size]);tail=old[20+size:];before=copy.deepcopy(j);ids=[i for i,n in enumerate(j['nodes'])if n.get('name')==node_name];assert len(ids)==1;idx=ids[0];assert not j['nodes'][idx].get('children');assert idx in reachable(j)
 for animation in j.get('animations',[]):assert all(c.get('target',{}).get('node')!=idx for c in animation.get('channels',[]))
 for skin in j.get('skins',[]):assert idx not in skin.get('joints',[])and skin.get('skeleton')!=idx
 bb=bounds(j,idx);converted=[[bb[0][0],-bb[1][2],bb[0][1]+height],[bb[1][0],-bb[0][2],bb[1][1]+height]];expected=records[0]['boundsBlenderWorld'];error=max(abs(converted[i][k]-expected[i][k])for i in range(2)for k in range(3));assert error<1e-5,(node_name,error)
 edits=[]
 for i,scene in enumerate(j.get('scenes',[])):
  if idx in scene.get('nodes',[]):previous=scene['nodes'];scene['nodes']=[q for q in previous if q!=idx];edits.append({'path':f'scenes[{i}].nodes','before':previous,'after':scene['nodes']})
 for i,node in enumerate(j['nodes']):
  if idx in node.get('children',[]):previous=node['children'];node['children']=[q for q in previous if q!=idx];edits.append({'path':f'nodes[{i}].children','before':previous,'after':node['children']})
 assert edits and reachable(j)==reachable(before)-{idx}
 for key in set(before)|set(j):
  if key not in ['nodes','scenes']:assert before.get(key)==j.get(key),key
 for old_node,new_node in zip(before['nodes'],j['nodes']):assert {k:v for k,v in old_node.items()if k!='children'}=={k:v for k,v in new_node.items()if k!='children'}
 for old_scene,new_scene in zip(before['scenes'],j['scenes']):assert {k:v for k,v in old_scene.items()if k!='nodes'}=={k:v for k,v in new_scene.items()if k!='nodes'}
 payload=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode();payload+=b' '*((-len(payload))%4);result=struct.pack('<4sII',b'glTF',2,20+len(payload)+len(tail))+struct.pack('<II',len(payload),0x4E4F534A)+payload+tail;target=OUT/outname;target.write_bytes(result);assert target.read_bytes()[20+len(payload):]==tail and path.read_bytes()==old
 report['files'].append({'zone':zone,'input':str(path.resolve()),'inputSha256':H(old),'output':outname,'outputSha256':H(result),'bytes':len(result),'excludedNodeIndex':idx,'excludedNodeName':node_name,'sourceObjectName':source_name,'sourceHideRender':True,'sourceWorldBounds':expected,'rawGlTfBounds':bb,'heightOffset':height,'boundMaximumErrorM':error,'sceneReferenceEdits':edits,'allOtherSceneReferencesExact':True,'allNodeMeshMaterialAccessorPayloadsExact':True,'binChunkByteExact':True,'binChunkSha256':H(tail),'allOtherReachableNodesExact':True,'frozenInputUnchanged':True})
(OUT/'visible-context-proof.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
