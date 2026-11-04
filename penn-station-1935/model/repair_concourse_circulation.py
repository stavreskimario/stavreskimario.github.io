"""External-only review candidate: inward vertical angles and two open south bays."""
from pathlib import Path
from collections import Counter
import argparse,hashlib,json,shutil
import bpy
import numpy as np
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree

REPOSITORY=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,required=True,help='Exact pre-circulation editable scene, SHA256 ab7af4ed…')
parser.add_argument('--out',type=Path,required=True,help='New review directory outside the repository')
parser.add_argument('--departure-recipe',type=Path,default=REPOSITORY/'authoring/penn-station-1935/review/phase6/departure-access/layout-recipe.json')
args=parser.parse_args()
SOURCE=args.source.resolve();OUT=args.out.resolve();RECIPE_PATH=args.departure_recipe.resolve()
assert OUT!=REPOSITORY and REPOSITORY not in OUT.parents,'Write review assets outside the repository'
assert not OUT.exists(),'Use a new review directory; preserve existing evidence'
assert RECIPE_PATH.is_file(),'The frozen departure recipe is required'
SOURCE_SHA=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert SOURCE_SHA=='ab7af4ede715cd87337117053ddc8c46e4ba393a6d5a75f4200a92294fcf9c7d'
assert hashlib.sha256(RECIPE_PATH.read_bytes()).hexdigest()=='1e9820c4d5ab3a6295d30dfd38ffe822b9da7099b253d212bcbcd403d18285fd','Use the exact frozen departure recipe'
OUT.mkdir(parents=True)
DROP=4.2672;FT=.3048
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.view_layer.update()

def mesh_arrays(data):
    v=np.empty(len(data.vertices)*3,np.float32);data.vertices.foreach_get('co',v)
    n=np.empty(len(data.corner_normals)*3,np.float32);data.corner_normals.foreach_get('vector',n)
    uv={}
    for layer in data.uv_layers:
        a=np.empty(len(layer.data)*2,np.float32);layer.data.foreach_get('uv',a);uv[layer.name]=a.reshape(-1,2)
    return v.reshape(-1,3),n.reshape(-1,3),uv

def signature(obj):
    h=hashlib.sha256(np.asarray(obj.matrix_world,dtype='<f8').tobytes())
    if obj.type=='MESH':
        v,n,uv=mesh_arrays(obj.data);h.update(v.tobytes());h.update(n.tobytes())
        for f in obj.data.polygons:
            h.update(np.asarray(f.vertices,dtype='<i4').tobytes());h.update(str((f.use_smooth,f.material_index)).encode())
        for name,a in uv.items():h.update(name.encode());h.update(a.tobytes())
    elif obj.type=='FONT':h.update(str((obj.data.body,obj.data.size)).encode())
    if obj.data is not None and hasattr(obj.data,'materials'):h.update('|'.join(m.name if m else ''for m in obj.data.materials).encode())
    return h.hexdigest()

def components(obj):
    d=obj.data;v,_,_=mesh_arrays(d);parent=list(range(len(v)))
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for f in d.polygons:
        ids=list(f.vertices);a=find(ids[0])
        for i in ids[1:]:
            b=find(i)
            if a!=b:parent[b]=a
    result={}
    for f in d.polygons:
        r=result.setdefault(find(f.vertices[0]),{'vertices':set(),'polygons':[]})
        r['vertices'].update(f.vertices);r['polygons'].append(f.index)
    for r in result.values():
        r['vertices']=sorted(r['vertices']);p=v[r['vertices']]
        r['bounds']=[p.min(axis=0).tolist(),p.max(axis=0).tolist()]
    return list(result.values())

def volume(v,faces):
    center=np.asarray(v).mean(axis=0);total=0
    for f in faces:
        for i in range(1,len(f)-1):
            a,b,c=[v[k]-center for k in [f[0],f[i],f[i+1]]]
            total+=float(np.dot(a,np.cross(b,c)))/6
    return total

