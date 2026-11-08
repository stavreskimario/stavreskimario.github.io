"""External P5 appearance study. CPU geometry/import/export only; no rendering.

All original glTF bytes/bindings remain authoritative. Blender imports that
source for editability, adds14 inferred skins in vacant host recesses, exports
only those skins, then a binary-prefix append preserves every source buffer.
No source object is remeshed, re-unwrapped, reshaped or hidden.
"""
from pathlib import Path
from collections import Counter,defaultdict
import argparse,copy,hashlib,json,math,struct,time
import bpy
import numpy as np
from mathutils import Vector,Matrix

SOURCE_SHA='024e8cff461f7cdb1080652412e52b210495fdaf1d4e1d75945dcce6f4f6d98f'
EXPECTED_PROPOSAL='30ffdc921be47f385faba6ebfbadbff20570d9ca75ca1ac957836010cd351ba5'
MATERIAL='PaintedStructuralIronArrivalsStructure'
THICKNESS=.008
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--proposal',type=Path,required=True)
parser.add_argument('--source-proof',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
a=parser.parse_args();assert not a.out.exists(),'Use a fresh artifact directory';a.out.mkdir(parents=True)
H=lambda value:hashlib.sha256(value).hexdigest()
original=a.source.read_bytes();assert H(original)==SOURCE_SHA
assert H(a.proposal.read_bytes())==EXPECTED_PROPOSAL
proposal=json.loads(a.proposal.read_text());source_proof=json.loads(a.source_proof.read_text());started=time.monotonic()

def parse_glb(data):
    magic,version,total=struct.unpack_from('<III',data);assert magic==0x46546c67 and version==2 and total==len(data)
    n,kind=struct.unpack_from('<II',data,12);assert kind==0x4e4f534a;j=json.loads(data[20:20+n]);size,kind=struct.unpack_from('<II',data,20+n);assert kind==0x004e4942
    return j,data[28+n:28+n+size]

j,binary=parse_glb(original);assert len(j['buffers'])==1
TYPES={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(index):
    r=j['accessors'][index];v=j['bufferViews'][r['bufferView']];dtype=np.dtype(TYPES[r['componentType']]);width=WIDTH[r['type']]
    assert not r.get('normalized')and'sparse'not in r
    return np.ndarray((r['count'],width),dtype,binary,v.get('byteOffset',0)+r.get('byteOffset',0),strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize))

def matrix(node):
    if'matrix'in node:return np.array(node['matrix'],dtype=float).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1]);r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])*np.array(node.get('scale',[1,1,1]));m=np.eye(4);m[:3,:3]=r;m[:3,3]=node.get('translation',[0,0,0]);return m

source_nodes={};world_matrices={}
def walk(index,parent):
    node=j['nodes'][index];m=parent@matrix(node);world_matrices[index]=m
    if'mesh'in node:
        points=np.concatenate([accessor(p['attributes']['POSITION'])for p in j['meshes'][node['mesh']]['primitives']]);points=points@m[:3,:3].T+m[:3,3]
        source_nodes[node['name']]={'index':index,'node':node,'points':np.unique(points,axis=0),'bounds':np.array([points.min(axis=0),points.max(axis=0)]),'matrix':m}
    for child in node.get('children',[]):walk(child,m)
for root in j['scenes'][j.get('scene',0)]['nodes']:walk(root,np.eye(4))
assert len(source_nodes)==4063

def pick(prefix,contains=None):
    found=[r for name,r in source_nodes.items()if name.startswith(prefix)and(contains is None or contains in name)]
    assert found,(prefix,contains)
    return found

def vec(p):return Vector((float(p[0]),-float(p[2]),float(p[1])))
def gltf_vec(p):return [float(p[0]),float(p[2]),-float(p[1])]

def value_array(collection,field,width,dtype):
    result=np.empty(len(collection)*width,dtype=dtype);collection.foreach_get(field,result);return result

