"""Read-only canonical/curved-study compatibility inspection. No saves/exports/rendering."""
from pathlib import Path
import hashlib,json,struct,ast
import bpy,numpy as np
D=Path(__file__).resolve().parent;W=D.parent;R=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
canonical=R/'authoring/penn-station-1935/penn-station-phase5.blend';C=W/'arrivals-p5-curvature-study-v1/candidate-v3-material-fixed';rawbase=W.parent/'phase7-arrivals/candidate-eight-v1/arrivals-module.glb';flat=W/'arrivals-p5-finish-study-v1/candidate-v2/study-manifest.json';cm=json.loads((C/'curve-study-manifest.json').read_text());fm=json.loads(flat.read_text());owned=[x['node']for x in cm['ownedRailChanges']];new=[x['name']for x in fm['skins']]+[x['name']for x in cm['haunches']];assert len(owned)==6 and len(new)==16
assert H(canonical)=='c4aa88af40c449bb111a7e3d9d41a9b071bde2205a6d0c2525f25c5d00815fcc';assert H(rawbase)=='ba0969961ed97c854742e86c43fd16326f142f8e4289b3acd55acb8a910f58cc';assert H(C/'west-p5-curved-study.glb')=='024e8cff461f7cdb1080652412e52b210495fdaf1d4e1d75945dcce6f4f6d98f'
b=rawbase.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);buf=memoryview(b)[28+n:];rawnodes={x['name']:x for x in j['nodes']}
def pos(name):
 node=rawnodes[name];assert not any(k in node for k in ['matrix','translation','rotation','scale']);out=[]
 for p in j['meshes'][node['mesh']]['primitives']:
  a=j['accessors'][p['attributes']['POSITION']];v=j['bufferViews'][a['bufferView']];assert a['componentType']==5126;out.append(np.ndarray((a['count'],3),'<f4',buf,v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4)))
 return np.unique(np.concatenate(out),axis=0).astype(float)
ns={'np':np,'H':lambda b:hashlib.sha256(b).hexdigest(),'json':json}
for a in ast.parse((W/'arrivals-p5-finish-study-v1/build_study.py').read_text()).body:
 if isinstance(a,ast.FunctionDef)and a.name in {'safe_props','material_state'}:exec(compile(ast.Module(body=[a],type_ignores=[]),'<reviewed-helper>','exec'),ns)
def material(m):
 p=m.node_tree.nodes.get('Principled BSDF')if m.use_nodes else None
 return {'name':m.name,'graphSha256':ns['material_state'](m),'principled':{k:list(p.inputs[k].default_value)if hasattr(p.inputs[k].default_value,'__len__')else float(p.inputs[k].default_value)for k in ['Base Color','Roughness','Metallic','Transmission Weight','IOR']if p and p.inputs.get(k)}}
def objectrow(o):
 return {'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'worldMatrixBlender':[[float(x)for x in row]for row in o.matrix_world],'collections':[c.name for c in o.users_collection],'materials':[m.name if m else None for m in o.data.materials],'properties':{k:ns['safe_props'](o[k])for k in o.keys()}}
bpy.context.preferences.filepaths.use_scripts_auto_execute=False;bpy.ops.wm.open_mainfile(filepath=str(canonical));bpy.context.view_layer.update();scene=bpy.context.scene;assert all(name in scene.objects for name in owned);assert not any(name in bpy.data.objects for name in new);canonicalrows=[]
for name in owned:
 o=scene.objects[name];assert o.type=='MESH' and not o.parent;v=np.unique(np.array([[*(o.matrix_world@x.co)]for x in o.data.vertices],float),axis=0);v=np.column_stack([v[:,0],v[:,2]+4.2672,-v[:,1]]);p=pos(name);v=v[np.lexsort(v.T[::-1])];p=p[np.lexsort(p.T[::-1])];assert v.shape==p.shape;res=float(np.max(np.abs(v-p)));assert res<1e-6;row=objectrow(o);row.update({'oldSourceUniqueVertices':len(p),'worldStreet0ToRawMain0MaxResidualM':res,'sourceMeshVertices':len(o.data.vertices),'sourcePolygons':len(o.data.polygons),'modifierCount':len(o.modifiers)});canonicalrows.append(row)
matnames=['PaintedStructuralIronArrivalsGuard','PaintedStructuralIronArrivalsStructure'];canonicalmats={name:material(bpy.data.materials[name])for name in matnames};allrawnames=set(rawnodes);allrawpresent=all(name in scene.objects for name in allrawnames);assert allrawpresent;canonicalscene={'name':scene.name,'sceneObjects':len(scene.objects),'all4047OriginalRawNodeNamesPresent':allrawpresent,'sixOwned':canonicalrows,'new16NamesAbsent':True,'materials':canonicalmats}
bpy.ops.wm.open_mainfile(filepath=str(C/'editable-curves.blend'));bpy.context.view_layer.update();scene=bpy.context.scene;studymats={name:material(bpy.data.materials[name])for name in matnames};studyrows=[]
for name in owned+new:
 o=scene.objects[name];row=objectrow(o)
 if name in owned:
  assert o.type=='CURVE' and not o.parent;assert all(abs(float(o.matrix_world[i][k])-(1 if i==k else 0))<1e-12 for i in range(4)for k in range(4));g=o.modifiers[0].node_group;row['geometryNodes']=[n.bl_idname for n in g.nodes];row['setMaterial']=next(n for n in g.nodes if n.bl_idname=='GeometryNodeSetMaterial').inputs['Material'].default_value.name
 studyrows.append(row)
for name in matnames:assert canonicalmats[name]['principled']==studymats[name]['principled']
assert H(canonical)=='c4aa88af40c449bb111a7e3d9d41a9b071bde2205a6d0c2525f25c5d00815fcc';assert H(C/'editable-curves.blend')==cm['artifacts']['editable-curves.blend']['sha256']
report={'schema':1,'status':'PASS read-only compatibility observations; no integration performed','canonical':canonicalscene,'study':{'sixOwnedPlus16New':studyrows,'materials':studymats},'frames':{'canonical':'Blender Street0: X east,Y north,Z up','study':'Blender Main0: X east,Y north,Z up','studyToCanonicalBlenderTranslation':[0,0,-4.2672],'gltfMainToStreetTranslation':[0,-4.2672,0],'observedCanonicalBlenderZOffset':[r['worldMatrixBlender'][2][3]for r in canonicalrows],'maximumOldRailSourceResidualM':max(r['worldStreet0ToRawMain0MaxResidualM']for r in canonicalrows)},'materialScalarValuesMatchExactly':True,'sourceInputsUnchanged':True,'performed':{'save':False,'export':False,'render':False,'GPU':False,'rootWrites':False},'pins':{str(p):{'sha256':H(p),'bytes':p.stat().st_size}for p in [canonical,C/'editable-curves.blend',C/'west-p5-curved-study.glb',C/'curve-study-manifest.json',flat,rawbase,Path(__file__)]}}
(D/'actual-source-inspection.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':report['status'],'canonicalSceneObjects':canonicalscene['sceneObjects'],'frames':report['frames'],'materialScalarValuesMatchExactly':True,'output':str(D/'actual-source-inspection.json')},indent=2))
