"""Replay recorded permanent-row coordinates and qualified authoring deltas."""
from pathlib import Path
import json
p=Path(__file__).with_name('FROZEN-ADJACENT-ROWS-v1.json');d=json.loads(p.read_text());s=d['source']['metresPerNativePixel'];axis=d['source']['terminalAxisNativeU'];rows=[]
for r in d['rows']:
 z=(axis-r['nativeU'])*s;assert abs(z-r['observedWorldZ'])<1e-10;assert abs(r['authoringWorldZ']-z-r['coordinationDeltaZ'])<1e-10;rows.append({'id':r['id'],'nativeU':r['nativeU'],'observedWorldZ':z,'authoringWorldZ':r['authoringWorldZ'],'deltaZ':r['coordinationDeltaZ']})
widths=[b['authoringWorldZ']-a['authoringWorldZ'] for a,b in zip(d['rows'],d['rows'][1:])];assert all(d['primarySpanFamilyM'][0]<=w<=d['primarySpanFamilyM'][1] for w in widths)
print(json.dumps({'status':'PASS recorded source/arithmetic only; no actual geometry/clearance certification','rows':rows,'bayWidthsM':widths,'coverageDepthM':d['rows'][-1]['authoringWorldZ']-d['rows'][0]['authoringWorldZ']},indent=2))
