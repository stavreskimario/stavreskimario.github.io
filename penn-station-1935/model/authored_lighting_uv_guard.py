"""External prototype guard for an already-authored UV1 lighting input.

Snapshots Blender's imported primary buffers before any material or neighbour
preparation. Preserve mode performs no join/weld/unwrap/normal restoration, and
requires these imported buffers and visibility values to remain byte-identical
before Cycles. The separate GLB UV-only proof covers the authoring file bytes.
"""
import hashlib,math
import bpy
import numpy as np

def _values(collection,field,width,dtype):
    a=np.empty(len(collection)*width,dtype=dtype);collection.foreach_get(field,a);return a

def _state(obj):
    m=obj.data
    fields={"positions":_values(m.vertices,"co",3,np.float32),
            "loopVertexIndices":_values(m.loops,"vertex_index",1,np.int32),
            "polygonLoopStarts":_values(m.polygons,"loop_start",1,np.int32),
            "polygonLoopCounts":_values(m.polygons,"loop_total",1,np.int32),
            "materialIndices":_values(m.polygons,"material_index",1,np.int32),
            "smoothFlags":_values(m.polygons,"use_smooth",1,np.bool_),
            "cornerNormals":_values(m.corner_normals,"vector",3,np.float32),
            "worldMatrix":np.array(obj.matrix_world,dtype=np.float32),
            "renderVisibility":np.array([obj.hide_render,obj.hide_viewport],dtype=np.bool_)}
    for i,uv in enumerate(m.uv_layers):fields[f"UV{i}"]=_values(uv.data,"uv",2,np.float32)
    return {k:hashlib.sha256(a.tobytes()).hexdigest()for k,a in fields.items()}

def snapshot_primary(objects):
    meshes=[o for o in objects if o.type=="MESH"]
    return {"objects":meshes,"states":{o.name:_state(o)for o in meshes}}

def verify_before_bake(snapshot,architecture,artifact_zone="arcade-enclosure"):
    if set(bpy.context.selected_objects)!={architecture} or bpy.context.view_layer.objects.active is not architecture:
        raise RuntimeError("Preserve-authored-UV1 requires exactly the architecture selected and active before baking")
    failures=[]
    for o in snapshot["objects"]:
        actual=_state(o);expected=snapshot["states"][o.name]
        for key in set(actual)|set(expected):
            if actual.get(key)!=expected.get(key):failures.append({"object":o.name,"buffer":key})
    if failures:raise RuntimeError("Preserve-authored-UV1 modified imported primary buffers: "+str(failures[:10]))
    m=architecture.data
    if len(m.uv_layers)!=2:raise RuntimeError("Preserve-authored-UV1 requires exactly two architecture UV sets")
    uv=_values(m.uv_layers[1].data,"uv",2,np.float32)
    if not np.isfinite(uv).all()or uv.min()<-1e-6 or uv.max()>1+1e-6:raise RuntimeError("Authored UV1 exceeds its single atlas tile")
    normals=_values(m.corner_normals,"vector",3,np.float32).reshape(-1,3);length=np.linalg.norm(normals,axis=1)
    if not np.isfinite(normals).all()or np.max(np.abs(length-1))>1e-4:raise RuntimeError("Invalid preserved authored corner normal")
    face=_values(m.polygons,"normal",3,np.float32).reshape(-1,3);counts=_values(m.polygons,"loop_total",1,np.int32);dots=np.sum(normals*np.repeat(face,counts,axis=0),axis=1);negative=int((dots<-.0002).sum())
    normal_report={"schema":1,"status":"PASS","scope":artifact_zone+" imported authored normals retained without topology or normal operations","method":"unchanged-imported-corner-buffers","sourceObjects":1,"sourceCorners":len(m.loops),"restoredCorners":len(m.loops),"sourceNegativeHemisphereCorners":negative,"restoredNegativeHemisphereCorners":negative,"sourceMinimumFaceAlignment":float(dots.min()),"restoredMinimumFaceAlignment":float(dots.min()),"minimumRestoredSourceNormalDot":1.0,"maxEncodingAngleDegrees":0.0,"maxAllowedEncodingAngleDegrees":.5,"finiteUnitNormals":True,"temporaryAttributeRemoved":True}
    report={"schema":1,"status":"PASS","mode":"preserve-authored-uv1","primaryMeshObjects":len(snapshot["objects"]),"allImportedPrimaryBuffersByteExactBeforeBake":True,"onlyArchitectureSelectedAndActiveBeforeBake":True,"uv1Layer":m.uv_layers[1].name,"uv1Range":[float(uv.min()),float(uv.max())],"preservedBufferHashes":snapshot["states"],"scope":"Post-import buffers including geometry, every UV, normals, material indices, smoothing, matrices and render/viewport visibility. Source GLB byte preservation is proven separately."}
    return report,normal_report
