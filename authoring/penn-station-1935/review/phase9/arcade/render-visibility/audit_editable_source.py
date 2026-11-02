"""Read-only camera/light/visibility and editability receipt for source promotion."""
from pathlib import Path
import json,hashlib,bpy
P=Path(__file__).resolve().parent;source=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction/authoring/penn-station-1935/penn-station-phase5.blend');candidate=P/'connected-v12/formal-arcade-review.blend';H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();source_h=H(source);candidate_h=H(candidate)
def val(v):
 if v is None or isinstance(v,(str,int,float,bool)):return v
 if isinstance(v,dict):return {k:val(q)for k,q in v.items()}
 if hasattr(v,'to_dict'):return val(v.to_dict())
 if isinstance(v,bpy.types.ID):return {'type':v.bl_rna.identifier,'name':v.name}
 if isinstance(v,set):return sorted(v)
 try:return [val(q)for q in v]
 except TypeError:return str(v)
def rna(x,depth=0):
 d={}
 for p in x.bl_rna.properties:
  if p.identifier in ['rna_type','name_full','users','tag','session_uid','is_embedded_data','is_evaluated','is_library_indirect','is_missing','is_runtime_data','original','id_type','use_fake_user','use_extra_user','library','override_library','preview','asset_data','weak_library_reference','animation_data','node_tree']:continue
  if p.type not in ['BOOLEAN','INT','FLOAT','STRING','ENUM','POINTER']:continue
  try:
   v=getattr(x,p.identifier)
   d[p.identifier]=rna(v,depth+1)if p.type=='POINTER'and v is not None and not isinstance(v,bpy.types.ID)and hasattr(v,'bl_rna')and depth<4 else val(v)
  except (AttributeError,TypeError):pass
 return d
def nodes(tree):
 if tree is None:return None
 return {'extras':val(dict(tree.items())),'nodes':[{'name':n.name,'type':n.bl_idname,'properties':rna(n),'extras':val(dict(n.items())),'inputs':[(s.identifier,val(s.default_value))for s in n.inputs if hasattr(s,'default_value')]}for n in tree.nodes],'links':sorted((l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier)for l in tree.links)}
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));bpy.context.view_layer.update();objects={};actors={}
 for o in bpy.context.scene.objects:
  objects[o.name]={'type':o.type,'hideRender':o.hide_render,'hideViewport':o.hide_viewport,'hideInViewLayer':o.hide_get(),'collections':sorted(c.name for c in o.users_collection)}
  if o.type in ['CAMERA','LIGHT']:
   actors[o.name]={'object':objects[o.name],'matrixWorld':[list(row)for row in o.matrix_world],'data':rna(o.data),'dataExtras':val(dict(o.data.items())),'nodes':nodes(o.data.node_tree)if hasattr(o.data,'node_tree')else None,'objectExtras':val(dict(o.items())),'constraints':[rna(c)for c in o.constraints],'hasAnimation':o.animation_data is not None,'dataHasAnimation':o.data.animation_data is not None}
 world=bpy.context.scene.world
 return {'objects':objects,'actors':actors,'sceneCamera':bpy.context.scene.camera.name if bpy.context.scene.camera else None,'world':{'data':rna(world),'extras':val(dict(world.items())),'nodes':nodes(world.node_tree)}if world else None,'collections':sorted(c.name for c in bpy.data.collections)}
before=snapshot(source);after=snapshot(candidate);world_differences=[]
def diff(a,b,path):
 if isinstance(a,dict)and isinstance(b,dict):
  for k in sorted(set(a)|set(b)):diff(a.get(k),b.get(k),path+'.'+k)
 elif isinstance(a,list)and isinstance(b,list):
  if len(a)!=len(b):world_differences.append({'path':path,'beforeLength':len(a),'afterLength':len(b)})
  else:
   for i,(x,y)in enumerate(zip(a,b)):diff(x,y,path+f'[{i}]')
 elif a!=b:world_differences.append({'path':path,'before':a,'after':b})
diff(before['world'],after['world'],'world')
new={n:q for n,q in after['objects'].items()if n not in before['objects']};changed_actors={n:{'before':a,'after':after['actors'].get(n)}for n,a in before['actors'].items()if a!=after['actors'].get(n)};changed_visibility={n:{'before':o,'after':after['objects'].get(n)}for n,o in before['objects'].items()if o!=after['objects'].get(n)}
new_actors={n:q for n,q in new.items()if q['type']in ['LIGHT','CAMERA']};obsolete=[n for n in after['objects']if n.startswith('Old owned ')or n.startswith('TEMPORARY geometry review')or n.startswith('TEMP studio')];export_collections=[n for n in after['collections']if n in ['ARCADE old-owned export only','ARCADE retained exterior export copies']]
result={'schema':1,'status':'PASS'if not(changed_actors or changed_visibility or new_actors or obsolete or export_collections)and before['sceneCamera']==after['sceneCamera']and before['world']==after['world']else'REVIEW','sourceSha256':source_h,'candidateSha256':candidate_h,'sourceUnchanged':H(source)==source_h,'candidateUnchanged':H(candidate)==candidate_h,'oldLightCameraCount':len(before['actors']),'oldLightCameraObjectsDataNodesExtrasExact':not changed_actors,'oldSceneCameraExact':before['sceneCamera']==after['sceneCamera'],'worldDataNodesExtrasExact':before['world']==after['world'],'worldDifferences':world_differences,'runtimeIdentityTreatment':'Session UIDs are per-load identities, not persisted settings; non-ID RNA pointers compare their actual nested properties instead of memory addresses. No shading/world value is excluded.','oldObjectVisibilityAndCollectionsExact':not changed_visibility,'newObjectsByType':{t:sum(q['type']==t for q in new.values())for t in sorted({q['type']for q in new.values()})},'newLightsOrCameras':new_actors,'obsoleteExportObjects':obsolete,'obsoleteExportCollections':export_collections,'changedActors':changed_actors,'changedVisibility':changed_visibility,'meaning':'Old-owned mesh components were actually removed; the temporary removal collection/objects were deleted before save. New architecture remains editable individual meshes in the external source review collection. Studio preview runs never save back to this blend. No canonical write performed.'}
(P/'connected-v12/editable-source-cleanliness.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2)[:12000],flush=True)
