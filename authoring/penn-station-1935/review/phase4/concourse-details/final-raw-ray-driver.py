"""Independent rays on the actual final exported glTF, not source bounds alone."""
import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root = Path('/Users/stavreskimario/Desktop/penn-station-work/phase4-core-final')
model = root/'model-concourse.glb'
out = Path('/Users/stavreskimario/Desktop/penn-station-work/concourse-final-ray-audit.json')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(model))
bpy.context.view_layer.update()
trees = {}
records = []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    key = obj.data.as_pointer()
    if key not in trees:
        trees[key] = BVHTree.FromPolygons([v.co for v in obj.data.vertices], [tuple(p.vertices) for p in obj.data.polygons])
    corners = [obj.matrix_world@Vector(c) for c in obj.bound_box]
    records.append({'object': obj, 'tree': trees[key], 'inverse': obj.matrix_world.inverted(), 'x': [min(c.x for c in corners), max(c.x for c in corners)], 'y': [min(c.y for c in corners), max(c.y for c in corners)], 'materials': [m.name for m in obj.data.materials if m]})

def vertical_hits(x, y, groups):
    hits = []
    origin = Vector((x, y, .50))
    for rec in records:
        if not any(name.startswith(groups) for name in rec['materials']):
            continue
        if not (rec['x'][0]-1e-5 <= x <= rec['x'][1]+1e-5 and rec['y'][0]-1e-5 <= y <= rec['y'][1]+1e-5):
            continue
        local_origin = rec['inverse']@origin
        direction = rec['inverse'].to_3x3()@Vector((0,0,-1))
        hit, normal, _, distance = rec['tree'].ray_cast(local_origin, direction, 2)
        if hit is not None:
            world = rec['object'].matrix_world@hit
            n = (rec['object'].matrix_world.to_3x3().inverted().transposed()@normal).normalized()
            hits.append({'z': world.z, 'normalZ': n.z, 'material': rec['materials']})
    return sorted(hits, key=lambda h:-h['z'])

fields = [(-88.2,-69.0,23.4,35.4),(-88.2,-69.0,-35.4,-23.4)]
glass_samples = []
concrete_samples = []
duplicate_slab_samples = []
for field, (x0,x1,y0,y1) in enumerate(fields):
    for row in range(10):
        for column in range(16):
            px,py=x0+column*1.2,y0+row*1.2
            for u,v in [(.06,.06),(.54,.66),(1.14,1.14)]:
                x,y=px+u,py+v
                hit=vertical_hits(x,y,('SquareVaultLightGlass',))
                passed=bool(hit) and abs(hit[0]['z']+.005)<2e-5 and hit[0]['normalZ']>.99
                glass_samples.append({'field':field+1,'panel':[column,row],'point':[x,y],'pass':passed,'hit':hit[:1]})
                slab=vertical_hits(x,y,('PublicFloorMarble',))
                if slab and slab[0]['z']>-.44:
                    duplicate_slab_samples.append({'point':[x,y],'hit':slab[:1]})
            hit=vertical_hits(px+.60,py+.60,('ConcourseReinforcedVaultLightConcrete',))
            concrete_samples.append({'field':field+1,'panel':[column,row],'pass':bool(hit) and abs(hit[0]['z'])<2e-5 and hit[0]['normalZ']>.99,'hit':hit[:1]})

# Check the existing low axial route against the entire actual imported mesh.
blocked=[]
east=-73+(210+11/12)*.3048/2
for i in range(31):
    y=-7.5+i*.5
    for z in [.2,1.0,1.68,2.5,3.95,4.04]:
        origin=Vector((east-1,y,z))
        for rec in records:
            if rec['x'][1]<east-1 or rec['x'][0]>east+1 or not rec['y'][0]-.001<=y<=rec['y'][1]+.001:
                continue
            hit=rec['tree'].ray_cast(rec['inverse']@origin,rec['inverse'].to_3x3()@Vector((1,0,0)),2)[0]
            if hit is not None:
                blocked.append({'point':[y,z],'object':rec['object'].name,'hit':list(rec['object'].matrix_world@hit)})
                break
report={'scope':'Actual final raw glTF geometry before compression and baking; not final browser navigation acceptance. Blender importer restores X east,Y north,Z up with local Main0.', 'modelSha256':hashlib.sha256(model.read_bytes()).hexdigest(), 'glassSupportRays':len(glass_samples), 'glassFailures':[s for s in glass_samples if not s['pass']], 'concreteSupportRays':len(concrete_samples), 'concreteFailures':[s for s in concrete_samples if not s['pass']], 'opaqueMainSlabUnderGlassFailures':duplicate_slab_samples, 'axialPassageRays':186, 'axialPassageBlockers':blocked, 'glassSamples':glass_samples, 'concreteSamples':concrete_samples}
report['passed']=not any(report[key] for key in ['glassFailures','concreteFailures','opaqueMainSlabUnderGlassFailures','axialPassageBlockers'])
out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['glassSamples','concreteSamples']}),flush=True)
if not report['passed']:
    raise RuntimeError('Final exported concourse geometry audit failed')