def cross2(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])

def clip_triangle(polygon,triangle):
    if cross2(*triangle)<0:triangle=triangle[::-1]
    for i in range(3):
        if not polygon:return []
        c,d=triangle[i],triangle[(i+1)%3];result=[]
        for j in range(len(polygon)):
            s,e=polygon[j],polygon[(j+1)%len(polygon)]
            ds,de=cross2(c,d,s),cross2(c,d,e)
            if (ds>=0)!=(de>=0):
                t=ds/(ds-de);result.append([s[k]+t*(e[k]-s[k])for k in range(2)])
            if de>=0:result.append(e)
        polygon=result
    return polygon

def polygon_area(polygon):
    return abs(sum(a[0]*b[1]-a[1]*b[0]for a,b in zip(polygon,polygon[1:]+polygon[:1])))/2 if polygon else 0

def new_collection(name):
    c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c

OWNED=new_collection('Phase7 old owned geometry')
NEW=new_collection('Phase7 circulation correction')
iron=bpy.data.objects['03 Glass and iron concourse — PaintedStructuralIron']
stone=bpy.data.objects['03 Glass and iron concourse — BedfordLimestoneConcourse']
before={o.name:signature(o)for o in bpy.context.scene.objects}
iron_parts=components(iron);stone_parts=components(stone)
v,n,uv=mesh_arrays(iron.data)
source_meshes={iron.name:iron.data,stone.name:stone.data}
rectangles={}
for part in iron_parts:
    if len(part['polygons'])!=6 or len(part['vertices'])!=8:continue
    lo,hi=np.array(part['bounds']);mid=(lo+hi)/2
    rectangles.setdefault((round(float(mid[0]),2),round(float(mid[1]),2)),[]).append(part)

# Reconstruct only the source pier centre inventory, never the whole building.
cx=-73;cw=(210+11/12)*FT;length=320*FT;west=cx-cw/2
wi=west+(29+5/12)*FT;wm=wi+(27+8/12)*FT;left=wm+(27+8/12)*FT;right=left+98*FT;ei=right+(26+8/12)*FT
spans=[(85+10/12)*FT,(95+4/12)*FT,(85+10/12)*FT];ys=[-sum(spans)/2]
for span in spans:ys.append(ys[-1]+span)
grid={}
def add(x,y,major=False):
    key=(round(x,3),round(y,3))
    if key not in grid:grid[key]={'center':[x,y],'major':major}
    else:grid[key]['major']|=major
for x in [left,right]:
    for y in ys:add(x,y,True)
for x in [wi,wm,ei]:
    for y in ys:add(x,y)
for y in [-length/2,length/2]:
    for x in [wi,wm,left,left+27.5*FT,left+70.5*FT,right,ei]:add(x,y)
arcade_y=[-length/2]
for span in [26.5,19+8/12,46+2/12,20,26+2/12,43,26+2/12,20,46+2/12,19+8/12,26.5]:arcade_y.append(arcade_y[-1]+span*FT)
for y in arcade_y:add(wi,y)
for y in [ys[0],ys[-1]]:
    for x in [west,wi,wm,left,left+27.5*FT,left+70.5*FT,right,ei,cx+cw/2]:add(x,y)

