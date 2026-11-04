"""Verify the complete portable packet and lossless archives without Blender."""
from pathlib import Path
import gzip,hashlib,json
R=Path(__file__).resolve().parent.parent;H=lambda b:hashlib.sha256(b).hexdigest();m=json.loads((R/'PACKAGE-MANIFEST.json').read_text());expected={r['path']for r in m['files']}|{'PACKAGE-MANIFEST.json'};actual={str(p.relative_to(R))for p in R.rglob('*')if p.is_file()};assert actual==expected,{'unexpected':sorted(actual-expected),'missing':sorted(expected-actual)}
for r in m['files']:
 b=(R/r['path']).read_bytes();assert len(b)==r['bytes']and H(b)==r['sha256'],r['path']
rows=json.loads((R/'archive-index.json').read_text())['archives']
for r in rows:
 b=(R/r['file']).read_bytes();assert len(b)==r['bytes']and H(b)==r['sha256'];decoded=gzip.decompress(b);assert len(decoded)==r['decodedBytes']and H(decoded)==r['decodedSha256']
print(json.dumps({'status':'PASS','files':len(actual),'losslessArchives':len(rows),'packetSha256':H((R/'PACKAGE-MANIFEST.json').read_bytes()),'noGpuBlenderRootOrCanonicalWrites':True}))
