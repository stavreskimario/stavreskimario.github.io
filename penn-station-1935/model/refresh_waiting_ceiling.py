"""Replace only a saved scene's coffer field from the current canonical profile.

Useful during review so a small vault correction does not rebuild the entire
station. The source .blend and input assets remain unchanged. Raw glTF rooms
export relative to Main=0; the saved scene remains registered to street=0.
"""
import argparse,ast,hashlib,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
from coffer_geometry import tessellate_profile
from surface_finish_normals import clamp_backfacing_corner_normals

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--scene',type=Path,required=True)
parser.add_argument('--source',type=Path,default=Path(__file__).with_name('build_station.py'))
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
tree=ast.parse(args.source.read_text())
names=['mesh','batch_static','export','vault_z','vault_surface','barrel_surface','coffer_cell']
nodes=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names]
assert len(nodes)==len(names)
bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
hall=bpy.data.collections['02 Main waiting room']
drop=14*.3048
for obj in hall.objects:obj.location.z+=drop
bpy.context.view_layer.update()
old=[o for o in hall.objects if o.type=='MESH' and any(m and m.name=='PaleVaultPlaster' for m in o.data.materials)]
assert len(old)==1
old_vertices=len(old[0].data.vertices);old_faces=len(old[0].data.polygons)
bpy.data.objects.remove(old[0],do_unlink=True)
ns={'bpy':bpy,'math':math,'Vector':Vector,'tessellate_profile':tessellate_profile,
    'clamp_backfacing_corner_normals':clamp_backfacing_corner_normals,
    'PALE':bpy.data.materials['PaleVaultPlaster'],'COL':hall,'ASSETS':args.out,
    'spring':30.35,'rise':143*.3048-30.35,'a':(108+8/12)*.3048/2,'b':277*.3048/6}
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(args.source),'exec'),ns)
a,b=ns['a'],ns['b'];clear_l=277*.3048;room_l=(314+4/12)*.3048
grid_x=round(2*a/(10*.3048));grid_y=round(2*b/(10*.3048))
created=[]
for j in [-1,0,1]:
    cy=j*clear_l/3
    for iy in range(grid_y):
        for ix in range(grid_x):
            cx=-a+(ix+.5)*2*a/grid_x;yy=-b+(iy+.5)*2*b/grid_y
            created.append(ns['coffer_cell']('Ten-foot-module octagonal plaster coffer',cx,yy,a/grid_x,b/grid_y,
                lambda x,y,d,cy=cy:ns['vault_surface'](x,y,cy,d)))
for sy in [-1,1]:
    begin=clear_l/2;length=(room_l-clear_l)/2
    for iy in range(2):
        cy=sy*(begin+(iy+.5)*length/2)
        for ix in range(grid_x):
            cx=-a+(ix+.5)*2*a/grid_x
            created.append(ns['coffer_cell']('End-portico octagonal barrel coffer',cx,cy,a/grid_x,length/4,ns['barrel_surface']))
report={'source':args.source.name,'sourceSha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),
        'cofferHelperSha256':hashlib.sha256(Path(__file__).with_name('coffer_geometry.py').read_bytes()).hexdigest(),
        'inputScene':args.scene.name,'inputSceneSha256':hashlib.sha256(args.scene.read_bytes()).hexdigest(),
        'replacedMaterial':'PaleVaultPlaster','previousVertices':old_vertices,'previousFaces':old_faces,
        'coffers':len(created),'vertices':sum(len(o.data.vertices) for o in created),
        'triangles':sum(len(o.data.polygons) for o in created),
        'crownMain':max(v.co.z for o in created for v in o.data.vertices),
        'reliefInterpretation':'Existing five bands at vertical depths0.36,0.36,0.29,0.065,0m; nominal10ft projected module and outline retained. Depth/count remain reconstructed.',
        'normalOffsetFoldRemoved':True,'axisYArchNormalCorrectionAlreadyPresentInInput':True}
assert abs(report['crownMain']-143*.3048)<1e-4
assert report['coffers']==341
ns['batch_static'](hall)
ns['export']('model-waiting-room.glb',hall)
for obj in hall.objects:obj.location.z-=drop
bpy.context.scene['vault_geometry_revision']=4
bpy.context.scene['coffer_relief_interpretation']=report['reliefInterpretation']
bpy.context.preferences.filepaths.save_version=0
blend=args.out/'penn-station-ceiling-corrected.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend.resolve()),compress=True)
report['outputScene']=blend.name;report['outputSceneSha256']=hashlib.sha256(blend.read_bytes()).hexdigest()
raw=args.out/'model-waiting-room.glb';report['rawGlbSha256']=hashlib.sha256(raw.read_bytes()).hexdigest()
(args.out/'ceiling-geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
