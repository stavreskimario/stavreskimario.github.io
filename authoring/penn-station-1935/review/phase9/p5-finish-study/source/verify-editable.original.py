"""Reopen frozen curved blends using CPU I/O; never render or save."""
from pathlib import Path
import ast,hashlib,json
import bpy,numpy as np
D=Path(__file__).resolve().parent;C=D/'candidate-v3-material-fixed';F=D.parent/'arrivals-p5-finish-study-v1';H=lambda b:hashlib.sha256(b).hexdigest();m=json.loads((C/'curve-study-manifest.json').read_text());ns={'np':np,'H':H,'json':json}
for node in ast.parse((F/'build_study.py').read_text()).body:
 if isinstance(node,ast.FunctionDef)and node.name in {'safe_props','value_array','source_state','material_state'}:exec(compile(ast.Module(body=[node],type_ignores=[]),str(F/'build_study.py'),'exec'),ns)
owned={r['node']for r in m['ownedRailChanges']};haunches={r['name']for r in m['haunches']};bpy.context.preferences.filepaths.use_scripts_auto_execute=False
flat=F/'candidate-v2/editable.blend';assert H(flat.read_bytes())=='d33f8381f88228f86b431f4017d8cad10dceef5f6e62054084fbc96e245b7cf6';bpy.ops.wm.open_mainfile(filepath=str(flat));source={o.name:ns['source_state'](o)for o in bpy.context.scene.objects if o.name not in owned};mats={v for o in bpy.context.scene.objects for v in o.data.materials if v};source_mats={v.name:ns['material_state'](v)for v in mats};assert source==m['nonownedImportedSourceHashes'];rows=[]
for file in ['editable-curves.blend','addon-curves.blend']:
 p=C/file;pin=H(p.read_bytes());assert pin==m['artifacts'][file]['sha256'];bpy.ops.wm.open_mainfile(filepath=str(p));scenes=[s for s in bpy.data.scenes if set(o.name for o in s.objects)>=owned|haunches];assert len(scenes)==1;scene=scenes[0];curves=[o for o in scene.objects if o.name in owned];assert len(curves)==6 and all(o.type=='CURVE'for o in curves);assert all(len(o.modifiers)==1 and o.modifiers[0].type=='NODES'for o in curves)
 for o in curves:
  g=o.modifiers[0].node_group;types={n.bl_idname for n in g.nodes};assert {'GeometryNodeCurvePrimitiveCircle','GeometryNodeCurveToMesh'}<=types;circle=next(n for n in g.nodes if n.bl_idname=='GeometryNodeCurvePrimitiveCircle');assert abs(circle.inputs['Radius'].default_value-.026)<1e-8 and circle.inputs['Resolution'].default_value==32;assert next(n for n in g.nodes if n.bl_idname=='GeometryNodeCurveToMesh').inputs['Fill Caps'].default_value;materialnode=next(n for n in g.nodes if n.bl_idname=='GeometryNodeSetMaterial');assert materialnode.inputs['Material'].default_value==bpy.data.materials['PaintedStructuralIronArrivalsGuard']
  assert all(s.type=='BEZIER'for s in o.data.splines)
  bpy.context.window.scene=scene;deps=bpy.context.evaluated_depsgraph_get();mesh=bpy.data.meshes.new_from_object(o.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps);assert mesh.polygons;actual_names={mesh.materials[p.material_index].name if p.material_index<len(mesh.materials)and mesh.materials[p.material_index]else None for p in mesh.polygons};assert actual_names=={'PaintedStructuralIronArrivalsGuard'},(o.name,actual_names);bpy.data.meshes.remove(mesh)
 row={'file':file,'sha256':pin,'sceneObjects':len(scene.objects),'editableBezierCurves':6,'haunchMeshes':2,'circleRadiusM':.026,'profileResolution':32,'geometryNodesCurveToMesh':True,'evaluatedRailFacesUseExistingGuardMaterial':True}
 if file.startswith('editable'):
  assert len(scene.objects)==4063;actual={o.name:ns['source_state'](o)for o in scene.objects if o.name not in owned|haunches};assert actual==source
  mats={v for o in scene.objects for v in o.data.materials if v};assert {v.name:ns['material_state'](v)for v in mats}==source_mats;row.update({'all4055NonownedStatesExact':True,'allSourceMaterialStatesExact':True})
 else:assert len(scene.objects)==8 and len(bpy.data.materials)==2
 assert H(p.read_bytes())==pin;row['frozenFileUnchanged']=True;rows.append(row)
out=D/'blends-reopen-v3.json';assert not out.exists();out.write_text(json.dumps({'status':'PASS','rows':rows,'noRenderingSavingGPU':True,'generatorSha256':H(Path(__file__).read_bytes())},indent=2)+'\n');print(out)