def source_state(obj):
    mesh=obj.data
    fields={'vertices':value_array(mesh.vertices,'co',3,np.float32),'loopVertexIndices':value_array(mesh.loops,'vertex_index',1,np.int32),'polygonLoopStart':value_array(mesh.polygons,'loop_start',1,np.int32),'polygonLoopTotal':value_array(mesh.polygons,'loop_total',1,np.int32),'materialIndices':value_array(mesh.polygons,'material_index',1,np.int32),'smoothFlags':value_array(mesh.polygons,'use_smooth',1,np.bool_),'cornerNormals':value_array(mesh.corner_normals,'vector',3,np.float32),'worldMatrix':np.array(obj.matrix_world,dtype=np.float64),'visibility':np.array([obj.hide_render,obj.hide_viewport],dtype=np.bool_)}
    for index,uv in enumerate(mesh.uv_layers):fields['UV'+str(index)]=value_array(uv.data,'uv',2,np.float32)
    return {'fields':{k:H(v.tobytes())for k,v in fields.items()},'materials':[m.name if m else None for m in mesh.materials],'objectProperties':{k:safe_props(obj[k])for k in obj.keys()},'meshProperties':{k:safe_props(mesh[k])for k in mesh.keys()}}

def safe_props(value):
    if value is None or isinstance(value,(str,bool,int,float)):return value
    try:return [safe_props(x)for x in value]
    except TypeError:return str(value)

def material_state(material):
    nodes=[];links=[]
    if material.use_nodes:
        for node in material.node_tree.nodes:
            record={'name':node.name,'type':node.bl_idname,'inputs':{s.identifier:safe_props(s.default_value)for s in node.inputs if hasattr(s,'default_value')}}
            if hasattr(node,'image')and node.image:record['image']={'name':node.image.name,'packed':H(bytes(node.image.packed_file.data))if node.image.packed_file else None,'colourSpace':node.image.colorspace_settings.name}
            for field in ['uv_map','operation','blend_type','interpolation','projection','extension','space','mute']:
                if hasattr(node,field):record[field]=safe_props(getattr(node,field))
            nodes.append(record)
        links=sorted((l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier)for l in material.node_tree.links)
    return H(json.dumps({'name':material.name,'properties':{k:safe_props(material[k])for k in material.keys()},'diffuse':list(material.diffuse_color),'metallic':material.metallic,'roughness':material.roughness,'cull':material.use_backface_culling,'nodes':nodes,'links':links},sort_keys=True).encode())

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.source.resolve()))
scene=bpy.context.scene;source_objects=[o for o in scene.objects if o.type=='MESH'];assert len(source_objects)==4063
assert {o.name for o in source_objects}==set(source_nodes)
imported_before={o.name:source_state(o)for o in source_objects};source_materials={m for o in source_objects for m in o.data.materials if m};materials_before={m.name:material_state(m)for m in source_materials}
metal=bpy.data.materials.get(MATERIAL);assert metal and metal in source_materials
skin_collection=bpy.data.collections.new('P5 inferred finish faces — external study only');scene.collection.children.link(skin_collection)
skins=[];records=[]

BOX_F=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]

def box_vertices(low,high):
    low=np.asarray(low,float);high=np.asarray(high,float)
    return [[float(high[k]if corner[k]else low[k])for k in range(3)]for corner in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]]

def signed_volume(vertices,faces):
    v=np.asarray(vertices,float);c=v.mean(axis=0)
    return sum(float(np.dot(v[f[0]]-c,np.cross(v[f[k]]-c,v[f[k+1]]-c)))/6 for f in faces for k in range(1,len(f)-1))

