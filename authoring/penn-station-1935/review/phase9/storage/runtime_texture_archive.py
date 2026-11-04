"""Read-only current-model guard and exact recovery; never removes files."""
from pathlib import Path,PurePosixPath
import argparse,gzip,hashlib,json,re,struct,subprocess
H=lambda b:hashlib.sha256(b).hexdigest()
def read_plan(path):
 b=Path(path).read_bytes();return json.loads(gzip.decompress(b)if str(path).endswith('.gz')else b)
def checked_path(value):
 p=PurePosixPath(value);assert not p.is_absolute()and len(p.parts)==4 and p.parts[:3]==('penn-station-1935','assets','textures')and re.fullmatch('[a-f0-9]{20}\\.ktx2',p.name),'Only the exact scoped content-addressed texture paths are allowed';return p

def verify(repo,plan,after=False):
 repo=Path(repo).resolve();assert len(plan['models'])==12 and len(plan['protectedTextures'])==89 and len(plan['proposedArchival'])==8;refs=set();entries=0
 for row in plan['models']:
  b=(repo/row['file']).read_bytes();assert len(b)==row['bytes']and H(b)==row['sha256'],'Frozen current model changed';raw=gzip.decompress(b);assert len(raw)==row['decodedBytes']and H(raw)==row['decodedSha256'];n,t=struct.unpack_from('<II',raw,12);assert t==0x4e4f534a;j=json.loads(raw[20:20+n]);actual=[]
  for i,image in enumerate(j.get('images',[])):
   assert re.fullmatch(r'textures/[a-f0-9]{20}\.ktx2',image['uri']);actual.append({'imageIndex':i,'uri':image['uri'],'mimeType':image.get('mimeType')});refs.add(image['uri']);entries+=1
  assert actual==row['imageArrayEntries'],'Every image array slot, including unused slots, stays protected'
 assert len(refs)==89 and entries==182;assert refs=={x['uri']for x in plan['protectedTextures']}
 for row in plan['protectedTextures']+plan['protectedMetadata']:
  b=(repo/row['file']).read_bytes();assert len(b)==row['bytes']and H(b)==row['sha256'],'Protected image/metadata changed'
 for row in plan['proposedArchival']:
  checked_path(row['file']);assert row['uri']not in refs;target=repo/row['file']
  if after:assert not target.exists(),'Proposed archived path still exists'
  else:
   b=target.read_bytes();assert len(b)==row['bytes']and H(b)==row['sha256'],'Proposed file changed'
 return {'schema':1,'status':'PASS','mode':'after-archival'if after else'before-archival','models':12,'allImageArrayEntries':entries,'protectedTextures':len(refs),'proposedFiles':8,'proposedBytes':sum(x['bytes']for x in plan['proposedArchival']),'rootFilesWritten':False}

def recover(plan,out,git_repo=None,backup=None):
 out=Path(out).resolve();assert not out.exists(),'Choose a fresh external output directory';assert bool(git_repo)^bool(backup),'Choose exactly one recovery source';assert re.fullmatch('[a-f0-9]{40}',plan['sourceCommit']);data=[]
 if git_repo:
  repo=Path(git_repo).resolve();assert out!=repo and repo not in out.parents,'Recover externally before choosing any restoration'
 for row in plan['proposedArchival']:
  rel=checked_path(row['file'])
  b=subprocess.check_output(['git','show',plan['sourceCommit']+':'+str(rel)],cwd=git_repo)if git_repo else(Path(backup)/str(rel)).read_bytes();assert len(b)==row['bytes']and H(b)==row['sha256'],'Recovery source/pin mismatch';data.append((str(rel),b,row))
 assert len(data)==8;out.mkdir(parents=True)
 for rel,b,row in data:
  target=out/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);assert target.read_bytes()==b
 result={'schema':1,'status':'PASS','method':'immutable Git'if git_repo else'verified external backup','sourceCommit':plan['sourceCommit'],'recoveredFiles':8,'recoveredBytes':sum(len(b)for _,b,_ in data),'allBytesExact':True,'rootFilesWritten':False};(out/'recovery-proof.json').write_text(json.dumps(result,indent=2)+'\n');return result

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['verify','recover']);p.add_argument('--manifest',type=Path,required=True);p.add_argument('--repo',type=Path);p.add_argument('--after',action='store_true');p.add_argument('--out',type=Path);p.add_argument('--git-repo',type=Path);p.add_argument('--backup',type=Path);a=p.parse_args();plan=read_plan(a.manifest)
 if a.action=='verify':assert a.repo;result=verify(a.repo,plan,a.after)
 else:assert a.out;result=recover(plan,a.out,a.git_repo,a.backup)
 print(json.dumps(result,indent=2))
