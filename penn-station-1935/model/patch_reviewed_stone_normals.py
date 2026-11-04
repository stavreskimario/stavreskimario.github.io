"""Exact bounded normal binding patch; no geometry or appearance-strength edits.

Inputs/output are explicit review paths. Caller pins both original transport and
canonical KTX. Raw material/source names are fixed to the reviewed eight names.
"""
from pathlib import Path
import argparse,copy,gzip,hashlib,json,struct
TARGETS={
 'exterior':['TravertineArcadeCastComposition','TravertineArcadeRepairPhase9','TravertineAshlar-2ArcadeRepairPhase9','TravertineAshlar-1ArcadeRepairPhase9','TravertineAshlar0ArcadeRepairPhase9','TravertineAshlar1ArcadeRepairPhase9','TravertineAshlar2ArcadeRepairPhase9'],
 'arrivals':['TravertineArrivalsStairStone']}
ORIGINAL_URI='textures/3d6f4a3323017ae4bc57.ktx2'
def sha(b):return hashlib.sha256(b).hexdigest()
def parse(b):
 assert b[:4]==b'glTF'and struct.unpack_from('<II',b,4)==(2,len(b));n,t=struct.unpack_from('<II',b,12);assert t==0x4e4f534a and struct.unpack_from('<I',b,24+n)[0]==0x004e4942
 return json.loads(b[20:20+n]),b[20+n:]
def patch(data,scope,texture_uri,expected_sha):
 assert scope in TARGETS and sha(data)==expected_sha,'Expected pinned original transport';packed=data[:2]==b'\x1f\x8b';raw=gzip.decompress(data)if packed else data;old,tail=parse(raw);j=copy.deepcopy(old);names=TARGETS[scope];chosen=[(i,m)for i,m in enumerate(j['materials'])if m['name']in names];assert len(chosen)==len(names)and{m['name']for i,m in chosen}==set(names),'Exact complete reviewed material set'
 indices={m['normalTexture']['index']for i,m in chosen};assert len(indices)==1;oldindex=next(iter(indices));original=j['textures'][oldindex];oldimage=original['extensions']['KHR_texture_basisu']['source'];assert j['images'][oldimage]['uri']==ORIGINAL_URI,'Expected original normal binding'
 ni=len(j['images']);image=copy.deepcopy(j['images'][oldimage]);image['uri']=texture_uri;j['images'].append(image);nt=len(j['textures']);tex=copy.deepcopy(original);tex['extensions']['KHR_texture_basisu']['source']=ni;j['textures'].append(tex);changes=[]
 for i,m in chosen:
  assert abs(m['normalTexture'].get('scale',1)-.035)<1e-7,'Original interpreted strength retained';before=copy.deepcopy(m['normalTexture']);m['normalTexture']['index']=nt;changes.append({'materialIndex':i,'name':m['name'],'before':before,'after':copy.deepcopy(m['normalTexture'])})
 back=copy.deepcopy(j);back['images'].pop();back['textures'].pop()
 for c in changes:back['materials'][c['materialIndex']]['normalTexture']=c['before']
 assert back==old,'Only eight reviewed normal bindings may change';jb=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode();jb+=b' '*((-len(jb))%4);out=struct.pack('<4sIIII',b'glTF',2,20+len(jb)+len(tail),len(jb),0x4e4f534a)+jb+tail;assert parse(out)[1]==tail
 result=gzip.compress(out,compresslevel=9,mtime=0)if packed else out
 return result,{'schema':1,'scope':scope,'inputSha256':sha(data),'inputDecodedSha256':sha(raw),'outputSha256':sha(result),'outputDecodedSha256':sha(out),'inputBytes':len(data),'outputBytes':len(result),'outputDecodedBytes':len(out),'textureURI':texture_uri,'binaryTailBytes':len(tail),'binaryTailSha256':sha(tail),'entireBinaryTailExact':True,'allOtherJsonExact':True,'normalStrengthUnchanged':True,'materialChanges':changes}
def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True,type=Path);p.add_argument('--input-sha256',required=True);p.add_argument('--scope',required=True,choices=TARGETS);p.add_argument('--texture',required=True,type=Path);p.add_argument('--texture-sha256',required=True);p.add_argument('--out',required=True,type=Path);a=p.parse_args();repo=Path(__file__).resolve().parents[2];dest=a.out.resolve();assert dest!=repo and repo not in dest.parents,'Output must be external';assert not dest.exists(),'Fresh external output required';k=a.texture.read_bytes();assert sha(k)==a.texture_sha256;assert k[:12]==bytes.fromhex('ab4b5458203230bb0d0a1a0a');assert struct.unpack_from('<9I',k,12)==(0,1,2048,2048,0,0,1,12,2);dfd=struct.unpack_from('<I',k,48)[0];assert k[dfd+13:dfd+15]==b'\x00\x01','Noncolour linear normal data required';uri='textures/'+sha(k)[:20]+'.ktx2';b=a.input.read_bytes();out,r=patch(b,a.scope,uri,a.input_sha256);dest.mkdir(parents=True);(dest/'textures').mkdir();(dest/a.input.name).write_bytes(out);(dest/uri).write_bytes(k);r.update({'textureBytes':len(k),'textureSha256':sha(k),'generatorSha256':sha(Path(__file__).read_bytes())});(dest/'normal-patch-proof.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
if __name__=='__main__':main()
