"""Apply the established library only to actual imported neighbour resources."""
import hashlib,json
from pathlib import Path
import bpy,numpy as np
from material_library import prepare_surface_uvs,apply_materials

def _value(v):
    if v is None or isinstance(v,(str,int,float,bool)):return v
    try:return [_value(x)for x in v]
    except TypeError:return str(v)

def _props(x):return {k:_value(x[k])for k in x.keys()}

def material_fingerprint(material):
    result={'name':material.name,'diffuse':list(material.diffuse_color),'metallic':material.metallic,'roughness':material.roughness,'backfaceCulling':material.use_backface_culling,'custom':_props(material),'nodes':[],'links':[]}
    if material.use_nodes:
        for node in material.node_tree.nodes:
            r={'name':node.name,'type':node.bl_idname,'custom':_props(node),'inputs':{socket.identifier:_value(socket.default_value)for socket in node.inputs if hasattr(socket,'default_value')}}
            for field in ['uv_map','operation','blend_type','use_clamp','interpolation','projection','extension','space','distribution','subsurface_method','mute']:
                if hasattr(node,field):r[field]=_value(getattr(node,field))
            if hasattr(node,'node_tree')and node.node_tree:r['group']=node.node_tree.name
            if hasattr(node,'image')and node.image:
                image=node.image;r['image']={'name':image.name,'filepath':image.filepath,'source':image.source,'alphaMode':image.alpha_mode,'colourSpace':image.colorspace_settings.name,'size':list(image.size),'packedSha256':hashlib.sha256(bytes(image.packed_file.data)).hexdigest()if image.packed_file else None}
            result['nodes'].append(r)
        result['links']=sorted((l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier)for l in material.node_tree.links)
    return hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()

def uv0_fingerprint(mesh):
    if not mesh.uv_layers:return None
    values=np.empty(len(mesh.loops)*2,dtype=np.float32);mesh.uv_layers[0].data.foreach_get('uv',values);return hashlib.sha256(values.tobytes()).hexdigest()

def apply_occluder_materials(primary_objects,imported_occluder_objects,library):
    primary_meshes={o.data for o in primary_objects if o.type=='MESH'}
    primary_materials={m for mesh in primary_meshes for m in mesh.materials if m}
    objects=[o for o in imported_occluder_objects if o.type=='MESH']
    meshes={o.data for o in objects};materials={m for mesh in meshes for m in mesh.materials if m}
    if meshes&primary_meshes:raise RuntimeError('Neighbour material preparation aliases primary mesh data')
    if materials&primary_materials:raise RuntimeError('Neighbour material preparation aliases a primary material pointer')
    primary_before={m.name:material_fingerprint(m)for m in primary_materials}
    before={m.name:material_fingerprint(m)for m in materials};uv_before={mesh.name:uv0_fingerprint(mesh)for mesh in meshes}
    prepare_surface_uvs(objects)
    profiles=apply_materials(sorted(materials,key=lambda m:m.name),Path(library))
    primary_after={m.name:material_fingerprint(m)for m in primary_materials}
    if primary_before!=primary_after:raise RuntimeError('Neighbour preparation changed primary PBR nodes, packed images or image properties')
    changed=[m.name for m in materials if before[m.name]!=material_fingerprint(m)]
    uv_changed=[mesh.name for mesh in meshes if uv_before[mesh.name]!=uv0_fingerprint(mesh)]
    report={'schema':1,'status':'PASS','scope':'Established library applied only to actual imported neighbour objects/material pointers; primary meshes/materials excluded','libraryPath':str(Path(library).resolve()),'primaryMaterialCount':len(primary_materials),'uniqueOccluderMaterials':len(materials),'uniqueOccluderMeshData':len(meshes),'occluderObjects':len(objects),'primaryAndOccluderMeshPointerIntersection':0,'primaryAndOccluderMaterialPointerIntersection':0,'primaryMaterialGraphsPackedImagesAndPropertiesExact':True,'primaryMaterialBeforeHashes':primary_before,'primaryMaterialAfterHashes':primary_after,'neighbourMaterialGraphsChanged':sorted(changed),'neighbourUV0MeshDataChangedCount':len(uv_changed),'neighbourProfileMaterials':[p['material']for p in profiles]}
    return profiles,report