angles=[];deferred=[]
deferred_centres={(round(x,3),round(y,3)) for x in [ei,cx+cw/2] for y in [ys[0],ys[-1]]}
for part in iron_parts:
    ids=part['vertices'];a,b=np.asarray(part['bounds'])
    if len(ids)!=12 or len(part['polygons'])!=8 or abs(a[2]-.15)>.00003 or b[2]-a[2]<5:continue
    width=b-a
    if not any(max(abs(width[0]-leg),abs(width[1]-leg))<.00003 for leg in [.2032,.14]):continue
    matches=[]
    for g in grid.values():
        half=(3*FT if g['major'] else .62)/2;leg=.2032 if g['major'] else .14
        for sx in [-1,1]:
            for sy in [-1,1]:
                anchor=np.array(g['center'])-np.array([sx,sy])*half
                old_end=anchor-np.array([sx,sy])*leg
                expected=np.array([np.minimum(anchor,old_end),np.maximum(anchor,old_end)])
                if np.max(abs(np.array([a[:2],b[:2]])-expected))<.00003:matches.append((g,sx,sy,anchor))
    assert len(matches)==1,('Ambiguous vertical angle',part['bounds'],matches)
    g,sx,sy,anchor=matches[0]
    if (round(g['center'][0],3),round(g['center'][1],3)) in deferred_centres:
        deferred.append(part|{'centerBlenderXY':g['center'],'major':g['major'],'sx':sx,'sy':sy,
                              'reason':'Retained original compound-edge pier leg. The two interpreted minor centres are only0.4572m apart; inward correction would introduce an inter-pier overlap.'})
        continue
    # Keep the actual authored corner anchor bit-exact, not a recomputed grid
    # coordinate differing by float32 rounding at Manhattan-scale positions.
    points=v[ids];anchor=points[np.argmin(np.linalg.norm(points[:,:2]-anchor,axis=1)),:2].copy()
    corrected=points.copy();corrected[:,:2]=2*anchor-points[:,:2]
    local={old:i for i,old in enumerate(ids)}
    faces=[tuple(local[k]for k in iron.data.polygons[p].vertices)for p in part['polygons']]
    old_volume=volume(points,faces);new_volume=volume(corrected,faces)
    reverse=new_volume<0
    if reverse:faces=[tuple(reversed(f))for f in faces];new_volume=volume(corrected,faces)
    assert new_volume>1e-8
    # Actual base and cap parts, rather than generic manifest obstacle bounds.
    base=[];cap=[];gx,gy=g['center'];half=(3*FT if g['major'] else .62)/2
    nearby=[]
    for dx in [-.01,0,.01]:
        for dy in [-.01,0,.01]:nearby.extend(rectangles.get((round(gx+dx,2),round(gy+dy,2)),[]))
    for candidate in nearby:
        lo,hi=np.asarray(candidate['bounds']);mid=(lo+hi)/2
        if len(candidate['polygons'])!=6 or len(candidate['vertices'])!=8 or max(abs(mid[0]-gx),abs(mid[1]-gy))>.00003:continue
        if abs(lo[2])<.00003 and abs(hi[2]-.16)<.00003:base.append(candidate)
        cap_width=max((3*FT if g['major'] else .62)+.30,1.10)
        if (abs(mid[2]-b[2])<.00003 and abs((hi[2]-lo[2])-.12)<.00003
                and max(abs((hi[0]-lo[0])-cap_width),abs((hi[1]-lo[1])-cap_width))<.00003):cap.append(candidate)
    if len(base)!=1 or len(cap)!=1:
        print(json.dumps({'baseCapDiagnostic':g,'angleTop':float(b[2]),'baseCount':len(base),'capCount':len(cap),
                          'nearbyRectangles':[p['bounds']for p in nearby],
                          'allNearbyParts':[{'bounds':p['bounds'],'faces':len(p['polygons']),'vertices':len(p['vertices'])}for p in iron_parts if max(abs(np.array(p['bounds']).mean(axis=0)[0]-gx),abs(np.array(p['bounds']).mean(axis=0)[1]-gy))<.01]}),flush=True)
    assert len(base)==1 and len(cap)==1,('Missing actual base/cap',g)
    low_ids=np.where(abs(corrected[:,2]-a[2])<.00003)[0];high_ids=np.where(abs(corrected[:,2]-b[2])<.00003)[0]
    for target,indices in [(base[0],low_ids),(cap[0],high_ids)]:
        lo,hi=np.array(target['bounds']);assert np.all(corrected[indices]>=lo-.00003)and np.all(corrected[indices]<=hi+.00003)
    angles.append(part|{'centerBlenderXY':g['center'],'major':g['major'],'sx':sx,'sy':sy,'anchorXY':anchor.tolist(),
                        'correctedPoints':corrected.tolist(),'correctedFaces':faces,'oldSignedVolume':old_volume,
                        'newSignedVolume':new_volume,'reversedWinding':reverse,'basePolygons':base[0]['polygons'],
                        'capPolygons':cap[0]['polygons'],'baseAndCapContact':True})