def geometric_components(vertices,faces):
    # These new meshes use shared exact vertex indices; no tolerance welding.
    edges=Counter(tuple(sorted((f[i],f[(i+1)%len(f)])))for f in faces for i in range(len(f)));assert all(n==2 for n in edges.values()),'New skin must be closed'
    adjacency=defaultdict(set)
    for edge in edges:adjacency[edge[0]].add(edge[1]);adjacency[edge[1]].add(edge[0])
    unseen=set(range(len(vertices)));components=[]
    while unseen:
        root=unseen.pop();seen={root};stack=[root]
        while stack:
            for other in adjacency[stack.pop()]:
                if other in unseen:unseen.remove(other);seen.add(other);stack.append(other)
        f=[face for face in faces if face[0]in seen];vol=signed_volume(vertices,f);assert vol>1e-10,('Nonpositive new skin component',vol);components.append({'vertices':len(seen),'faces':len(f),'volumeM3':vol})
    return components

def contact(host,kind,polygon,normal):
    polygon=np.asarray(polygon,dtype=float);normal=np.asarray(normal,dtype=float);normal/=np.linalg.norm(normal)
    area=sum(np.linalg.norm(np.cross(polygon[i]-polygon[0],polygon[i+1]-polygon[0]))*.5 for i in range(1,len(polygon)-1))
    assert area>1e-7
    return {'host':host,'kind':kind,'planeNormalMain0':normal.tolist(),'planeConstant':float(polygon[0]@normal),'contactPolygonMain0':polygon.tolist(),'minimumExpectedContactAreaM2':float(area),'normalPlaneResidualM':float(np.max(np.abs(polygon@normal-polygon[0]@normal)))}

def make_skin(name,family,vertices,faces,envelope,hosts,contacts,notes):
    vertices=np.asarray(vertices,dtype=float).tolist();faces=[tuple(f)for f in faces]
    if signed_volume(vertices,faces)<0:faces=[tuple(reversed(f))for f in faces]
    components=geometric_components(vertices,faces)
    origin=np.round(np.mean(vertices,axis=0)/4)*4;origin[2]=0 if min(p[2]for p in vertices)<0<max(p[2]for p in vertices)else origin[2];mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata([tuple(vec(np.array(p)-origin))for p in vertices],[],faces);mesh.update();mesh.materials.append(metal)
    uv=mesh.uv_layers.new(name='ArchitecturalUV')
    for polygon in mesh.polygons:
        polygon.use_smooth=False
        axis=max(range(3),key=lambda k:abs(polygon.normal[k]));axes=[k for k in range(3)if k!=axis]
        for loop in polygon.loop_indices:
            p=mesh.vertices[mesh.loops[loop].vertex_index].co;uv.data[loop].uv=(p[axes[0]]/1.5,p[axes[1]]/1.5)
    mesh.calc_loop_triangles();assert all(p.area>1e-12 for p in mesh.polygons)
    obj=bpy.data.objects.new(name,mesh);skin_collection.objects.link(obj);obj.location=vec(origin)
    obj['reconstruction_status']='Inferred appearance skin;8mm is not a recovered historical fabrication dimension.'
    obj['source_family']='LOC det.4a23720 / ASCE plateLXXXIV Fig2 flat visible stringer/landing/gallery face family; curves remain unresolved.'
    obj['penn_p5_finish_study']=1;obj['host_names']=' | '.join(hosts)
    bounds=np.array([np.min(vertices,axis=0),np.max(vertices,axis=0)]);envelope=np.array(envelope,dtype=float)
    assert np.all(bounds[0]>=envelope[0]-2e-5)and np.all(bounds[1]<=envelope[1]+2e-5),(name,bounds,envelope)
    record={'name':name,'family':family,'hosts':hosts,'boundsMain0':bounds.tolist(),'allowedEnvelopeMain0':envelope.tolist(),'connectedComponents':len(components),'componentDetails':components,'positiveVolumeM3':sum(x['volumeM3']for x in components),'sourceContactRules':contacts,'nominalSkinThicknessM':THICKNESS,'thicknessQualification':'Inferred appearance/encoding coordination; not an authenticated fabrication section.','notes':notes,'localMeshOriginMain0':origin.tolist(),'objectVertexCount':len(mesh.vertices),'objectPolygonCount':len(mesh.polygons),'objectTriangleCount':len(mesh.loop_triangles),'material':metal.name}
    skins.append(obj);records.append(record);return obj

