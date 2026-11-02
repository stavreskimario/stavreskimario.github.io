"""Restore proven source visibility after Blender imports a visible context.

Blender4.3 can import orphan GLTF nodes even after scene-root unlinking. Call
after applying the recorded street/Main frame offset; no mesh data is edited.
"""
from pathlib import Path
import hashlib,json
from mathutils import Vector

def restore_source_render_visibility(imported_objects,context_path,proof_path,frame_offset_z=0):
 context_path=Path(context_path);proof=json.loads(Path(proof_path).read_text());matches=[r for r in proof['files']if r['output']==context_path.name]
 if not matches:return {'context':context_path.name,'sourceVisibilityRule':None,'changedObjects':[]}
 assert len(matches)==1;rule=matches[0];assert hashlib.sha256(context_path.read_bytes()).hexdigest()==rule['outputSha256'];assert rule['sourceHideRender']is True
 objects=list(imported_objects);found=[o for o in objects if o.name==rule['excludedNodeName']];assert len(found)<=1
 if not found:return {'context':context_path.name,'sourceVisibilityRule':rule['excludedNodeName'],'alreadyExcludedByImporter':True,'changedObjects':[]}
 obj=found[0];bounds=[obj.matrix_world@Vector(q)for q in obj.bound_box];actual=[[min(q[i]for q in bounds)for i in range(3)],[max(q[i]for q in bounds)for i in range(3)]];expected=[[value+(frame_offset_z if k==2 else 0)for k,value in enumerate(corner)]for corner in rule['sourceWorldBounds']];error=max(abs(actual[i][k]-expected[i][k])for i in range(2)for k in range(3));assert error<2e-5,(obj.name,actual,expected)
 before={'matrix':tuple(tuple(row)for row in obj.matrix_world),'dataPointer':obj.data.as_pointer(),'materials':tuple(m.as_pointer()if m else None for m in obj.data.materials),'hide_render':obj.hide_render}
 obj.hide_render=True
 assert before['matrix']==tuple(tuple(row)for row in obj.matrix_world)and before['dataPointer']==obj.data.as_pointer()and before['materials']==tuple(m.as_pointer()if m else None for m in obj.data.materials)
 return {'context':context_path.name,'sourceVisibilityRule':rule['excludedNodeName'],'alreadyExcludedByImporter':False,'changedObjects':[{'name':obj.name,'hideRenderBefore':before['hide_render'],'hideRenderAfter':True,'sourceHideRender':True,'actualWorldBounds':actual,'sourceStreet0Bounds':rule['sourceWorldBounds'],'expectedBakeFrameBounds':expected,'sourceToBakeFrameOffsetZ':frame_offset_z,'boundErrorM':error,'meshMaterialAndMatrixExact':True}]}
