"""Actual imported-v3 triangles: glass, opaque pads, seams and retained stairs."""
import hashlib,json,math
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

work=Path('/Users/stavreskimario/Desktop/penn-station-work')
root=work/'phase4-core-floor-v3-ready'
model=root/'model-concourse.glb'
manifest=json.loads((root/'scene-manifest.json').read_text())
prior=json.loads((work/'phase4-core-final/scene-manifest.json').read_text())
vault=manifest['concourseDetails']['vaultLights'];coverage=vault['coverage']
for key in ['levels','accessStairs','stairSupportFlights','mainStair']:
    if manifest[key]!=prior[key]:raise RuntimeError('Retained navigation metadata changed:'+key)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(model));bpy.context.view_layer.update()
trees={};records=[];grid={}
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    key=obj.data.as_pointer()
    if key not in trees:trees[key]=BVHTree.FromPolygons([v.co for v in obj.data.vertices],[tuple(p.vertices) for p in obj.data.polygons])
    corners=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    rec={'object':obj,'tree':trees[key],'inverse':obj.matrix_world.inverted(),'x':[min(c.x for c in corners),max(c.x for c in corners)],'y':[min(c.y for c in corners),max(c.y for c in corners)],'materials':[m.name for m in obj.data.materials if m]}
    records.append(rec)
    for x in range(math.floor(rec['x'][0]/2),math.floor(rec['x'][1]/2)+1):
        for y in range(math.floor(rec['y'][0]/2),math.floor(rec['y'][1]/2)+1):grid.setdefault((x,y),[]).append(rec)

def hits(x,y,prefixes,start=.5,distance=2):
    found=[];origin=Vector((x,y,start))
    for rec in grid.get((math.floor(x/2),math.floor(y/2)),[]):
        if not any(name.startswith(prefixes) for name in rec['materials']):continue
        if not rec['x'][0]-1e-5<=x<=rec['x'][1]+1e-5 or not rec['y'][0]-1e-5<=y<=rec['y'][1]+1e-5:continue
        hit,normal,_,_=rec['tree'].ray_cast(rec['inverse']@origin,rec['inverse'].to_3x3()@Vector((0,0,-1)),distance)
        if hit is not None:
            world=rec['object'].matrix_world@hit
            normal=(rec['object'].matrix_world.to_3x3().inverted().transposed()@normal).normalized()
            found.append({'z':world.z,'normalZ':normal.z,'material':rec['materials']})
    return sorted(found,key=lambda hit:-hit['z'])

errors={key:[] for key in ['glass','web','opaqueUnderGlass','bearingCells','pierFootprints','fieldBoundaries','stairs','axialPassage']}
counts={key:0 for key in errors};digest=hashlib.sha256()
def check(kind,point,prefixes,z,start=.5):
    result=hits(*point,prefixes,start=start)
    passed=bool(result) and abs(result[0]['z']-z)<3e-5 and result[0]['normalZ']>.99
    item={'kind':kind,'point':list(point),'expectedZ':z,'hit':result[:1],'pass':passed}
    counts[kind]+=1;digest.update(json.dumps(item,sort_keys=True).encode())
    if not passed:errors[kind].append(item)

opaque=('ConcourseOpaqueCirculationConcrete',)
web=('ConcourseReinforcedVaultLightConcrete',)
for x0,x1,y0,y1 in vault['activePanelCellsBlenderXY']:
    for u,v in [(.06,.06),(.54,.66),(1.14,1.14)]:
        point=(x0+u,y0+v)
        check('glass',point,('SquareVaultLightGlass',),-.005)
        under=hits(*point,opaque+web+('PublicFloorMarble',))
        counts['opaqueUnderGlass']+=1
        if under and under[0]['z']>-.44:errors['opaqueUnderGlass'].append({'point':point,'hit':under[:1]})
    check('web',(x0+.60,y0+.60),web,0)
for item in coverage['retainedConcreteBearingCells']:
    x0,x1,y0,y1=item['cellBlenderXY']
    for u in [.05,.60,1.15]:
        for v in [.05,.60,1.15]:check('bearingCells',(x0+u,y0+v),opaque,0)
for index in coverage['bearingPadsIntersectingField']:
    pad=coverage['bearingPads'][index];x,y=pad['centreBlenderXY'];half=pad['baseHalfWidth']-.015
    for dx in [-half,0,half]:
        for dy in [-half,0,half]:check('pierFootprints',(x+dx,y+dy),opaque,0)
x0,x1,y0,y1=coverage['boundingFieldBlenderXY']
for i in range(round((y1-y0)/.6)+1):
    y=y0+(i+.37)*.6
    for x in [x0-.01,x0+.01,x1-.01,x1+.01]:check('fieldBoundaries',(x,y),opaque+web,0)
for i in range(round((x1-x0)/.6)+1):
    x=x0+(i+.37)*.6
    for y in [y0-.01,y0+.01,y1-.01,y1+.01]:check('fieldBoundaries',(x,y),opaque+web,0)
drop=manifest['levels']['mainToStreet']
floor_materials=opaque+web+('PublicFloorMarble','Travertine','SquareVaultLightGlass')
for flight in manifest['stairSupportFlights']:
    a,b=flight['start'],flight['end'];steps=19 if flight['label'].startswith('Main-to-exit') else 15
    for k in [0,steps//2,steps-1]:
        t=(k+.5)/steps;point=(a[0]+(b[0]-a[0])*t,-(a[2]+(b[2]-a[2])*t));z=a[1]+drop+(b[1]-a[1])*k/steps
        check('stairs',point,floor_materials,z,start=z+.40)
east=-73+(210+11/12)*.3048/2
for i in range(31):
    y=-7.5+i*.5
    for z in [.2,1.0,1.68,2.5,3.95,4.04]:
        origin=Vector((east-1,y,z));counts['axialPassage']+=1
        for rec in records:
            if rec['x'][1]<east-1 or rec['x'][0]>east+1 or not rec['y'][0]-.001<=y<=rec['y'][1]+.001:continue
            hit=rec['tree'].ray_cast(rec['inverse']@origin,rec['inverse'].to_3x3()@Vector((1,0,0)),2)[0]
            if hit is not None:errors['axialPassage'].append({'point':[y,z],'object':rec['object'].name,'hit':list(rec['object'].matrix_world@hit)});break
report={'scope':'Actual final raw glTF triangles before lighting/compression; verifies broad glass fields, retained opaque cells/base footprints, boundaries and unchanged source stair levels. Browser walking remains a separate test.','modelSha256':hashlib.sha256(model.read_bytes()).hexdigest(),'coverage':{k:v for k,v in coverage.items() if k not in ['retainedConcreteBearingCells','bearingPads']},'counts':counts,'errors':errors,'sampleResultSha256':digest.hexdigest(),'retainedNavigationMetadataEqualToV2':True,'passed':not any(errors.values())}
(root/'floor-v3-actual-ray-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'counts':counts,'errors':{k:len(v) for k,v in errors.items()},'passed':report['passed']}),flush=True)
if not report['passed']:raise RuntimeError('V3actual floor geometry audit failed')