assert len(angles)==176 and len(deferred)==16,(len(angles),len(deferred))
assert len(angles)+len(deferred)==len(grid)*4
assert Counter(tuple(round(k,3)for k in p['centerBlenderXY'])for p in angles+deferred)=={key:4 for key in grid}

wall=[]
for part in stone_parts:
    a,b=np.asarray(part['bounds'])
    if max(abs(a[1]+49.043),abs(b[1]+48.493),abs(a[2]),abs(b[2]-3.8))>.00003:continue
    if max(abs(a[0]+56.6500206),abs(b[0]+50.6149788))<.00003:wall.append(part|{'role':'West lower bay; retain closed western residual toX−54.6'})
    if max(abs(a[0]+48.3035812),abs(b[0]+42.4514198))<.00003:wall.append(part|{'role':'East lower bay; complete lower cell removal'})
assert len(wall)==2,len(wall)
owned={'PaintedStructuralIron':(iron,angles),'BedfordLimestoneConcourse':(stone,wall)}
retained_proofs=[];owned_objects=[];owned_materials=[];orphan_name_restore={}

def mesh_from_source(obj,faces,name,collection,material=None):
    data=obj.data;vertices,normals,uvs=mesh_arrays(data)
    ids=sorted({i for p in faces for i in data.polygons[p].vertices});remap={old:i for i,old in enumerate(ids)}
    loops=[i for p in faces for i in data.polygons[p].loop_indices]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices[ids].tolist(),[],[tuple(remap[i]for i in data.polygons[p].vertices)for p in faces]);mesh.update()
    for m in data.materials:mesh.materials.append(material if material else m)
    for f,old in zip(mesh.polygons,faces):f.use_smooth=data.polygons[old].use_smooth;f.material_index=data.polygons[old].material_index
    for layer_name,a in uvs.items():mesh.uv_layers.new(name=layer_name).data.foreach_set('uv',a[loops].ravel())
    if data.has_custom_normals:mesh.normals_split_custom_set(normals[loops].tolist())
    result=bpy.data.objects.new(name,mesh);collection.objects.link(result)
    result.matrix_world=Matrix.Translation((0,0,DROP))@obj.matrix_world
    return result

def constant_material(original,new_name):
    material=bpy.data.materials.new(new_name);material.use_nodes=True
    old=original.node_tree.nodes.get('Principled BSDF');p=material.node_tree.nodes.get('Principled BSDF')
    for key in ['Base Color','Roughness','Metallic','Transmission Weight','IOR']:
        if old.inputs.get(key):p.inputs[key].default_value=old.inputs[key].default_value
    return material

