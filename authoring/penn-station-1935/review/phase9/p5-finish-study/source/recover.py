"""Losslessly recover source and accepted GLBs into a fresh external directory."""
from pathlib import Path
import argparse,gzip,hashlib,json,struct
ROOT=Path(__file__).resolve().parent.parent
H=lambda b:hashlib.sha256(b).hexdigest()
def recover(out):
 out=Path(out).resolve();assert not out.exists(),'Choose a new external directory';out.mkdir(parents=True)
 pins=json.loads((ROOT/'artifact-pins.json').read_text())
 for r in pins['artifacts']:
  b=(ROOT/r['file']).read_bytes();assert len(b)==r['bytes']and H(b)==r['sha256'],r['file'];data=gzip.decompress(b)if r['gzip']else b;assert len(data)==r['decodedBytes']and H(data)==r['decodedSha256'];target=out/r['output'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 b=(out/'frozen/west-p5-curved-study.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];binary=b[28+n:]
 rows=[]
 for key,header,name in [('base','ba0-header-json.bin','arrivals-module.glb'),('flat','flat-header-json.bin','p5-flat-source.glb')]:
  p=pins[key];h=(out/'source'/header).read_bytes();assert H(h)==p['headerSha256'];data=h+binary[:p['binaryBytes']];assert len(data)==p['bytes']and H(data)==p['sha256'];target=out/'source'/name;target.write_bytes(data);rows.append({'kind':key,'file':str(target),'bytes':len(data),'sha256':H(data),'exactHeaderAndBinaryPrefixRecovery':True})
 adj=gzip.decompress((ROOT/'proposal/source-adjacencies.json.gz').read_bytes());assert H(adj)=='5ec73eeb9c56ce8054ea69f7ca9ab6ac8d67d15b9ddc704c832384648b736cb2';(out/'source/source-adjacencies.json').write_bytes(adj)
 report={'status':'PASS','sources':rows,'acceptedCurvedRawSha256':H(b),'fullBlendBinaryReplayClaimed':False,'scope':'Exact GLB bytes recovered; full editable serialization is separately backed externally.'};(out/'recovery-proof.json').write_text(json.dumps(report,indent=2)+'\n');return out
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();print(recover(a.out))