stairs=[s for s in source_proof['stairs']if s['ordinal']!=5];assert len(stairs)==14
for stair in stairs:
    side=stair['side'];row=stair['ordinal'];prefix=f'Arrival row{row} '+side+' '
    for flight_index,flight in enumerate(stair['flights'],1):
        hosts=pick(prefix,side+' flight'+str(flight_index)+' steel stringer');assert len(hosts)==2
        for host in hosts:
            p=host['points'];cZ=float(p[:,2].mean());lateral=1 if cZ>stair['centerZ']else-1;label='plus'if lateral>0 else'minus'
            t=np.array([flight['endX']-flight['startX'],flight['endY']-flight['startY'],0.]);t/=np.linalg.norm(t);v=np.array([-t[1],t[0],0.]);origin=np.array([flight['startX'],flight['startY']-.18,cZ]);length=np.linalg.norm(np.array([flight['endX']-flight['startX'],flight['endY']-flight['startY'],0.]));outerZ=float(p[:,2].max()if lateral>0 else p[:,2].min());outer=p[np.abs(p[:,2]-outerZ)<1e-8]
            corners=[]
            for end in[0,1]:
                endpts=outer[np.abs((outer-origin)@t-end*length)<2e-5];assert len(endpts)==4
                for height in[-.125,.125]:
                    wanted=min(endpts,key=lambda point:abs(float((point-origin)@v)-height));assert abs(float((wanted-origin)@v)-height)<2e-5;corners.append(wanted.copy())
            aLow,aHigh,bLow,bHigh=corners;outer_quad=[aLow,bLow,bHigh,aHigh];inner=[point-np.array([0,0,lateral*THICKNESS])for point in outer_quad];vertices=[point.tolist()for point in outer_quad+inner];faces=BOX_F
            # BOX_F assumes the first four vertices form one face and the next
            # four the translated opposite face. Winding is fixed on NEW mesh only.
            rules=[]
            for x,y in[(aLow,bLow),(aHigh,bHigh)]:
                rules.append(contact(host['node']['name'],'stringer inner-flange bearing strip',[x,y,y-np.array([0,0,lateral*THICKNESS]),x-np.array([0,0,lateral*THICKNESS])],np.cross(y-x,[0,0,1])))
            make_skin(f'P{row}Finish {side} flight{flight_index} side-{label}','flight-stringer',vertices,faces,host['bounds'],[host['node']['name']],rules,['Exact source outer inner-flange corners; only empty I-section recess occupied. Existing source component/UV0/normals untouched.','Internal opposed mating faces remain valid assembly contacts; no exterior coplanar positive-area overlap.'])
    girder_hosts=pick(prefix,'landing bearing girder')+pick(prefix,'CENTRAL support girder');assert len(girder_hosts)==3;girder_hosts.sort(key=lambda h:float(h['bounds'].mean(axis=0)[0]))
    minY=max(float(h['bounds'][0,1])for h in girder_hosts);maxY=min(float(h['bounds'][1,1])for h in girder_hosts);assert abs(maxY-minY-.3)<2e-6
    for lateral in[-1,1]:
        label='plus'if lateral>0 else'minus';outerZ=[float(h['bounds'][1 if lateral>0 else 0,2])for h in girder_hosts];assert max(outerZ)-min(outerZ)<1e-8;outerZ=outerZ[0];innerZ=float(np.float32(outerZ-lateral*THICKNESS));vertices=[];faces=[];rules=[]
        for left,right in zip(girder_hosts,girder_hosts[1:]):
            lo=float(left['bounds'][1,0]);hi=float(right['bounds'][0,0]);assert hi>lo
            low=[lo,minY,min(outerZ,innerZ)];high=[hi,maxY,max(outerZ,innerZ)];offset=len(vertices);vertices+=box_vertices(low,high);faces += [tuple(i+offset for i in f)for f in BOX_F]
            for host,x in[(left,lo),(right,hi)]:rules.append(contact(host['node']['name'],'trimmed landing infill to existing cross-girder side face',[[x,minY,innerZ],[x,maxY,innerZ],[x,maxY,outerZ],[x,minY,outerZ]],[1,0,0]))
        envelope=np.array([np.min([h['bounds'][0]for h in girder_hosts],axis=0),np.max([h['bounds'][1]for h in girder_hosts],axis=0)])
        make_skin(f'P{row}Finish {side} landing side-{label}','landing-fascia',vertices,faces,envelope,[h['node']['name']for h in girder_hosts],rules,['Two independent closed infill volumes between unchanged girder caps; existing exterior caps complete the flat band.','New infills exclude entire host cap widths, so source outer cosmetic faces remain exact with no overlaid area.'])

