from pathlib import Path
import bpy,json,hashlib,math,time
D=Path(__file__).parent;P=Path('/Users/stavreskimario/Desktop/penn-station-work/phase13-track-enclosure/integration/floor-bake-v1/independent-floor-prebake-scene.blend');H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=H(P);assert before=='f82c477cff0727e0e501f1ee02d7bf10ed5c55acb7623ed9b17c7305414aeb63';targets=json.loads((D/'owned-current-full.json').read_text())['triangles'];bpy.ops.wm.open_mainfile(filepath=str(P));plane=-.440000057220459;candidate=[];objects=[];started=time.monotonic()
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 bb=[o.matrix_world@__import__('mathutils').Vector(p)for p in o.bound_box]
 if min(p.x for p in bb)>-7.15+.001 or max(p.x for p in bb)<-75-.001 or min(p.y for p in bb)>79.373 or max(p.y for p in bb)<45.499 or min(p.z for p in bb)>plane+2e-5 or max(p.z for p in bb)<plane-2e-5:continue
 m=o.data;m.calc_loop_triangles();hits=0
 for t in m.loop_triangles:
  ps=[o.matrix_world@m.vertices[v].co for v in t.vertices]
  if any(abs(p.z-plane)>2e-5 for p in ps):continue
  n=(ps[1]-ps[0]).cross(ps[2]-ps[0]);
  if n.length<1e-10 or n.normalized().z>-.95:continue
  if min(p.x for p in ps)>-7.15+.001 or max(p.x for p in ps)<-75-.001 or min(p.y for p in ps)>79.373 or max(p.y for p in ps)<45.499:continue
  corners=[[p.x,p.z-4.2672,-p.y]for p in ps];candidate.append({'owner':o.name,'polygon':t.polygon_index,'vertices':list(t.vertices),'loops':list(t.loops),'material':m.materials[t.material_index].name if m.materials[t.material_index]else None,'corners':corners});hits+=1
 if hits:objects.append({'name':o.name,'candidateTriangles':hits,'sourcePolygons':len(m.polygons),'matrixWorld':[list(r)for r in o.matrix_world]})
used=set();matches=[];missing=[]
for ti,t in enumerate(targets):
 a=[c['world']for c in t['corners']];found=[]
 for j,c in enumerate(candidate):
  if j in used:continue
  for rot in range(3):
   delta=max(abs(a[k][ax]-c['corners'][(k+rot)%3][ax])for k in range(3)for ax in range(3))
   if delta<=2e-5:found.append((j,delta,rot))
 if len(found)==1:
  j,delta,rot=found[0];used.add(j);matches.append({'target':ti,'snapshotNode':t['snapshotNode'],'snapshotTriangle':t['snapshotTriangleOffset'],**candidate[j],'maximumCornerPositionDeltaM':delta})
 else:missing.append({'target':ti,'snapshotNode':t['snapshotNode'],'snapshotTriangle':t['snapshotTriangleOffset'],'matches':len(found),'corners':a})
r={'status':'PASS56cachedownersuniquelymatched'if len(matches)==56 and not missing else'HOLD cachedgeometryidentity requiresreconciliation','scene':{'path':str(P),'sha256':before},'objects':objects,'candidateTriangles':len(candidate),'matches':matches,'missing':missing,'seconds':time.monotonic()-started};assert H(P)==before;(D/'cache-soffit-owner-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'candidates':len(candidate),'matched':len(matches),'objects':objects,'missing':missing[:4]},indent=2),flush=True)
