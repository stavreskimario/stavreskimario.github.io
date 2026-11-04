"""Restore an activated subset of five exact current Phase13 source archives."""
from pathlib import Path
import argparse,gzip,hashlib,json,re,struct,subprocess
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);ap.add_argument('--receipt',type=Path,default=Path(__file__).with_name('current-enclosure-hdr-archives.json'));a=ap.parse_args();root=a.repository.resolve();d=json.loads(a.receipt.read_text());hdr={
 'authoring/penn-station-1935/lighting/phase13-enclosure/raw/lighting-platform-enclosure-sky.hdr.gz',
 'authoring/penn-station-1935/lighting/phase13-enclosure/denoised/lighting-platform-enclosure-sky-denoised-linear.hdr.gz',
 'authoring/penn-station-1935/lighting/phase13-floor/raw/lighting-platform-enclosure-floor-sky.hdr.gz',
 'authoring/penn-station-1935/lighting/phase13-floor/denoised/lighting-platform-enclosure-floor-sky-denoised-linear.hdr.gz',
};probe='authoring/penn-station-1935/lighting/phase13-enclosure/reflections/reflection-platform-enclosure-linear.exr.gz';allowed=hdr|{probe};entries=d['files'];assert 1<=len(entries)<=5;assert len({e['path'] for e in entries})==len(entries);assert {e['path'] for e in entries}<=allowed

def zstr(data,start):
 end=data.index(0,start);return data[start:end].decode(),end+1

def verify_exr(data):
 assert data[:4]==bytes.fromhex('762f3101');off=8;attrs={}
 while data[off]!=0:
  name,off=zstr(data,off);typ,off=zstr(data,off);n=struct.unpack_from('<I',data,off)[0];off+=4;attrs[name]=(typ,data[off:off+n]);off+=n
 box=struct.unpack('<iiii',attrs['dataWindow'][1]);assert [box[2]-box[0]+1,box[3]-box[1]+1]==[2048,1024];channels={};c=attrs['channels'][1];pos=0
 while c[pos]!=0:
  name,pos=zstr(c,pos);typ=struct.unpack_from('<i',c,pos)[0];xs,ys=struct.unpack_from('<ii',c,pos+8);pos+=16;channels[name]=(typ,xs,ys)
 assert set(channels)==set('RGBA') and all(v==(2,1,1) for v in channels.values())

verified=[]
for e in entries:
 assert re.fullmatch('[a-f0-9]{40}',e['commit']) and re.fullmatch('[a-f0-9]{40}',e['blob']) and re.fullmatch('[a-f0-9]{64}',e['sha256']);assert isinstance(e['bytes'],int) and not isinstance(e['bytes'],bool) and 0<e['bytes']<100000000
 assert subprocess.check_output(['git','rev-parse',f"{e['commit']}:{e['path']}"],cwd=root,text=True).strip()==e['blob'];b=subprocess.check_output(['git','cat-file','blob',e['blob']],cwd=root);assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'];dec=gzip.decompress(b)
 if e['path']==probe:verify_exr(dec)
 else:
  assert dec.startswith(b'#?RADIANCE');res=re.search(rb'\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)',dec[:4096]);assert res and [int(res[1]),int(res[2])]==[4096,4096]
 if e.get('decodedBytes') is not None:assert len(dec)==e['decodedBytes']
 if e.get('decodedSha256') is not None:assert hashlib.sha256(dec).hexdigest()==e['decodedSha256']
 p=(root/e['path']).resolve();assert root in p.parents
 if p.exists():assert p.read_bytes()==b,'Refusing to overwrite different content.'
 verified.append((p,b,e['sha256']))
for p,b,h in verified:
 if not p.exists():
  p.parent.mkdir(parents=True,exist_ok=True)
  with p.open('xb') as out:out.write(b)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==h
 print('Exact current Phase13source present:',p)
print('Run full source/asset/probevalidation for unchangedlinearstatistics,normals,pixels and opticalcontrols.')
