"""Cut only the declared old floor receiver faces from the accepted light cache.
Uses exactly floor_clip.py, the runtime floor-partition clipping implementation.
No visibility masks, added caps or alterations to unrelated cache objects.
"""
import json,math
from pathlib import Path
from collections import defaultdict
from floor_clip import area,partition

def apply_floor_context_membership(cached_context_objects,membershipJSONPath,primaryContract=None):
 import bpy
 from mathutils import Vector
 spec=json.loads(Path(membershipJSONPath).read_text());roi=spec['roi'];objects={o.name:o for o in cached_context_objects};reports=[];removed_by_material=defaultdict(float)
 for rule in spec['cacheOwners']:
  name=rule['owner'];assert name in objects,('Missing exact floorcacheowner',name);o=objects[name];assert o.type=='MESH';old=o.data;assert not o.modifiers;uvnames=[u.name for u in old.uv_layers];assert uvnames
  old.calc_loop_triangles();triangles_by_poly=defaultdict(list)
  for t in old.loop_triangles:triangles_by_poly[t.polygon_index].append(t)
  world=o.matrix_world;inv=world.inverted();normal_matrix=world.to_3x3().inverted().transposed();normal_inv=world.to_3x3().transposed();verts=[];faces=[];normals=[];uvs=[[]for _ in uvnames];mat_indices=[];smooth=[];changed=0;removedArea=0.;originalArea=0.;retainedArea=0.
  def vertex(loop):
   p=world@old.vertices[old.loops[loop].vertex_index].co;n=(normal_matrix@old.corner_normals[loop].vector).normalized();d={'pos':[p.x,p.z,-p.y],'normal':[n.x,n.z,-n.y]}
   for k,layer in enumerate(old.uv_layers):d['uv'+str(k)]=list(layer.data[loop].uv)
   return d
  def append(poly,material,sm):
   ix=len(verts)
   for c in poly:
    p=c['pos'];local=inv@Vector((p[0],-p[2],p[1]));verts.append(tuple(local));n=c['normal'];ln=(normal_inv@Vector((n[0],-n[2],n[1]))).normalized();normals.append(tuple(ln))
    for k in range(len(uvnames)):uvs[k].append(c['uv'+str(k)])
   faces.append(tuple(range(ix,ix+len(poly))));mat_indices.append(material);smooth.append(sm)
  for polygon in old.polygons:
   loops=list(polygon.loop_indices);poly=[vertex(l)for l in loops];lo=[min(c['pos'][a]for c in poly)for a in range(3)];hi=[max(c['pos'][a]for c in poly)for a in range(3)];eligible=not(hi[0]<=roi['x'][0]or lo[0]>=roi['x'][1]or hi[2]<=roi['z'][0]or lo[2]>=roi['z'][1])
   if rule['scope']=='unique-trackbase-upper-plane':
    expected=rule['cachePlaneMain0Y'];n=(normal_matrix@polygon.normal).normalized();eligible=eligible and n.z>.9999 and all(abs(c['pos'][1]-expected)<2e-5 for c in poly)
   if not eligible:append(poly,polygon.material_index,polygon.use_smooth);continue
   own=[];keep=[]
   for tri in triangles_by_poly[polygon.index]:
    p=[vertex(i)for i in tri.loops];a,b=partition(p,roi);own+=a;keep+=b
   if not own:append(poly,polygon.material_index,polygon.use_smooth);continue
   changed+=1;oa=area(poly);ra=sum(area(p)for p in own);ka=sum(area(p)for p in keep);assert abs(oa-ra-ka)<max(1e-6,oa*1e-8),(name,oa,ra,ka);originalArea+=oa;removedArea+=ra;retainedArea+=ka
   for p in keep:append(p,polygon.material_index,polygon.use_smooth)
  assert changed>0,('No owned cachefloor faces found',name)
  mesh=bpy.data.meshes.new(old.name+' retained outside fresh enclosure receiver');mesh.from_pydata(verts,[],faces);mesh.update()
  for m in old.materials:mesh.materials.append(m)
  for p,mi,sm in zip(mesh.polygons,mat_indices,smooth):p.material_index=mi;p.use_smooth=sm
  for k,nameUV in enumerate(uvnames):
   layer=mesh.uv_layers.new(name=nameUV)
   for l,value in zip(layer.data,uvs[k]):l.uv=value
  mesh.normals_split_custom_set(normals);mesh.update();o.data=mesh
  removed_by_material[rule['sourceFamily']]+=removedArea;reports.append({'owner':name,'sourceFamily':rule['sourceFamily'],'oldFaces':len(old.polygons),'retainedFaces':len(mesh.polygons),'changedOldPolygons':changed,'removedActualAreaM2':removedArea,'retainedClippedAreaM2':retainedArea,'originalUVLayerNamesRetained':uvnames,'visibilityUnchanged':True,'originalWorldMatrixRetained':True,'cacheExpectedPlaneMain0Y':rule.get('cachePlaneMain0Y'),'runtimePlaneMain0Y':rule.get('runtimePlaneMain0Y'),'planeDifferenceQualified':rule.get('planeDifferenceQualification')})
 for material,expected in spec.get('expectedCacheAreaBySourceFamily',spec['expectedOwnedAreaBySourceFamily']).items():
  actual=removed_by_material[material];assert abs(actual-expected)<max(.01,expected*1e-5),('Cache/source floor footprint mismatch',material,actual,expected)
 return{'status':'PASS exact mapped cached-floor receiver membership removed before primary import','roi':roi,'objects':reports,'removedAreaBySourceFamily':dict(removed_by_material),'runtimeOwnedAreaBySourceFamily':spec['expectedOwnedAreaBySourceFamily'],'explicitCacheOnlyHiddenInterface':spec.get('explicitCacheOnlyHiddenInterface'),'otherCachedObjectsChanged':0,'newHiddenObjects':0,'newCapFaces':0,'clippingCore':'floor_clip.py sharedwithruntimepartition','qualification':'The trackbase cache usesitsown exact rawsourceupperplane; ~0.375mm runtimequantization difference recorded, not a raised runtime tolerance orheightmove. RuntimefloorP/N/UV0authority unchanged.'}
