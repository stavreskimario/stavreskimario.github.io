'use strict';
(() => {
 const canvas=document.getElementById('palace-canvas'),stage=document.getElementById('model-stage'),ctx=canvas.getContext('2d',{alpha:false});
 const status=document.getElementById('model-status'),readout=document.getElementById('view-readout');
 const layers={glass:true,roof:true,iron:true,grid:false,labels:true};
 const W=1848,D=408,half=W/2;
 const state={yaw:-.58,pitch:.38,zoom:1.02,panX:0,panY:0,mode:'reconstruction',preset:'isometric'};
 let dpr=1,cw=0,ch=0,drag=null,dirty=true,frame=0,lastTouchDistance=0,panOrigin=null;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const data=[
  {id:'transept',title:'The great transept',description:'A spectacular barrel-vaulted crossing rose to approximately 108 feet, designed to preserve mature elm trees on the Hyde Park site.',index:'01 / 04',yaw:-.16,pitch:.34,zoom:1.18},
  {id:'avenue',title:'The grand avenue',description:'The extraordinary 1,848-foot east–west length turned prefabricated parts into an immense, uninterrupted exhibition hall.',index:'02 / 04',yaw:-.9,pitch:.30,zoom:.98},
  {id:'module',title:'Modular ironwork',description:'Repeatable iron columns and glazing formed a system based on 24-foot bays. The model shows a simplified structural rhythm, not individual fabrication details.',index:'03 / 04',yaw:-.53,pitch:.24,zoom:1.43},
  {id:'projection',title:'The north projection',description:'The original floor plan included a long north-side projection. Its footprint is represented schematically here, with its façade and roof simplified.',index:'04 / 04',yaw:.32,pitch:.48,zoom:1.14}
 ];
 const palettes={
  reconstruction:{sky:'#eaebe5',far:'#f5f2e9',ground:'#e7e7df',grid:'#c6d1cc',metal:'#506972',metalLite:'#7e999d',glass:'rgba(162,202,207,.34)',roof:'rgba(211,231,225,.71)',roofAlternate:'rgba(185,218,218,.55)',edge:'#68878e',highlight:'#effaf3',ink:'#375661',annotation:'#b76a4b'},
  blueprint:{sky:'#15303f',far:'#173746',ground:'#193d4c',grid:'#3e6370',metal:'#9cd4d7',metalLite:'#6fabb2',glass:'rgba(29,90,111,.28)',roof:'rgba(39,91,109,.45)',roofAlternate:'rgba(27,80,103,.45)',edge:'#8bced8',highlight:'#d1f7ed',ink:'#d4e8e4',annotation:'#f3d1a5'}
 };
 const p=()=>palettes[state.mode];
 const clamp=(a,l,h)=>Math.max(l,Math.min(h,a));
 function project([x,y,z]) {
  const a=state.yaw,b=state.pitch;
  const xx=x*Math.cos(a)-z*Math.sin(a),zz=x*Math.sin(a)+z*Math.cos(a);
  const yy=y*Math.cos(b)+zz*Math.sin(b),depth=zz*Math.cos(b)-y*Math.sin(b);
  const unit=Math.min(cw/2150,ch/650)*state.zoom;
  return {x:cw/2+xx*unit+state.panX,y:ch*.56-yy*unit+state.panY,depth,unit};
 }
 function line(a,b,col,width=1,alpha=1) {
  const A=project(a),B=project(b);
  ctx.strokeStyle=col;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();ctx.globalAlpha=1;
 }
 function quad(points,fill,stroke=null,width=.7) {
  ctx.beginPath();
  points.forEach((v,i)=>{const P=project(v);i?ctx.lineTo(P.x,P.y):ctx.moveTo(P.x,P.y)});
  ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
 }
 // The original structure had three stepped levels of ridge-and-furrow glazing.
 function roofProfile(z){
  const a=Math.abs(z);
  if(a<=72)return 69;
  if(a<=144)return 46;
  return 23;
 }
 function arch(z){const r=204;return 71+37*Math.sqrt(Math.max(0,1-(z/r)**2));}
 const solids=[];
 function build(){
  solids.length=0;
  // Each roof platform is a 24ft-wide rhythm of glass planes.
  for(const [lo,hi,height] of [[-204,-144,23],[-144,-72,46],[-72,72,69],[72,144,46],[144,204,23]]){
   for(let x=-924;x<924;x+=24){
    const x2=Math.min(924,x+24),mid=(lo+hi)/2;
    solids.push({kind:'roof',points:[[x,height,lo],[x2,height,lo],[x2,height+3,mid],[x,height+3,mid]],shade:0});
    solids.push({kind:'roof',points:[[x,height+3,mid],[x2,height+3,mid],[x2,height,hi],[x,height,hi]],shade:1});
   }
  }
  for(const x of [-924,924])for(let z=-204;z<204;z+=24)
   solids.push({kind:'glass',points:[[x,0,z],[x,roofProfile(z+12),z],[x,roofProfile(z+12),z+24],[x,0,z+24]]});
  for(const z of [-204,204])for(let x=-924;x<924;x+=24)
   solids.push({kind:'glass',points:[[x,0,z],[x+24,0,z],[x+24,23,z],[x,23,z]]});
  // Great vaulted transept crossing the nave, running north–south.
  const x0=-36,x1=36;
  for(let z=-204;z<204;z+=12){
   solids.push({kind:'vault',points:[[x0,arch(z),z],[x1,arch(z),z],[x1,arch(z+12),z+12],[x0,arch(z+12),z+12]],shade:Math.floor((z+204)/12)%2});
  }
  // Single north-side extension represented in a subdued schematic footprint.
  for(let x=-468;x<468;x+=24)
   solids.push({kind:'projection',points:[[x,0,204],[x+24,0,204],[x+24,23,204],[x,23,204]]});
 }
 build();
 function paintBackground(){
  const C=p(),g=ctx.createLinearGradient(0,0,0,ch);g.addColorStop(0,C.sky);g.addColorStop(1,C.far);ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
  quad([[-1320,-2,-580],[1320,-2,-580],[1320,-2,580],[-1320,-2,580]],C.ground);
  const horizon=project([0,0,0]).y;
  if(layers.grid){
   for(let x=-1200;x<=1200;x+=72)line([x,0,-450],[x,0,450],C.grid,.55,.75);
   for(let z=-450;z<=450;z+=72)line([-1200,0,z],[1200,0,z],C.grid,.55,.75);
  }
 }
 function drawSolids(){
  const C=p(),array=solids.filter(s=>((s.kind==='roof'||s.kind==='vault')?layers.roof:layers.glass));
  array.sort((a,b)=>{
   const depth=s=>s.points.reduce((sum,point)=>sum+project(point).depth,0)/s.points.length;
   return depth(b)-depth(a);
  });
  for(const s of array){
   const fill=s.kind==='roof'||s.kind==='vault'?(s.shade?C.roofAlternate:C.roof):C.glass;
   quad(s.points,fill,C.edge,.23);
  }
 }
 function drawStructure(){
  if(!layers.iron)return;
  const C=p(),metal=C.metal,lite=C.metalLite,th=state.zoom>1.3?1.05:.76;
  // longitudinal eaves/ridge lines of the stepped roof sections
  for(const z of [-204,-144,-72,72,144,204]){
   const ht=roofProfile(z+(z<0?2:-2));
   line([-924,ht,z],[924,ht,z],metal,1.3);
   line([-924,0,z],[924,0,z],lite,.6,.48);
  }
  // structural columns and their upper beams
  for(let x=-924;x<=924;x+=24){
   const major=Math.round((x+924)/24)%4===0;
   for(const z of [-204,-144,-72,72,144,204]){
    const ht=roofProfile(z+(z<0?2:-2));
    line([x,0,z],[x,ht,z],metal,major?1.05:.55,major?1:.72);
   }
   for(const [z0,z1,ht] of [[-204,-144,23],[-144,-72,46],[-72,72,69],[72,144,46],[144,204,23]]){
    if(major||x===-924||x===924){
     line([x,ht,z0],[x,ht+3,(z0+z1)/2],lite,.65);
     line([x,ht+3,(z0+z1)/2],[x,ht,z1],lite,.65);
    }
   }
  }
  // Glazing rhythm across the long facades.
  for(let x=-924;x<=924;x+=24){
   line([x,0,-204],[x,23,-204],metal,th);
   line([x,0,204],[x,23,204],metal,th);
   line([x,12,-204],[x+Math.min(24,924-x),12,-204],lite,.5,.8);
   line([x,12,204],[x+Math.min(24,924-x),12,204],lite,.5,.8);
  }
  for(let z=-204;z<=204;z+=24){for(const x of [-924,924]){line([x,0,z],[x,roofProfile(z+(z<0?1:-1)),z],metal,.8);}}
  // The semicircular/elliptical vault, its ribs and glazing bars.
  for(let z=-204;z<=204;z+=12){line([-36,arch(z),z],[36,arch(z),z],lite,.5,.84)}
  for(let z=-204;z<204;z+=3){
   if(z%12!==0)continue;
   for(const x of [-36,36])line([x,arch(z),z],[x,arch(z+12),z+12],metal,1.15);
  }
  for(let x=-36;x<=36;x+=12)for(let z=-204;z<204;z+=12)line([x,arch(z),z],[x,arch(z+12),z+12],lite,.55);
  for(const x of [-36,36]){line([x,0,-204],[x,71,-204],metal,1.4);line([x,0,204],[x,71,204],metal,1.4)}
  // north-side projection: a schematic projection from the primary envelope
  for(const x of [-468,468])for(const z of [204,252])line([x,0,z],[x,23,z],metal,.8);
  for(const z of [204,252])line([-468,23,z],[468,23,z],metal,1);
  for(const x of [-468,468])line([x,23,204],[x,23,252],metal,.8);
  for(let x=-468;x<=468;x+=24)line([x,0,252],[x,23,252],lite,.65);
  // geometric foundation border
  for(const a of [[[-924,0,-204],[924,0,-204]],[[924,0,-204],[924,0,204]],[[924,0,204],[-924,0,204]],[[-924,0,204],[-924,0,-204]]])line(a[0],a[1],metal,.9);
 }
 function annotate(label,point,dx,dy){
  const C=p(),P=project(point),tx=P.x+dx,ty=P.y+dy;
  if(tx<15||tx>cw-130||ty<25||ty>ch-25)return;
  ctx.strokeStyle=C.annotation;ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(P.x,P.y);ctx.lineTo(tx,ty);ctx.lineTo(tx+65,ty);ctx.stroke();
  ctx.fillStyle=C.annotation;ctx.beginPath();ctx.arc(P.x,P.y,2.4,0,Math.PI*2);ctx.fill();
  ctx.font='600 10px "DM Sans",sans-serif';ctx.fillText(label.toUpperCase(),tx+4,ty-7);
 }
 function drawAnnotations(){
  if(!layers.labels)return;
  annotate('108 FT TRANSEPT',[0,108,0],65,-68);
  annotate('REPETITIVE IRON BAYS',[650,23,-204],-160,-75);
  annotate('NORTH PROJECTION',[250,23,252],68,55);
 }
 function render(){
  frame=0;if(!dirty)return;dirty=false;
  if(!cw||!ch)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
  paintBackground();drawSolids();drawStructure();drawAnnotations();
  if(state.mode==='blueprint'){ctx.fillStyle='rgba(219,244,242,.72)';ctx.font='10px monospace';ctx.fillText('PAXTON · 1851 / ORTHOGRAPHIC STUDY',21,ch-51)}
 }
 function invalidate(){dirty=true;if(!frame)frame=requestAnimationFrame(render)}
 function resize(){
  const r=stage.getBoundingClientRect();cw=r.width;ch=r.height;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);invalidate();
 }
 function setPreset(name){
  const presets={isometric:{yaw:-.58,pitch:.38,zoom:1.02},elevation:{yaw:0,pitch:.05,zoom:.98},plan:{yaw:-.02,pitch:1.55,zoom:1},transept:{yaw:-1.48,pitch:.18,zoom:1.13}};
  const v=presets[name];if(!v)return;Object.assign(state,v,{panX:0,panY:0,preset:name});
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===name)));
  readout.textContent=name.toUpperCase()+' · '+state.mode.toUpperCase();
  invalidate();announce(name+' view.');
 }
 function announce(message){status.textContent=message}
 function setZoom(factor){state.zoom=clamp(state.zoom*factor,.45,4);invalidate();announce('Zoom '+Math.round(state.zoom*100)+' percent.')}
 function focusFeature(id){
  const f=data.find(x=>x.id===id);if(!f)return;
  const title=document.getElementById('feature-title');title.textContent=f.title;
  document.getElementById('feature-index').textContent=f.index;
  document.getElementById('feature-description').textContent=f.description;
  Object.assign(state,{yaw:f.yaw,pitch:f.pitch,zoom:f.zoom,panX:0,panY:0,preset:null});
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));
  readout.textContent=f.title.toUpperCase()+' · DETAIL';
  invalidate();announce('Showing '+f.title+'.');
 }
 document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>setPreset(b.dataset.preset)));
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  state.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  readout.textContent=(state.preset||'CUSTOM').toUpperCase()+' · '+state.mode.toUpperCase();
  invalidate();announce(state.mode+' drawing style.');
 }));
 document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('change',()=>{layers[b.dataset.layer]=b.checked;invalidate();announce(b.dataset.layer+' '+(b.checked?'shown.':'hidden.'))}));
 document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>focusFeature(b.dataset.focus)));
 document.getElementById('zoom-in').addEventListener('click',()=>setZoom(1.25));
 document.getElementById('zoom-out').addEventListener('click',()=>setZoom(.8));
 document.getElementById('reset-view').addEventListener('click',()=>setPreset('isometric'));
 const pointers=new Map();
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0&&e.button!==1)return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1)drag={x:e.clientX,y:e.clientY,mode:e.shiftKey||e.button===1?'pan':'orbit',id:e.pointerId};
  if(pointers.size===2){
   drag=null;
   const [a,b]=[...pointers.values()];
   lastTouchDistance=Math.hypot(a.x-b.x,a.y-b.y);
   panOrigin={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  }
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){
   const [a,b]=[...pointers.values()];
   const distance=Math.hypot(a.x-b.x,a.y-b.y);
   const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   if(lastTouchDistance>0)state.zoom=clamp(state.zoom*distance/lastTouchDistance,.45,4);
   if(panOrigin){state.panX+=midpoint.x-panOrigin.x;state.panY+=midpoint.y-panOrigin.y}
   lastTouchDistance=distance;panOrigin=midpoint;state.preset=null;invalidate();return;
  }
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(drag.mode==='pan'){state.panX+=dx;state.panY+=dy}else{state.yaw+=dx*.0075;state.pitch=clamp(state.pitch-dy*.006,-1.48,1.56)}
  drag.x=e.clientX;drag.y=e.clientY;state.preset=null;invalidate();
 });
 function end(e){
  pointers.delete(e.pointerId);
  if(drag?.id===e.pointerId)drag=null;
  if(pointers.size===1){const [id,v]=[...pointers.entries()][0];drag={id,x:v.x,y:v.y,mode:'orbit'}}
  if(pointers.size<2){lastTouchDistance=0;panOrigin=null}
 }
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(Math.exp(-e.deltaY*.001))},{passive:false});
 canvas.addEventListener('keydown',e=>{
  const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_','0'];
  if(!keys.includes(e.key))return;e.preventDefault();
  if(e.key==='0'){setPreset('isometric');return}
  if(e.key==='+'||e.key==='=')setZoom(1.15);
  else if(e.key==='-'||e.key==='_')setZoom(.87);
  else if(e.key==='ArrowLeft')state.yaw-=.12;
  else if(e.key==='ArrowRight')state.yaw+=.12;
  else if(e.key==='ArrowUp')state.pitch=clamp(state.pitch+.1,-1.48,1.56);
  else state.pitch=clamp(state.pitch-.1,-1.48,1.56);
  invalidate();
 });
 document.getElementById('export-view').addEventListener('click',()=>{
  render();
  const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='crystal-palace-1851-'+state.mode+'.png';link.click();announce('Image saved as PNG.');
 });
 if(window.ResizeObserver)new ResizeObserver(resize).observe(stage);else window.addEventListener('resize',resize);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate()});
 resize();setPreset('isometric');
})();