# Gallery skins: an orthogonal face grid extruded in X, minus the actual
# existing stair-head solid. All new cell faces share exact vertex indices.
def grid_skin(outerX,innerX,z0,z1,y0,y1,hole):
    hz0,hz1,hy0,hy1=hole;zs=sorted(set([z0,z1,*[x for x in[hz0,hz1]if z0<x<z1]]));ys=sorted(set([y0,y1,*[x for x in[hy0,hy1]if y0<x<y1]]));occupied=set()
    for iz in range(len(zs)-1):
        for iy in range(len(ys)-1):
            z=(zs[iz]+zs[iz+1])/2;y=(ys[iy]+ys[iy+1])/2
            if not(hz0<z<hz1 and hy0<y<hy1):occupied.add((iz,iy))
    vertices=[];lookup={};faces=[]
    def point(x,z,y):
        p=(float(np.float32(x)),float(np.float32(y)),float(np.float32(z)))
        if p not in lookup:lookup[p]=len(vertices);vertices.append(list(p))
        return lookup[p]
    for iz,iy in sorted(occupied):
        zA,zB=zs[iz:iz+2];yA,yB=ys[iy:iy+2];outside=[point(outerX,zA,yA),point(outerX,zB,yA),point(outerX,zB,yB),point(outerX,zA,yB)];inside=[point(innerX,zA,yA),point(innerX,zB,yA),point(innerX,zB,yB),point(innerX,zA,yB)];faces.append(tuple(outside));faces.append(tuple(reversed(inside)))
        for edge,neighbor in[(0,(iz,iy-1)),(1,(iz+1,iy)),(2,(iz,iy+1)),(3,(iz-1,iy))]:
            if neighbor not in occupied:faces.append((outside[edge],inside[edge],inside[(edge+1)%4],outside[(edge+1)%4]))
    return vertices,faces,occupied,zs,ys

# Whole gallery panels fit existing surveyed girders and ALL actual head masks.
# Inferred panel joins follow actual stair centers; P5's accepted exact span is excluded.
rollout_path=Path('/Users/stavreskimario/Desktop/penn-station-work/phase9-interiors/arrivals-first-eight-rollout-inventory-v1/fascia/fascia-rollout-proposal-v2.json')
rollout=json.loads(rollout_path.read_text());fascia_partitions=[]
def grid_many(outerX,innerX,z0,z1,y0,y1,holes):
    zs=sorted(set([z0,z1,*[z for h in holes for z in h[:2]if z0<z<z1]]));ys=sorted(set([y0,y1,*[y for h in holes for y in h[2:]if y0<y<y1]]));occupied=set()
    for iz in range(len(zs)-1):
        for iy in range(len(ys)-1):
            z=(zs[iz]+zs[iz+1])/2;y=(ys[iy]+ys[iy+1])/2
            if not any(h[0]<z<h[1]and h[2]<y<h[3]for h in holes):occupied.add((iz,iy))
    vertices=[];lookup={};faces=[]
    def point(x,z,y):
        p=(float(x),float(y),float(z))
        if p not in lookup:lookup[p]=len(vertices);vertices.append(list(p))
        return lookup[p]
    for iz,iy in sorted(occupied):
        zA,zB=zs[iz:iz+2];yA,yB=ys[iy:iy+2];outside=[point(outerX,zA,yA),point(outerX,zB,yA),point(outerX,zB,yB),point(outerX,zA,yB)];inside=[point(innerX,zA,yA),point(innerX,zB,yA),point(innerX,zB,yB),point(innerX,zA,yB)];faces.extend([tuple(outside),tuple(reversed(inside))])
        for edge,neighbor in[(0,(iz,iy-1)),(1,(iz+1,iy)),(2,(iz,iy+1)),(3,(iz-1,iy))]:
            if neighbor not in occupied:faces.append((outside[edge],inside[edge],inside[(edge+1)%4],outside[(edge+1)%4]))
    return vertices,faces,occupied,zs,ys
