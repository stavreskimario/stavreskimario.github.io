"""Restore exactly five Phase14 continuity physical-source archives from an immutable Git checkpoint."""
from pathlib import Path
import argparse,gzip,hashlib,json,re,struct,subprocess
HDR={
 'authoring/penn-station-1935/lighting/phase14-continuity/raw/lighting-platform-continuity-sky.hdr.gz',
 'authoring/penn-station-1935/lighting/phase14-continuity/denoised/lighting-platform-continuity-sky-denoised-linear.hdr.gz',
 'authoring/penn-station-1935/lighting/phase14-floor/raw/lighting-platform-continuity-floor-sky.hdr.gz',
 'authoring/penn-station-1935/lighting/phase14-floor/denoised/lighting-platform-continuity-floor-sky-denoised-linear.hdr.gz',
}
PROBE='authoring/penn-station-1935/lighting/phase14-continuity/reflections/reflection-platform-enclosure-linear.exr.gz'
ALLOWED=HDR|{PROBE}
def zstr(data,start):
 end=data.index(0,start);return data[start:end].decode('ascii'),end+1

def verify_exr(data):
 assert data[:4]==bytes.fromhex('762f3101'),'Actual OpenEXR magic required'
 version=struct.unpack_from('<I',data,4)[0];assert version&0xff==2
 off=8;attrs={}
 while data[off]!=0:
  name,off=zstr(data,off);typ,off=zstr(data,off);n=struct.unpack_from('<I',data,off)[0];off+=4;assert n<=len(data)-off;attrs[name]=(typ,data[off:off+n]);off+=n
 assert attrs['dataWindow'][0]=='box2i';box=struct.unpack('<iiii',attrs['dataWindow'][1]);width,height=box[2]-box[0]+1,box[3]-box[1]+1;assert(width,height)==(2048,1024)
 assert attrs['channels'][0]=='chlist';channels={};c=attrs['channels'][1];pos=0
 while c[pos]!=0:
  name,pos=zstr(c,pos);typ=struct.unpack_from('<i',c,pos)[0];xs,ys=struct.unpack_from('<ii',c,pos+8);pos+=16;channels[name]=(typ,xs,ys)
 assert set(channels)==set('RGBA') and all(v==(2,1,1)for v in channels.values()),'Every RGBA channel must remain Float32 with1x1 sampling'
 return dict(width=width,height=height,channels={k:dict(pixelType='FLOAT32',xSampling=v[1],ySampling=v[2])for k,v in sorted(channels.items())})

def validate_archive(entry,b):
 assert isinstance(entry['bytes'],int) and not isinstance(entry['bytes'],bool) and 0<entry['bytes']<100_000_000
 assert len(b)==entry['bytes'] and hashlib.sha256(b).hexdigest()==entry['sha256'];data=gzip.decompress(b)
 assert len(data)==entry['decodedBytes'] and hashlib.sha256(data).hexdigest()==entry['decodedSha256']
 if entry['path']==PROBE:
  info=verify_exr(data);assert entry['width']==info['width'] and entry['height']==info['height'];assert entry['channels']==info['channels']
 else:
  assert data.startswith(b'#?RADIANCE');res=re.search(rb'\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)',data[:4096]);assert res and [int(res[1]),int(res[2])]==[4096,4096]
  assert(entry['width'],entry['height'])==(4096,4096)
 return data

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);ap.add_argument('--receipt',type=Path,default=Path(__file__).with_name('current-continuity-hdr-archives.json'));ap.add_argument('--output-directory',type=Path);ap.add_argument('--verify-only',action='store_true');a=ap.parse_args();repo=a.repository.resolve();out=(a.output_directory or repo).resolve();d=json.loads(a.receipt.read_text());entries=d['files'];assert len(entries)==5 and {e['path']for e in entries}==ALLOWED
 checkpoint=d['sourceCheckpoint'];assert isinstance(checkpoint,str) and re.fullmatch('[a-f0-9]{40}',checkpoint),'Proposed receipts must be bound to an immutable source checkpoint first'
 verified=[]
 for e in entries:
  assert e['commit']==checkpoint and re.fullmatch('[a-f0-9]{40}',e['blob']) and re.fullmatch('[a-f0-9]{64}',e['sha256']) and re.fullmatch('[a-f0-9]{64}',e['decodedSha256'])
  actual=subprocess.check_output(['git','rev-parse',f"{checkpoint}:{e['path']}"],cwd=repo,text=True).strip();assert actual==e['blob'],'Exact archive membership in recorded commit/path required'
  b=subprocess.check_output(['git','cat-file','blob',e['blob']],cwd=repo);validate_archive(e,b)
  p=(out/e['path']).resolve();assert out in p.parents
  if p.exists():assert p.read_bytes()==b,'Refusing to overwrite different content'
  verified.append((p,b,e))
 for p,b,e in verified:
  if not a.verify_only and not p.exists():
   p.parent.mkdir(parents=True,exist_ok=True)
   with p.open('xb')as stream:stream.write(b)
   assert hashlib.sha256(p.read_bytes()).hexdigest()==e['sha256']
 print(json.dumps(dict(status='PASS exact5 immutableGit archive membership, compressed/decoded bytes, HDR dimensions and Float32EXR channels',sourceCheckpoint=checkpoint,verifiedOnly=a.verify_only,outputDirectory=str(out),files=[dict(path=e['path'],sha256=e['sha256'],bytes=e['bytes'])for p,b,e in verified]),indent=2))
if __name__=='__main__':main()