for name,(obj,parts)in owned.items():
    removed=sorted({p for part in parts for p in part['polygons']});removed_set=set(removed)
    alias='REMOVAL_'+name
    previous=bpy.data.materials.get(alias)
    if previous:
        assert previous.users==0,'Do not rename a referenced material'
        orphan_name_restore[previous]=alias;previous.name='P7ORPHAN_'+alias
    material=constant_material(obj.data.materials[0],alias);material['original_material_name']=name
    assert material.name==alias,'Owned aliases must be exact'
    owned_materials.append(material)
    old=mesh_from_source(obj,removed,'Old owned '+name,OWNED,material);owned_objects.append(old)
    keep=[p.index for p in obj.data.polygons if p.index not in removed_set]
    old_data=obj.data;vertices,normals,uvs=mesh_arrays(old_data)
    kept=mesh_from_source(obj,keep,obj.name+' retained temporary',OWNED)
    # Compaction changes only storage indices, never a retained corner value.
    expected_loops=np.array([i for p in keep for i in old_data.polygons[p].loop_indices])
    expected_points=np.array([vertices[old_data.loops[i].vertex_index]for i in expected_loops])
    kv,kn,kuv=mesh_arrays(kept.data)
    actual_points=np.array([kv[l.vertex_index]for l in kept.data.loops])
    assert np.array_equal(expected_points,actual_points)
    assert np.array_equal(normals[expected_loops],kn)
    for key,a in uvs.items():assert np.array_equal(a[expected_loops],kuv[key])
    obj.data=kept.data;bpy.data.objects.remove(kept,do_unlink=True)
    retained_proofs.append({'object':obj.name,'retainedFaces':len(keep),'retainedCorners':len(expected_loops),'positionsNormalsEveryUvExact':True})

new_iron=constant_material(bpy.data.materials['PaintedStructuralIron'],'PaintedStructuralIronCirculationAngles')
new_iron['skip_lighting_atlas']=True
new_iron['source_identity']='Corrected frame for existing nominal3ft/four8in-angle columns; existing minor-pier width interpreted. Original centres/heights/base/lattice/collars retained.'
vertices=[];faces=[];uv_data={name:[]for name in uv}
angle_records=[]
_,_,original_iron_uv=mesh_arrays(source_meshes[iron.name])
for part in angles:
    offset=len(vertices);vertices.extend(part['correctedPoints'])
    # Each old-owned component has unchanged source coordinates. UVs remain
    # attached to their same geometric corners when winding is reversed.
    old_src=source_meshes[iron.name]
    # The source mesh datablock remains alive after replacing its object data.
    assert old_src is not None
    old_uv=original_iron_uv
    local={old:i for i,old in enumerate(part['vertices'])}
    for source_face in part['polygons']:
        p=old_src.polygons[source_face];order=list(p.loop_indices)
        if part['reversedWinding']:order.reverse()
        faces.append(tuple(offset+local[old_src.loops[i].vertex_index]for i in order))
        for name,a in old_uv.items():uv_data[name].extend(a[order].tolist())
    angle_records.append({k:value for k,value in part.items()if k not in ['correctedPoints','correctedFaces']})
