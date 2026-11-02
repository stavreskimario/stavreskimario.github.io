"""Verify the frozen arrivals lighting packet; run only with explicit review flag."""
from pathlib import Path
import os,sys,json,hashlib,subprocess,shlex
D=Path(__file__).resolve().parent
EXPECTED_PACKET_SHA='1b61345bd84aebbc174b8f1cd07304e094c1ccf72ebbb6326395da181887293d'
p=D/'frozen-bake-command.json';raw=p.read_bytes()
assert hashlib.sha256(raw).hexdigest()==EXPECTED_PACKET_SHA,'Frozen packet changed'
a=json.loads(raw)
for row in a['filePins']:
 b=Path(row['path']).read_bytes();assert len(b)==row['bytes']and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
assert not Path(a['out']).exists(),'Fresh external output directory required'
cmd=['uv','run','--offline','--no-project','--python','3.11','--with','bpy==4.3.0','--with','numpy<2','--with','pillow==13.0.0','python']+a['argv']
if sys.argv[1:]==['--show-command']:
 print(shlex.join(cmd));raise SystemExit(0)
if sys.argv[1:]!=['--run-reviewed-metal']:
 print('PASS: all frozen files verified. No bake ran. Use --show-command to inspect or --run-reviewed-metal after review.');raise SystemExit(0)
env=dict(os.environ);env['UV_CACHE_DIR']='/Users/stavreskimario/Desktop/penn-station-work/uv-cache'
raise SystemExit(subprocess.run(cmd,cwd=D,env=env,check=False).returncode)
