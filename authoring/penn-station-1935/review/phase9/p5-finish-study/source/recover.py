"""Recover exact P5 study and base GLBs into a NEW external directory."""
from pathlib import Path
import argparse,gzip,hashlib,json,struct
ROOT=Path(__file__).resolve().parent.parent
H=lambda b:hashlib.sha256(b).hexdigest()
def recover(out):
 out=Path(out).resolve();assert not out.exists(),'Choose a new external output directory'
 pins=json.loads((ROOT/'artifact-pins.json').read_text());out.mkdir(parents=True)
 for row in pins['artifacts']:
  b=(ROOT/row['file']).read_bytes();assert len(b)==row['bytes']and H(b)==row['sha256'],row['file'];data=gzip.decompress(b)if row['gzip']else b;assert len(data)==row['decodedBytes']and H(data)==row['decodedSha256'];target=out/row['output'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 b=(out/'frozen/p5-study-source-plus-finish.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];binary=b[28+n:];header=(out/'source/original-glb-header-json.bin').read_bytes();original=header+binary[:pins['sourceBinaryBytes']];assert len(original)==pins['sourceBytes']and H(original)==pins['sourceSha256'];(out/'source/arrivals-module.glb').write_bytes(original)
 report={'schema':1,'status':'PASS: exact original ba0 and complete combined study/addon geometry recovered','sourceSha256':H(original),'combinedSha256':H(b),'fullEditableBlendIncluded':False,'scope':'Lossless original source recovery, not a claim of exact full.blend binary regeneration.'};(out/'recovery-proof.json').write_text(json.dumps(report,indent=2)+'\n');return out
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();out=recover(a.out);print(out)