mesh=bpy.data.meshes.new('Correct inward vertical angles');mesh.from_pydata(vertices,[],faces);mesh.update();mesh.materials.append(new_iron)
for name,a in uv_data.items():mesh.uv_layers.new(name=name).data.foreach_set('uv',np.asarray(a,dtype=np.float32).ravel())
angle_obj=bpy.data.objects.new('Correct inward vertical angle frames',mesh);NEW.objects.link(angle_obj)
mesh.calc_loop_triangles()
caps=[[]for part in angles]
for triangle in mesh.loop_triangles:
    owner=triangle.vertices[0]//12
    assert all(i//12==owner for i in triangle.vertices)
    points=[mesh.vertices[i].co for i in triangle.vertices]
    if all(abs(p.z-.15)<.00003 for p in points):caps[owner].append([[p.x,p.y]for p in points])
assert all(len(cap)==4 for cap in caps),'Each closed L-prism must have four bottom-cap triangles'
cap_bounds=[(np.asarray(cap).reshape(-1,2).min(axis=0),np.asarray(cap).reshape(-1,2).max(axis=0))for cap in caps]
pair_candidates=0;positive_pairs=0;maximum_pair_area=0
for i in range(len(caps)):
    for j in range(i+1,len(caps)):
        lo,hi=cap_bounds[i];other_lo,other_hi=cap_bounds[j]
        if np.any(hi<other_lo)or np.any(other_hi<lo):continue
        if min(angles[i]['bounds'][1][2],angles[j]['bounds'][1][2])<=max(angles[i]['bounds'][0][2],angles[j]['bounds'][0][2]):continue
        pair_candidates+=1
        area=sum(polygon_area(clip_triangle(a,b))for a in caps[i]for b in caps[j])
        maximum_pair_area=max(maximum_pair_area,area)
        if area>1e-8:positive_pairs+=1
assert positive_pairs==0,'Do not introduce inter-pier profile intersections'
source_pair_review={'sourceCapTriangles':len(caps)*4,'candidatePairs':pair_candidates,'positiveIntersections':positive_pairs,
                    'maximumIntersectionArea':maximum_pair_area,'method':'Actual generated mesh cap triangles clipped in XY with shared vertical height. New L-prisms only; intentional rail/bearing joints excluded.'}

west=next(p for p in wall if p['bounds'][0][0]<-55);a,b=np.asarray(west['bounds']);b=b.copy();b[0]=-54.6
corners=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
center=(a+b)/2;radius=(b-a)/2
verts=[tuple(center+np.array(s)*radius)for s in corners]
face_list=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
res=bpy.data.meshes.new('Closed western residual south lower wall');res.from_pydata(verts,[],face_list);res.update()
new_stone=bpy.data.materials['BedfordLimestoneConcourse'].copy();new_stone.name='BedfordLimestoneConcourseCirculation'
new_stone['source_identity']='Closed residual of existing southern wall; lower circulation bay opened only in primary-supported eastern region. Height3.8 remains inferred.'
res.materials.append(new_stone);layer=res.uv_layers.new(name='ArchitecturalUV')
for f in res.polygons:
    axis=max(range(3),key=lambda k:abs(f.normal[k]));axes=[k for k in range(3)if k!=axis]
    for i in f.loop_indices:
        p=res.vertices[res.loops[i].vertex_index].co;layer.data[i].uv=(p[axes[0]]*.28,p[axes[1]]*.28)
res_obj=bpy.data.objects.new('Closed western residual south lower wall',res);NEW.objects.link(res_obj)
assert volume(np.array(verts),face_list)>0

# Complete the existing Main well perimeter at its east/rear edge. The
# departure gate and every tread/landing remain unchanged.
recipe=json.loads(RECIPE_PATH.read_text())
guard_material=bpy.data.materials['PaintedStructuralIronAccessGuard']
rear_guards=[];rear_post_footprints=[];end_connections=[]
def guard_box(name,center,size):
    c=np.array(center);r=np.array(size)/2
    points=[tuple(c+np.array(s)*r)for s in corners]
    data=bpy.data.meshes.new(name);data.from_pydata(points,[],face_list);data.update();data.materials.append(guard_material)
    layer=data.uv_layers.new(name='ArchitecturalUV')
    for f in data.polygons:
        axis=max(range(3),key=lambda k:abs(f.normal[k]));axes=[k for k in range(3)if k!=axis]
        for i in f.loop_indices:
            p=data.vertices[data.loops[i].vertex_index].co;layer.data[i].uv=(p[axes[0]]*.28,p[axes[1]]*.28)
    obj=bpy.data.objects.new(name,data);NEW.objects.link(obj)
    assert volume(np.array(points),face_list)>0
    rear_guards.append(obj);return obj

bpy.context.view_layer.update()
floor_materials={'ConcourseOpaqueCirculationConcrete','ConcourseOpaqueCirculationConcreteAccessInfill','PublicFloorMarble','PublicFloorMarbleAccessInfill'}
floor_trees=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or not any(m and m.name in floor_materials for m in obj.data.materials):continue
    floor_trees.append((obj,BVHTree.FromPolygons([obj.matrix_world@p.co for p in obj.data.vertices],[tuple(f.vertices)for f in obj.data.polygons])))
for row in recipe['workingDepartureCandidate']['rows']:
    number=row['workingPlatform'];cy=row['centreBlenderY'];rear_x=-43.30
    guard_box(f'Departure{number} supported rear well top rail',(rear_x,cy,1.12),(.045,2.34,.045))
    for side in [-1,1]:
        guard_box(f'Departure{number} rear well short return{side}',(-43.325,cy+side*1.17,1.12),(.05,.045,.045))
        endpoint=Vector((-43.35,cy+side*1.17,1.12-DROP));nearest=[]
        for old in bpy.context.scene.objects:
            if old.type!='MESH' or not old.name.startswith(f'Departure{number} Main well top rail'):continue
            tree=BVHTree.FromPolygons([old.matrix_world@p.co for p in old.data.vertices],[tuple(f.vertices)for f in old.data.polygons])
            point,normal,index,distance=tree.find_nearest(endpoint)
            if point is not None:nearest.append((distance,old.name))
        assert nearest and min(nearest)[0]<.00001
        end_connections.append({'row':number,'side':side,'existingRail':min(nearest)[1],'distanceMetres':min(nearest)[0]})
    for k,y in enumerate(np.linspace(cy-1.17,cy+1.17,7)):
        post=guard_box(f'Departure{number} supported rear well upright{k}',(rear_x,float(y),.535),(.022,.022,1.17))
        checks=[]
        for dx,dy in [(0,0),(-.011,-.011),(-.011,.011),(.011,-.011),(.011,.011)]:
            start=Vector((rear_x+dx,float(y)+dy,.10-DROP));hits=[]
            for obj,tree in floor_trees:
                point,normal,index,distance=tree.ray_cast(start,Vector((0,0,-1)),.30)
                if point is not None and normal.z>.98:hits.append((abs(point.z+DROP),obj.name))
            assert hits and min(hits)[0]<.00002,('Unsupported rear post',number,k,start)
            checks.append({'errorMetres':min(hits)[0],'floorObject':min(hits)[1]})
        rear_post_footprints.append({'row':number,'post':k,'x':rear_x,'blenderY':float(y),'checks':checks})

def export(objects,path):
    bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,
        export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)

