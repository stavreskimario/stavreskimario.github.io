from pathlib import Path
import json,hashlib
from floor_clip import area,partition
D=Path(__file__).resolve().parent;H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for q in ['full','low']:
 p=D/f'input-{q}.json';v=json.loads(p.read_text());rows=[];owned=[];kept=[]
 for item in v['items']:
  inside,outside=partition(item['corners'],v['roi']);a=area(item['corners']);b=sum(area(t)for t in inside+outside);assert abs(a-b)<max(1e-7,a*1e-10),(item,a,b)
  if not inside:continue
  record={k:x for k,x in item.items()if k!='corners'};record.update({'sourceCorners':item['corners'],'ownedTriangles':inside,'retainedTriangles':outside,'originalAreaM2':a,'ownedAreaM2':sum(area(t)for t in inside),'retainedAreaM2':sum(area(t)for t in outside),'conservedAreaErrorM2':abs(a-b)})
  z=sum(c['pos'][2]for c in item['corners'])/3
  if item['material']=='Railway smooth concrete track base':cache='Continuous station railway concrete foundation';cachePlane=-9.22337532043457
  else:
   platform=4 if z>20 else 5;family='continuous30-inch-gridded granolithic dressing'if'Stippled'in item['material']else'source-section continuous walls and coved slab';cache=f'Platform {platform:02d} '+family;cachePlane=None
  record['cacheCounterpartOwner']=cache;record['cachePlaneMain0Y']=cachePlane;rows.append(record)
  for t in inside:owned.append({'sourceNode':item['node'],'sourceOwner':item['owner'],'sourcePrimitive':item['primitive'],'sourceTriangleOffset':item['triangleOffset'],'material':item['material'],'cacheOwner':cache,'corners':t})
  for t in outside:kept.append({'sourceNode':item['node'],'sourcePrimitive':item['primitive'],'sourceTriangleOffset':item['triangleOffset'],'materialIndex':item['materialIndex'],'material':item['material'],'corners':t})
 report={'status':'PASS exactsource-floor partition; no overlays or changed oldsource shape','coordinateSpace':v['coordinateSpace'],'variant':q,'source':v['source'],'inputPin':H(p),'roi':v['roi'],'sourceTrianglesReplaced':len(rows),'ownedTriangleCount':len(owned),'retainedBoundaryTriangleCount':len(kept),'ownedAreaM2':sum(x['ownedAreaM2']for x in rows),'maximumAreaConservationErrorM2':max((x['conservedAreaErrorM2']for x in rows),default=0),'rows':rows,'ownedTriangles':owned,'retainedBoundaryTriangles':kept,'cacheOwners':sorted(set(x['cacheCounterpartOwner']for x in rows)),'qualification':'Lightingownershipboundaryonly; actualP/N/materialUV0copied/interpolatedfromsource. OldlightingUV1preservedonretainedoutsidepieces; omittedonlyinfreshprimarysourcefornewGI. Allotherexistinggeometryprefixesretained.'};(D/f'partition-{q}.json').write_text(json.dumps(report,indent=2)+'\n');print(q,{k:report[k]for k in['sourceTrianglesReplaced','ownedTriangleCount','retainedBoundaryTriangleCount','ownedAreaM2','maximumAreaConservationErrorM2']})
f=json.loads((D/'partition-full.json').read_text());l=json.loads((D/'partition-low.json').read_text());assert f['ownedTriangles']==l['ownedTriangles'],'Oneactualfloorsourceforbothqualities';print('PASS full/low ownedfloors EXACTsame triangle/attribute identities')
