import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadWorld,sha} from '/Users/stavreskimario/Desktop/penn-station-work/phase7-arrivals/arrivals-runtime-queries.mjs';
const options={};for(let i=2;i<process.argv.length;i+=2)options[process.argv[i].slice(2)]=process.argv[i+1];
assert(options.concourse&&options.out);assert(!fs.existsSync(options.out),'Immutable receipt');
const root='/Users/stavreskimario/Desktop/penn-station-reconstruction',inputs=options.module?[options.concourse,options.module]:options.concourse;
const report={scope:'Actual P1/P2/P5 departure flights,3body lanes,both directions,full/low retained environments. Actual rear guard stops a Main-floor approach before the real stair void. No artificial support/disabledwalls/browser claim.',sourceSha256:sha(fs.readFileSync(options.concourse)),...options.module?{moduleSha256:sha(fs.readFileSync(options.module))}:{},body:{radius:.32,height:1.85,leadingFoot:.25,maximumUp:.24,maximumDown:.35},variants:[]};
for(const low of[false,true]){
 const world=loadWorld(root,low,{assetOverrides:{concourse:inputs,'concourse-low':options['module-low']?[options.concourse,options['module-low']]:options['concourse-low']||inputs,...options.platform?{platform:low?(options['platform-low']||options.platform):options.platform}: {}},manifestFile:options.manifest}),v={variant:low?'low retained zones':'full retained zones',files:world.files,routes:[],rearGuards:[]};
 for(const stair of world.manifest.accessStairs.filter(s=>[1,2,5].includes(s.workingPlatform))){
  for(const dz of[-.55,0,.55])for(const reverse of[false,true]){
   const a=reverse?-29.5:-48.2,b=reverse?-48.2:-29.5,n=Math.ceil(Math.abs(b-a)/.04),direction=Math.sign(b-a),r={workingPlatform:stair.workingPlatform,dz,direction:reverse?'up':'down',samples:n+1,failures:[],minimumOpaqueHeadroom:null};let feet=reverse?world.manifest.levels.platformWorld-world.manifest.levels.mainWorld:0;
   for(let i=0;i<=n;i++){
    const x=a+(b-a)*i/n,z=stair.centerZ+dz,f=world.floor(x,z,feet);let failure;
    if(!f)failure={reason:'no actual floor',x,z,feet};else if(f.point[1]>feet+.24||f.point[1]<feet-.35)failure={reason:'original step bound',x,z,feet,actual:f.point[1]};
    else{const actual=f.point[1],body=world.body(x,z,actual,.32,1.85,{physical:true}),ahead=world.floor(x+direction*.25,z,actual);if(body)failure={reason:'actual body collision',x,z,floor:actual,body};else if(!ahead||Math.abs(ahead.point[1]-actual)>.35)failure={reason:'unsupported leading foot',x,z,floor:actual,ahead};if(!failure){feet=actual;for(const dx of[-.25,0,.25]){const h=world.hits([x+dx,feet+.35,z],[0,1,0],8,{opaque:true})[0];if(h&&(!r.minimumOpaqueHeadroom||h.point[1]-feet<r.minimumOpaqueHeadroom.clearance))r.minimumOpaqueHeadroom={clearance:h.point[1]-feet,x:x+dx,z,floor:feet,hit:h};}}}
    if(failure&&r.failures.length<3)r.failures.push(failure);
   }
   r.pass=!r.failures.length;v.routes.push(r);
  }
  const guard=world.hits([-44,1.0,stair.centerZ],[1,0,0],1.25,{navigation:true})[0]||null,rearFloor=world.floor(-43.1,stair.centerZ,0),blocked=rearFloor&&world.body(-43.1,stair.centerZ,rearFloor.point[1],.32,1.85);
  v.rearGuards.push({workingPlatform:stair.workingPlatform,actualGuardHit:guard,rearMainFloor:rearFloor,bodyStoppedBeforeVoid:blocked,pass:!!guard&&!!rearFloor&&!!blocked&&/Guard/.test(blocked.material)});
 }
 v.pass=v.routes.every(r=>r.pass)&&v.rearGuards.every(r=>r.pass);report.variants.push(v);fs.writeFileSync(options.out,JSON.stringify(report,null,2)+'\n');console.log(v.variant,'routes',v.routes.filter(r=>r.pass).length,'/',v.routes.length,'guards',v.rearGuards.filter(r=>r.pass).length,'/',v.rearGuards.length);world.dispose();
}
report.pass=report.variants.every(v=>v.pass);report.actualRouteSamples=report.variants.reduce((n,v)=>n+v.routes.reduce((n,r)=>n+r.samples,0),0);fs.writeFileSync(options.out,JSON.stringify(report,null,2)+'\n');console.log('ALL DEPARTURES',report.pass,report.actualRouteSamples);
