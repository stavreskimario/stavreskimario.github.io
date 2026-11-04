"""Exact declared cached ceiling-face removal; no bbox clipping or infill."""
from pathlib import Path
import bpy,json,hashlib,collections

def apply_soffit_context_membership(context_objects,audit_json_path):
 audit=json.loads(Path(audit_json_path).read_text());assert audit['status'].startswith('PASS');groups=collections.defaultdict(list)
 for t in audit['matches']:groups[t['owner']].append(t)
 assert len(audit['matches'])==56 and len(groups)==3
 allobjects=list(context_objects);lookup={o.name:o for o in allobjects};unchanged={o.name:(o.data.as_pointer()if o.type=='MESH'else None,tuple(tuple(r)for r in o.matrix_world),o.hide_render,o.hide_viewport)for o in allobjects if o.name not in groups};reports=[]
 for name,targets in groups.items():
  o=lookup[name];old=o.data;old.calc_loop_triangles();by_poly=collections.defaultdict(list)
  for t in targets:by_poly[t['polygon']].append(t)
  assert len(by_poly)==len(targets),'Owned cached faces are individual triangles, not partial polygons'
  for pi,ts in by_poly.items():
   p=old.polygons[pi];assert len(p.vertices)==3;points=[o.matrix_world@old.vertices[v].co for v in p.vertices];actual=[[v.x,v.z-4.2672,-v.y]for v in points];expect=ts[0]['corners'];delta=min(max(abs(actual[k][a]-expect[(k+r)%3][a])for k in range(3)for a in range(3))for r in range(3));assert delta==0,(name,pi,delta)
  retained=[p for p in old.polygons if p.index not in by_poly];loopids=[i for p in retained for i in p.loop_indices];verts=[tuple(v.co)for v in old.vertices];faces=[tuple(p.vertices)for p in retained];normal_values=[tuple(old.corner_normals[i].vector)for i in loopids];uv_values={u.name:[tuple(u.data[i].uv)for i in loopids]for u in old.uv_layers};new=bpy.data.meshes.new(old.name+' exact56soffitownership retained');new.from_pydata(verts,[],faces);new.update()
  for m in old.materials:new.materials.append(m)
  for p,op in zip(new.polygons,retained):p.material_index=op.material_index;p.use_smooth=op.use_smooth
  for u in old.uv_layers:
   dst=new.uv_layers.new(name=u.name)
   for x,v in zip(dst.data,uv_values[u.name]):x.uv=v
   dst.active_render=u.active_render
  if len(old.uv_layers):new.uv_layers.active_index=old.uv_layers.active_index
  new.normals_split_custom_set(normal_values);new.update();o.data=new
  assert [tuple(v.co)for v in new.vertices]==verts
  for u in new.uv_layers:assert [tuple(x.uv)for x in u.data]==uv_values[u.name]
  normal_delta=max((max(abs(a-b)for a,b in zip(x.vector,y))for x,y in zip(new.corner_normals,normal_values)),default=0);assert normal_delta==0,('Unowned cached normals changed',name,normal_delta)
  assert len(old.polygons)-len(new.polygons)==len(targets)
  reports.append({'owner':name,'removedTrianglePolygons':sorted(by_poly),'removedCount':len(targets),'allRetainedVertexPositionsUVsNormalsMaterialIndicesExact':True,'maximumRetainedNormalComponentDrift':normal_delta,'originalPolygons':len(old.polygons),'retainedPolygons':len(new.polygons)})
 for name,value in unchanged.items():
  o=lookup[name];assert(o.data.as_pointer()if o.type=='MESH'else None,tuple(tuple(r)for r in o.matrix_world),o.hide_render,o.hide_viewport)==value,name
 return{'status':'PASS exact56cachedtrianglefaces removed; allunowned geometryUVnormals andotherobjectpointers/transforms/visibility unchanged','changedOwners':reports,'removedTotal':sum(x['removedCount']for x in reports),'allOtherObjectsUnchanged':len(unchanged),'auditPath':str(audit_json_path),'auditSha256':hashlib.sha256(Path(audit_json_path).read_bytes()).hexdigest()}