export(owned_objects,OUT/'old-owned.glb')
export(list(NEW.objects),OUT/'new-geometry-module.glb')
bpy.data.batch_remove(ids=owned_objects);bpy.data.collections.remove(OWNED)
for material in owned_materials:bpy.data.materials.remove(material)
for material,name in orphan_name_restore.items():material.name=name

# Export copies, never round-trip authored original transforms through
# matrix decomposition. That would change some font Euler/basis ULPs.
retained=[o for o in bpy.context.scene.objects if o.type in {'MESH','FONT'}and any(c.name.startswith(('03 ','Phase6 corrected'))for c in o.users_collection)]
materials=set(m for o in retained for m in o.data.materials if m);names={m:m.name for m in materials};temporary={}
for m in materials:m.name='P7TEMP_'+names[m]
for m,name in names.items():temporary[m]=constant_material(m,name)
OCC=new_collection('Phase7 temporary protected copies');copies=[];data_copies={}
for original in retained:
    assert original.parent is None,'Explicit parent frame handling required'
    if original.data not in data_copies:
        data=original.data.copy();data.materials.clear()
        for m in original.data.materials:data.materials.append(temporary[m]if m else None)
        data_copies[original.data]=data
    copy=original.copy();copy.data=data_copies[original.data];OCC.objects.link(copy)
    copy.location.z+=float(np.float32(DROP));copies.append(copy)
