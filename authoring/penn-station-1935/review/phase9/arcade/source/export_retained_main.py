"""Scalar shadow-context export from external connected candidate, no saves."""
from pathlib import Path
import argparse,hashlib,json
import bpy
ap=argparse.ArgumentParser();ap.add_argument('--candidate',type=Path,required=True);a=ap.parse_args();P=a.candidate;source=P/'formal-arcade-review.blend';H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=H(source)
bpy.ops.wm.open_mainfile(filepath=str(source));coll=bpy.data.collections['02 Main waiting room'];objects=[o for o in coll.all_objects if o.type in ['MESH','FONT']]
material_map={};renamed={}
for o in objects:
 for m in o.data.materials:
  if m and m not in renamed:renamed[m]=m.name;m.name='TEMP_MAIN_CONTEXT_'+m.name
for old,name in renamed.items():
 m=bpy.data.materials.new(name);m.use_nodes=True;src=old.node_tree.nodes.get('Principled BSDF')if old.use_nodes else None;dest=m.node_tree.nodes.get('Principled BSDF')
 if src:
  for key in ['Base Color','Roughness','Metallic','Transmission Weight','IOR']:
   if src.inputs.get(key):dest.inputs[key].default_value=src.inputs[key].default_value
 material_map[old]=m
bpy.ops.object.select_all(action='DESELECT');copied=[]
for o in objects:
 p=o.copy();p.data=o.data.copy();bpy.context.scene.collection.objects.link(p);p.parent=None;p.matrix_world=o.matrix_world.copy();p.matrix_world.translation.z+=4.2672
 slots=list(p.data.materials);p.data.materials.clear()
 for m in slots:p.data.materials.append(material_map[m]if m else None)
 p.select_set(True);p.hide_viewport=False;copied.append(p)
bpy.context.view_layer.objects.active=copied[0];bpy.context.view_layer.update();target=P/'retained-main-occluder-main0.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_extras=True)
assert H(source)==before
(P/'retained-main-export-proof.json').write_text(json.dumps({'sourceBlendSha256':before,'output':target.name,'bytes':target.stat().st_size,'sha256':H(target),'frame':'glTF Main0. Add world Y=-4.2672 to place at street0. Original object world transforms translated +4.2672 only on export copies.','contains':'Retained Main-room source meshes after exact owned backing/ashlar removal. No new arcade replacements, no original blocking headers.','materials':'Original names, scalar shadow properties; no reference texture embedding.','canonicalOrExternalBlendSaved':False},indent=2)+'\n')