for edge in rollout['edges']:
    side=edge['side'];host=source_nodes[edge['host']];outerX=edge['outerPlaneX'];innerX=edge['innerPlaneX'];minY,maxY=edge['heightBoundsMainY'];p5=edge['existingP5ObjectToSupersede'];retained=source_nodes[p5['name']];retainedZ=retained['bounds'][:,2].tolist();allstairs=sorted([q for q in source_proof['stairs']if q['side']==side],key=lambda q:q['centerZ']);heads=[]
    for q in allstairs:
        found=pick(f"Arrival row{q['ordinal']} {side} ",'upper head connection girder');assert len(found)==1;h=found[0];heads.append(h)
    for i,q in enumerate(allstairs):
        row=q['ordinal']
        if row==5:continue
        z0=edge['existingExtentZ'][0]if i==0 else(allstairs[i-1]['centerZ']+q['centerZ'])/2
        z1=edge['existingExtentZ'][1]if i==len(allstairs)-1 else(allstairs[i+1]['centerZ']+q['centerZ'])/2
        if i>0 and allstairs[i-1]['ordinal']==5:z0=retainedZ[1]
        if i<len(allstairs)-1 and allstairs[i+1]['ordinal']==5:z1=retainedZ[0]
        assert z1>z0 and(z1<=retainedZ[0]+1e-9 or z0>=retainedZ[1]-1e-9)
        active=[h for h in heads if h['bounds'][1,2]>z0 and h['bounds'][0,2]<z1]
        holes=[[float(h['bounds'][0,2]),float(h['bounds'][1,2]),float(h['bounds'][0,1]),float(h['bounds'][1,1])]for h in active]
        vertices,faces,cells,zs,ys=grid_many(outerX,innerX,z0,z1,minY,maxY,holes);rules=[]
        for za,zb in zip(zs,zs[1:]):
            mid=(za+zb)/2
            for y,kind in[(minY,'gallery lower inner-flange contact'),(maxY,'gallery upper inner-flange contact')]:
                if any(h[0]<mid<h[1]and h[2]<y<h[3]for h in holes):continue
                rules.append(contact(host['node']['name'],kind,[[outerX,y,za],[innerX,y,za],[innerX,y,zb],[outerX,y,zb]],[0,1,0]))
        for h,hole in zip(active,holes):
            za,zb=max(z0,hole[0]),min(z1,hole[1]);y=hole[2]
            if zb>za and minY<y<maxY:rules.append(contact(h['node']['name'],'gallery trim meets actual stair-head girder underface',[[outerX,y,za],[innerX,y,za],[innerX,y,zb],[outerX,y,zb]],[0,1,0]))
        envelope=host['bounds'].copy();envelope[0,2]=z0;envelope[1,2]=z1
        make_skin(f'P{row}Finish {side} gallery fascia','gallery-fascia',vertices,faces,envelope,[host['node']['name'],*[h['node']['name']for h in active],*([p5['name']]if abs(z1-retainedZ[0])<1e-9 or abs(z0-retainedZ[1])<1e-9 else[])],rules,['Whole ordinary gallery edge recess finish; actual source head solids subtracted from NEW panel only.','Existing P5 fascia retains exact occupied Z interval. Panel joins inferred, not historic joints.','No dropped ceiling, enclosure wall, haunch, receiver or public floor change.'])
        records[-1]['excludedHeadSolidBoundsMain0']=[h['bounds'].tolist()for h in active];records[-1]['faceGridOccupiedCells']=len(cells);fascia_partitions.append({'row':row,'side':side,'zExtent':[z0,z1],'retainedP5Z':retainedZ,'headMasks':[h['node']['name']for h in active]})
