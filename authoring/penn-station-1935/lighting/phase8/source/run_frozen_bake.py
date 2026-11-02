"""Root-only quiet-window bake entrypoint. No action without its explicit flag."""
from pathlib import Path
import argparse,hashlib,json,os,subprocess
D=Path(__file__).resolve().parent
EXPECTED_PACKET_SHA='a5c2c7ffba1535cd7fafa7b730b9d34fd9f1b0376cd7c02756c55379eeeee34d'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run-reviewed-metal',action='store_true')
args=parser.parse_args()
assert args.run_reviewed_metal,'Preparation only: root must explicitly grant the reviewed quiet GPU window'
data=(D/'frozen-bake-command.json').read_bytes()
assert hashlib.sha256(data).hexdigest()==EXPECTED_PACKET_SHA,'Frozen command changed'
packet=json.loads(data)
for row in packet['filePins']:
 b=Path(row['path']).read_bytes()
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
argv=packet['argv']
assert argv[argv.index('--device')+1]=='METAL'
assert argv[argv.index('--resolution')+1]=='4096'and argv[argv.index('--samples')+1]=='256'
assert '--preserve-authored-uv1'in argv and '--materials'not in argv and '--ao-only'not in argv
out=Path(packet['out']).resolve()
assert not out.exists(),'Choose/freeze a fresh output instead of overwriting a prior attempt'
assert out.parent==D.parent and out.name=='arrivals-p5-baked-v1'
env=dict(os.environ);env['UV_CACHE_DIR']=str(D.parents[1]/'uv-cache');env['PYTHONDONTWRITEBYTECODE']='1'
command=['uv','run','--offline','--no-project','--python','3.11','--with','bpy==4.3.0','--with','numpy==1.26.4','--with','pillow==13.0.0','python']+argv
print(json.dumps({'status':'ROOT REVIEWED METAL WINDOW STARTING','packetSha256':EXPECTED_PACKET_SHA,'argv':command}),flush=True)
result=subprocess.run(command,cwd=D,env=env)
raise SystemExit(result.returncode)
