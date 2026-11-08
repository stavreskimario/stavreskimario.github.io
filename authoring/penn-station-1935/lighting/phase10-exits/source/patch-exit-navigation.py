"""Add permissions for an independently authored arrivals exit route.

This does not create floors, supply analytic height planes, or bypass collision.
The caller must separately verify source/encoded geometry and native walking.
"""
from pathlib import Path
import argparse, copy, hashlib, json, math
p=argparse.ArgumentParser()
p.add_argument('--manifest',required=True,type=Path)
p.add_argument('--route',required=True,type=Path)
p.add_argument('--out',required=True,type=Path)
p.add_argument('--report',required=True,type=Path)
a=p.parse_args()
assert not a.out.exists() and not a.report.exists(), 'Use fresh output paths'
assert a.out.resolve() not in {a.manifest.resolve(),a.route.resolve()}
H=lambda b:hashlib.sha256(b).hexdigest()
mb=a.manifest.read_bytes();rb=a.route.read_bytes();m=json.loads(mb);r=json.loads(rb)
assert r.get('coordinateSpace')=='world-glTF', 'Route permissions must use registered world coordinates'
assert 'arrivalsExitRoute' not in m, 'Refuse a duplicate route insertion'
def vector(v,n):
 assert isinstance(v,list) and len(v)==n and all(isinstance(x,(float,int)) and not isinstance(x,bool) and math.isfinite(x) for x in v)
def label(v): assert isinstance(v,str) and v.strip() and len(v)<200
areas=r.get('walkable');flights=r.get('stairSupportFlights')
assert isinstance(areas,list) and areas, 'Need authored corridor/landing/stair permission bounds'
assert isinstance(flights,list) and flights, 'Need actual escalator/stair flight endpoints'
existing_labels={x.get('label') for x in m.get('walkable',[])}
for area in areas:
 label(area.get('label'));vector(area.get('bounds'),4)
 b=area['bounds'];assert b[0]<b[1] and b[2]<b[3]
 assert area['label'] not in existing_labels;existing_labels.add(area['label'])
for flight in flights:
 label(flight.get('label'));vector(flight.get('start'),3);vector(flight.get('end'),3)
 assert math.hypot(flight['end'][0]-flight['start'][0],flight['end'][2]-flight['start'][2])>0
 assert isinstance(flight.get('width'),(float,int)) and .64<flight['width']<20
 assert flight['start'][1]!=flight['end'][1]
 if 'steps' in flight: assert isinstance(flight['steps'],int) and flight['steps']>0
for waypoint in r.get('waypoints',[]): label(waypoint.get('label'));vector(waypoint.get('position'),3)
if 'cameraPreset' in r:
 preset=r['cameraPreset']
 for key in ['eye','target','walk','look']:vector(preset.get(key),3)
 label(preset.get('title'));assert isinstance(preset.get('caption'),str)
before=copy.deepcopy(m)
m.setdefault('walkable',[]).extend([{**area,'geometryBasedFloorRayRequired':True} for area in areas])
m.setdefault('stairSupportFlights',[]).extend(copy.deepcopy(flights))
m['arrivalsExitRoute']={k:copy.deepcopy(v) for k,v in r.items() if k not in {'walkable','stairSupportFlights'}}
m['arrivalsExitRoute'].update({'permissionBounds':copy.deepcopy(areas),'stairs':copy.deepcopy(flights),'routeSpecificationSha256':H(rb),'supportPolicy':'Every walking foot requires actual authored mesh support and body/head clearance; no analytic exit-route height planes.'})
for key,value in before.items():
 if key not in {'walkable','stairSupportFlights'}:assert m[key]==value,key
assert m['walkable'][:len(before.get('walkable',[]))]==before.get('walkable',[])
assert m['stairSupportFlights'][:len(before.get('stairSupportFlights',[]))]==before.get('stairSupportFlights',[])
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(m,indent=2)+'\n')
report={'status':'PASS manifest permissions only; actual geometry/native walking remain required','inputManifestSha256':H(mb),'routeSpecificationSha256':H(rb),'outputManifestSha256':H(a.out.read_bytes()),'addedPermissionAreas':len(areas),'addedFlights':len(flights),'retainedOtherManifestFieldsExact':True,'newAnalyticFloorsOrCollisionExclusions':0,'helperSha256':H(Path(__file__).read_bytes())}
a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
