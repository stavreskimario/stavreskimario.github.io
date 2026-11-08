import ast,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
review=Path(__file__).resolve().parent
source=review/'source/model/build_station.py'
sys.path.insert(0,str(source.parent))
from coffer_geometry import tessellate_profile
tree=ast.parse(source.read_text())
nodes=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in ['vault_z','vault_surface','barrel_surface','coffer_cell']]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
material=bpy.data.materials.new('Coffer audit')
def mesh(name,vertices,faces,material):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);return o
ns={'math':math,'Vector':Vector,'mesh':mesh,'tessellate_profile':tessellate_profile,'PALE':material,'spring':30.35,'rise':143*.3048-30.35,'a':(108+8/12)*.3048/2,'b':277*.3048/6}
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),ns)
a,b=ns['a'],ns['b'];grid_x=round(2*a/(10*.3048));grid_y=round(2*b/(10*.3048));records=[]
for j in [-1,0,1]:
    cy=j*277*.3048/3
    for iy in range(grid_y):
        for ix in range(grid_x):
            cx=-a+(ix+.5)*2*a/grid_x;yy=-b+(iy+.5)*2*b/grid_y
            o=ns['coffer_cell']('Coffer',cx,yy,a/grid_x,b/grid_y,lambda x,y,d,cy=cy:ns['vault_surface'](x,y,cy,d))
            data=o.data;data.calc_loop_triangles();warped=[];negative=[];degenerate=[]
            for p in data.polygons:
                vs=[data.vertices[i].co for i in p.vertices]
                if len(vs)>3:
                    n=(vs[1]-vs[0]).cross(vs[2]-vs[0]);n.normalize()
                    delta=max(abs(n.dot(v-vs[0])) for v in vs)
                    if delta>.02:warped.append({'face':p.index,'deviation':delta})
            for t in data.loop_triangles:
                vs=[data.vertices[i].co for i in t.vertices]
                area=(vs[1]-vs[0]).cross(vs[2]-vs[0]).length/2
                if area<1e-7:degenerate.append(t.polygon_index)
            records.append({'j':j,'ix':ix,'iy':iy,'polygons':len(data.polygons),'triangles':len(data.loop_triangles),'warped':warped,'degenerate':degenerate})
out={'coffers':len(records),'polygons':sum(r['polygons'] for r in records),'triangles':sum(r['triangles'] for r in records),'warpedFaces':sum(len(r['warped']) for r in records),'maxWarp':max([f['deviation'] for r in records for f in r['warped']] or [0]),'records':records}
(review/'rerun-coffer-audit.json').write_text(json.dumps(out,indent=2))
print(json.dumps({k:v for k,v in out.items() if k!='records'}))
if '--render' in sys.argv:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.cycles.device='CPU';scene.render.threads_mode='FIXED';scene.render.threads=8;scene.cycles.use_denoising=True
    scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    material.use_nodes=True;pbr=material.node_tree.nodes.get('Principled BSDF');pbr.inputs['Base Color'].default_value=(.74,.73,.69,1);pbr.inputs['Roughness'].default_value=.8
    scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.72,.76,.82,1);scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.45
    for x in [-14,14]:
        data=bpy.data.lights.new('Neutral window diagnostic','AREA');data.energy=6000;data.shape='DISK';data.size=18
        light=bpy.data.objects.new(data.name,data);bpy.context.collection.objects.link(light);light.location=(x,-7,30)
        light.rotation_euler=(Vector((0,0,41))-light.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Coffer diagnostic camera');camera=bpy.data.objects.new(data.name,data);bpy.context.collection.objects.link(camera)
    camera.location=(0,-24,28);camera.rotation_euler=(Vector((0,8,41))-camera.location).to_track_quat('-Z','Y').to_euler();data.lens=36;scene.camera=camera
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(review/'rerun-coffer-neutral.png')
    bpy.ops.render.render(write_still=True)
