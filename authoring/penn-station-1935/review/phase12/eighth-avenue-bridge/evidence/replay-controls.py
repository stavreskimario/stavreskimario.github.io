"""Replay the recorded source-coordinate arithmetic, with no external dependencies."""
from pathlib import Path
import json,math
p=Path(__file__).with_name('design-scope-v2.json');d=json.loads(p.read_text());b=d['firstVisibleNewEnclosure'];n=b['nativePlanReading'];s=n['knownCrossAvenueWidthM']/(n['eastHouseLineNativeV']-n['westHouseLineNativeV']);rows=[{'nativeU':r['nativeU'],'worldZ':(n['terminalAxisNativeU']-r['nativeU'])*s} for r in n['rows']]
for a,c in zip(rows,n['rows']):assert abs(a['worldZ']-c['worldZ'])<1e-10
stations=[b['adoptedAvenueCenterWorldX']+n*10*.3048 for n in range(-5,6)];assert max(abs(a-c) for a,c in zip(stations,b['columnStationsWorldX']))<1e-10
v=b['verticalControls'];line=v['workingMainY']+(v['sourceUnderClearanceLineFt']-v['sourceMainControlFt'])*.3048;assert abs(line-v['underClearanceComparisonWorldY'])<1e-9
assert d['correctionRecord']['runtimeAoChannel']==0 and d['correctionRecord']['zeroUvRepairClaim']
print(json.dumps({'status':'PASS recorded coordinate arithmetic only','scaleMPerNativePixel':s,'rows':rows,'columnStationsWorldX':stations,'underClearanceComparisonY':line,'grayband':'Only material/GI contrast confirmed; runtime atlasUV0/AOchannel0 valid.'},indent=2))
