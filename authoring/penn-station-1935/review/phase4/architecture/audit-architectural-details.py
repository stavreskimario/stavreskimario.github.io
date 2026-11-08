import ast,hashlib,json,math,sys,subprocess
from pathlib import Path
import bpy,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
review=Path(__file__).resolve().parent
source=review/'source/model/build_station.py'
tree=ast.parse(source.read_text())
names=['mesh','box','move','lathe','moulded_square','tube_path','waiting_candelabrum','contact','contact_audit','arch','carved_abacus','capital_leaf']
nodes=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names]
assert len(nodes)==len(names)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
out=review/'rerun-details';out.mkdir(exist_ok=True)
materials={name:bpy.data.materials.new(name) for name in ['LIMESTONE','GRANITE','FLOOR','BRONZE','WHITE','OPAL_GLASS']}
ns={'bpy':bpy,'math':math,'json':json,'np':np,'Vector':Vector,'BVHTree':BVHTree,'COL':bpy.context.collection,'CONTACTS':[],'ASSETS':out,
    'INTERIOR_CAPITAL':(8+3/12)*.3048,**materials}
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),ns)
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'arches':[]}
for axis in ['X','Y']:
    for rise in [None,13.2364]:
        obj=ns['arch']('Arch orientation control',(0,0,0),16.5608,.8,materials['LIMESTONE'],axis=axis,width=.45,rise=rise)
        failures=[];dots=[]
        for face in obj.data.polygons:
            kind=face.index%4
            if kind<2:
                target=Vector(((-1 if kind==0 else 1),0,0) if axis=='X' else (0,(-1 if kind==0 else 1),0))
            else:
                target=face.center.copy();target[0 if axis=='X' else 1]=0
                if kind==2:target.negate()
                target.normalize()
            dot=face.normal.dot(target);dots.append(dot)
            if dot<=0:failures.append(face.index)
        report['arches'].append({'axis':axis,'rise':rise,'faces':len(obj.data.polygons),'incorrectFaces':failures,'minimumExpectedOrientationDot':min(dots)})
        assert not failures
ns['waiting_candelabrum'](0,0)
contacts=ns['contact_audit']()
report['candelabrumContacts']={'checks':len(contacts['contacts']),'failures':len(contacts['failures'])}
assert not contacts['failures']
globes=[o for o in bpy.data.objects if 'opal globe' in o.name]
bpy.context.view_layer.update()
report['globes']=[{'name':o.name,'vertices':len(o.data.vertices),'allFacesSmooth':all(p.use_smooth for p in o.data.polygons),
                   'centre':list(o.location),'top':max((o.matrix_world@v.co).z for v in o.data.vertices)} for o in globes]
assert len(globes)==5
central=next(r for r in report['globes'] if 'raised central' in r['name'])
assert abs(central['top']-6.5755)<1e-5
assert all(abs(r['top']-5.915)<1e-5 for r in report['globes'] if r is not central)
abacus=ns['carved_abacus']('Abacus outline control',(0,0,0));abacus.data.calc_loop_triangles()
areas=[]
for t in abacus.data.loop_triangles:
    a,b,c=[abacus.data.vertices[i].co for i in t.vertices];areas.append((b-a).cross(c-a).length/2)
report['abacus']={'vertices':len(abacus.data.vertices),'triangles':len(areas),'zeroAreaTriangles':sum(area<1e-9 for area in areas)}
assert not report['abacus']['zeroAreaTriangles']
leaf=ns['capital_leaf']((0,0,0),0,0)
report['leaf']={'vertices':len(leaf.data.vertices),'polygons':len(leaf.data.polygons),'allFacesSmooth':all(p.use_smooth for p in leaf.data.polygons)}
edge_directions={}
for face in leaf.data.polygons:
    for a,b in zip(face.vertices,list(face.vertices[1:])+[face.vertices[0]]):
        key=(min(a,b),max(a,b));edge_directions[key]=edge_directions.get(key,0)+(1 if a<b else -1)
report['leaf']['inconsistentlyOrientedSharedEdges']=sum(value!=0 for value in edge_directions.values())
assert not report['leaf']['inconsistentlyOrientedSharedEdges']
old_text=subprocess.run(['git','show','b86a591:penn-station-1935/model/build_station.py'],cwd=review.parents[4],check=True,capture_output=True,text=True).stdout
old_nodes=[node for node in ast.parse(old_text).body if isinstance(node,ast.FunctionDef) and node.name in ['arch','capital_leaf']]
old_ns=dict(ns);exec(compile(ast.Module(body=old_nodes,type_ignores=[]),'checkpoint-b86a591','exec'),old_ns)
old_leaf=old_ns['capital_leaf']((0,0,0),0,0);directions={}
for face in old_leaf.data.polygons:
    for a,b in zip(face.vertices,list(face.vertices[1:])+[face.vertices[0]]):
        key=(min(a,b),max(a,b));directions[key]=directions.get(key,0)+(1 if a<b else -1)
old_arch=old_ns['arch']('Old axisY control',(0,0,0),16.5608,.8,materials['LIMESTONE'],axis='Y')
old_wrong=0
for face in old_arch.data.polygons:
    kind=face.index%4
    if kind<2:target=Vector((0,-1 if kind==0 else 1,0))
    else:
        target=face.center.copy();target.y=0
        if kind==2:target.negate()
        target.normalize()
    old_wrong+=face.normal.dot(target)<=0
report['checkpointNegativeControl']={'commit':'b86a591','sourceSha256':hashlib.sha256(old_text.encode()).hexdigest(),
    'leafInconsistentlyOrientedSharedEdges':sum(value!=0 for value in directions.values()),
    'axisYIncorrectArchFaces':old_wrong,'axisYArchFaces':len(old_arch.data.polygons)}
assert report['checkpointNegativeControl']['leafInconsistentlyOrientedSharedEdges']>0 and old_wrong>0
(out/'detail-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