assert len(skins)==98 and len({o.name for o in skins})==98
bpy.context.view_layer.update();after={o.name:source_state(o)for o in source_objects};assert imported_before==after,'An original imported component changed';materials_after={m.name:material_state(m)for m in source_materials};assert materials_before==materials_after,'An original material changed'
# Editable full scene: source and14additions, no appearance lights or bake.
scene.name='P5 source + inferred finish study (Main0)';scene.render.engine='BLENDER_WORKBENCH'
for obj in bpy.context.selected_objects:obj.select_set(False)
for obj in skins:obj.select_set(True)
bpy.context.view_layer.objects.active=skins[0]
bpy.context.preferences.filepaths.save_version=0
# Addon library below is the deliverable; original full source is not reserialized.
# Library blend with an actual scene and only the14finish objects/material.
addon_path=a.out/'finish-addon.glb';bpy.ops.export_scene.gltf(filepath=str(addon_path),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
assert imported_before=={o.name:source_state(o)for o in source_objects}
assert materials_before=={m.name:material_state(m)for m in source_materials}
addon_bytes=addon_path.read_bytes();m,add_binary=parse_glb(addon_bytes);assert len(m['nodes'])==len(m['meshes'])==98 and len(m['materials'])==1
assert not m.get('images')and not m.get('textures')and not m.get('animations')and not m.get('cameras')
assert m['materials'][0]['name']==MATERIAL
addon_scene=bpy.data.scenes.new('P5 inferred14finish faces only');addon_scene.collection.children.link(skin_collection);addon_scene.render.engine='BLENDER_WORKBENCH';bpy.data.libraries.write(str(a.out/'addon.blend'),{addon_scene},fake_user=True,compress=True)

report={'status':'GEOMETRY CANDIDATE: P1–P8 whole ordinary gallery finish, P5 retained; no render or promotion','source':{'path':str(a.source),'sha256':H(original),'bytes':len(original)},'builderSha256':H(Path(__file__).read_bytes()),'familyBuilderOriginalSha256':H(Path('/Users/stavreskimario/Desktop/penn-station-reconstruction/authoring/penn-station-1935/review/phase9/p5-finish-study/source/build_flat.py').read_bytes()),'addon':{'path':str(addon_path),'sha256':H(addon_bytes),'bytes':len(addon_bytes)},'editableAddon':{'path':str(a.out/'addon.blend'),'sha256':H((a.out/'addon.blend').read_bytes()),'bytes':(a.out/'addon.blend').stat().st_size},'coordinateSpace':'Main0 glTF; worldY=Main0Y-4.2672 exactly once','skins':records,'fasciaPartitions':fascia_partitions,'sourcePreservation':{'all4063ImportedObjectStatesExact':imported_before==after,'allImportedMaterialStatesExact':materials_before==materials_after,'originalGlbRehashedUnchanged':H(a.source.read_bytes())==SOURCE_SHA,'originalObjectsReserializedIntoAddon':False,'P5GeometryIncludedInAddon':False},'counts':dict(Counter(x['family']for x in records)),'limits':['8mm flat cover-face family inferred from authenticated photo appearance; not historical fabrication dimensions.','No lower/upper haunch, rail, anchor, public tread/floor, track or receiver change.','Only appearance skins inside original host recess envelopes; original component source untouched.','New faces use local mesh origin for small-float precision.','CPU actual receiver/export regression still required.'],'elapsedSeconds':time.monotonic()-started}
(a.out/'finish-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k]for k in['status','addon','editableAddon','counts','sourcePreservation','elapsedSeconds']},indent=2),flush=True)