export(copies,OUT/'retained-concourse-occluder.glb')
shutil.copyfile(OUT/'retained-concourse-occluder.glb',OUT/'retained-protected.glb')
bpy.data.batch_remove(ids=copies);bpy.data.collections.remove(OCC)
for m in temporary.values():bpy.data.materials.remove(m)
for m,name in names.items():m.name=name
for o in NEW.objects:o.location.z-=DROP
bpy.context.view_layer.update()
after={o.name:signature(o)for o in bpy.context.scene.objects if o.name in before and o not in [iron,stone]}
differences=[name for name in after if after[name]!=before[name]]
assert not differences,('Unrelated source changes',differences)
assert len(after)==len(before)-2
bpy.context.scene['phase7_circulation']='Inward corner-angle frames and two open lower eastern south bays; source-supported scope with inferred minor dimensions; arrival deck untouched.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'penn-station-phase7-circulation-review.blend'),compress=True)
report={'status':'SOURCE REVIEW CANDIDATE ONLY; no production or canonical overwrite','source':str(SOURCE),'sourceSha256':SOURCE_SHA,'departureRecipeSha256':hashlib.sha256(RECIPE_PATH.read_bytes()).hexdigest(),
        'axes':'Raw GLBs X east,Y up,Z south, Main=0. Review blend common world Main−4.2672.',
        'verticalFrameQuaternionWXYZ':list(Vector((0,0,1)).to_track_quat('Z','Y')),
        'angleCount':len(angles),'majorAngleCount':sum(p['major']for p in angles),'minorAngleCount':sum(not p['major']for p in angles),
        'deferredMinorLegs':deferred,'deferredMinorLegCount':len(deferred),'deferredOriginalAngleCount':len(deferred),'deferredOriginalMinorCentresBlenderXY':[list(g['center'])for key,g in grid.items()if key in deferred_centres],
        'reversedOriginallyInwardComponents':sum(p['reversedWinding']for p in angles),
        'allNewAngleVolumesPositive':all(p['newSignedVolume']>0 for p in angles),'allAngleBaseCapContacts':all(p['baseAndCapContact']for p in angles),
        'newInterPierOverlapCheck':source_pair_review,
        'rearGuards':{'rows':9,'newClosedParts':len(rear_guards),'x':-43.30,'topRailHeightMain':1.12,'uprightWidth':.022,'topRailWidth':.045,'postFootprints':rear_post_footprints,'endConnections':end_connections,'interpretation':'Source-consistent rear enclosure; exact dimensions and cadence reconstructed. Allposts sit on closed east-side infill, not over treads.'},
        'retainedBatchProofs':retained_proofs,'unrelatedObjectsExact':len(after),'unrelatedSignatures':after,
        'southOpeningsMainXZ':[[-54.6,-50.6149787902832,48.49300003051758,49.042999267578125],[-48.30358123779297,-42.451419830322266,48.49300003051758,49.042999267578125]],
        'removedWallCellHeightMain':[0,3.799999952316284],'closedWesternResidualBoundsBlender':[a.tolist(),b.tolist()],
        'retained':'All baseplates,lattice,collars,capplates,full-height stone piers,upperwindows,departure flights,gates/indicators,Main/Exit/platform floors and arrival deck. Existing runtime context cover reused; no invented street roof.',
        'qualifications':['3ft major angle envelope is primary-supported; corner orientation is diagnosed mechanically, not a complete shop-detail tracing.','Minor0.62m envelope remains interpreted;16originallegs at4close compound-edge piers are explicitly deferred.','Opening region primary-supported±0.75m;3.8m is removed wall-cell height, not measured unobstructed clearance. Retained sill iron crosses slightly below it.','Arrivals and platform mappings retain earlier limitations.'],
        'outputs':{}}
for name in ['old-owned.glb','new-geometry-module.glb','retained-protected.glb','retained-concourse-occluder.glb','penn-station-phase7-circulation-review.blend']:
    p=OUT/name;report['outputs'][name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(OUT/'component-census.json').write_text(json.dumps({'angles':angle_records,'deferredOriginalAngles':deferred,'southWholeOwnedWallCells':wall},indent=2)+'\n')
(OUT/'source-proof.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k not in ['unrelatedSignatures','retainedBatchProofs']}))
