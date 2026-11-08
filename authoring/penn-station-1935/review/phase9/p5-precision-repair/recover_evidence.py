"""Losslessly extract the indexed review receipts into a fresh external directory."""
from pathlib import Path
import argparse,gzip,hashlib,json
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parent;out=a.out.resolve()
if out.exists():raise ValueError('Choose a fresh extraction directory')
rows=json.loads((root/'archive-index.json').read_text())['archives'];payloads=[]
for row in rows:
 source=root/row['file'];b=source.read_bytes()
 if hashlib.sha256(b).hexdigest()!=row['sha256']:raise ValueError('Archive pin mismatch: '+row['file'])
 decoded=gzip.decompress(b)
 if hashlib.sha256(decoded).hexdigest()!=row['decodedSha256']or len(decoded)!=row['decodedBytes']:raise ValueError('Decoded pin mismatch: '+row['file'])
 target=out/row['file'][:-3]
 if not target.resolve().is_relative_to(out):raise ValueError('Invalid relative archive path')
 payloads.append((target,decoded))
out.mkdir(parents=True)
for target,b in payloads:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
print(json.dumps({'status':'PASS','archives':len(payloads),'out':str(out)}))
