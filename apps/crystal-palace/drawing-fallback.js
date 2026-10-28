'use strict';
/* Offline architectural elevation for Sydenham, NOT the old Hyde Park palace.
   This drawing intentionally does not pretend to be photorealistic. */
(()=>{
const canvas=document.querySelector('#palace-canvas'),stage=document.querySelector('#model-stage');
const context=canvas.getContext('2d'),status=document.querySelector('#model-status'),readout=document.querySelector('#view-readout');
let width=0,height=0,dpr=1,zoom=1,offset=0,view='isometric',mode='reconstruction',drag=null;
const layers={glass:true,roof:true,iron:true,grid:false,labels:false};
function arc(x,base,r,color){
 context.beginPath();context.arc(x,base,r,Math.PI,0);context.lineTo(x+r,base);context.closePath();context.fillStyle=color;context.fill();
 context.strokeStyle=mode==='blueprint'?'#b3e0eb':'#647978';context.lineWidth=2;context.stroke();
}
function draw(){
 if(!width||!height)return;
 context.setTransform(dpr,0,0,dpr,0,0);
 const dark=mode==='blueprint',sky=dark?'#193849':'#d7e5e8',metal=dark?'#a5d7dc':'#6d8381';
 context.fillStyle=sky;context.fillRect(0,0,width,height);
 context.save();
 const scale=Math.min(width/1350,height/570)*zoom;
 context.translate(width/2+offset,height*.55);context.scale(scale,scale);
 // Illustrated architectural elevation: central and south vault, tower, terraces.
 context.fillStyle=dark?'#234555':'#a8bd9f';context.fillRect(-980,150,1960,420);
 context.fillStyle=dark?'#355464':'#d1c7b7';
 for(const z of [200,285,360])context.fillRect(-930,z,1860,17);
 const roof=dark?'#315266':'#bad7d9',glass=dark?'#315568':'#a7c2be';
 if(layers.glass) {
  context.fillStyle=glass;context.fillRect(-720,-75,1440,220);
  context.fillStyle=dark?'#254050':'#7eaaa7';context.fillRect(-720,-35,1440,8);
 }
 if(layers.roof){
  context.fillStyle=roof;context.fillRect(-740,-95,1480,38);
  arc(0,-103,78,roof);arc(-490,-88,46,roof);
  context.fillStyle=roof;context.fillRect(-720,-115,1440,20);
 }
 if(layers.iron){
  context.strokeStyle=metal;context.lineWidth=1.25;
  for(let x=-720;x<=720;x+=12){context.beginPath();context.moveTo(x,-90);context.lineTo(x,140);context.stroke()}
  for(let y=-85;y<=140;y+=21){context.beginPath();context.moveTo(-720,y);context.lineTo(720,y);context.stroke()}
  for(const [cx,r,base] of [[0,78,-103],[-490,46,-88]]){
   for(let i=0;i<=30;i++){
    const a=Math.PI*i/30;
    context.beginPath();context.moveTo(cx,base);context.lineTo(cx-r*Math.cos(a),base-r*Math.sin(a));context.stroke();
   }
   for(const f of [.78,.92]){
    context.beginPath();context.arc(cx,base,r*f,Math.PI,0);context.stroke();
   }
  }
 }
 // Brunel tower, far left and intentionally distinct from the arched transepts.
 context.fillStyle=dark?'#759eaa':'#a7a9a0';
 context.fillRect(-880,-229,40,349);
 context.fillRect(-888,-230,56,12);context.fillRect(-882,-280,46,40);
 context.beginPath();context.moveTo(-889,-280);context.lineTo(-860,-307);context.lineTo(-831,-280);context.closePath();context.fill();
 if(layers.iron){context.strokeStyle=metal;context.lineWidth=1;for(let i=0;i<11;i++){
  context.beginPath();context.moveTo(-880,-210+i*28);context.lineTo(-840,-210+i*28);context.stroke();
 }}
 // Central garden basin and terrace balustrades.
 context.fillStyle=dark?'#436b78':'#7f9ea1';
 context.beginPath();context.ellipse(-355,337,165,45,0,0,Math.PI*2);context.fill();
 context.strokeStyle=dark?'#d0e9e7':'#e1d5c3';context.lineWidth=9;context.stroke();
 for(let i=0;i<50;i++){const x=-750+i*30;context.fillStyle=dark?'#b7dedb':'#e3ded2';context.fillRect(x,185,5,16)}
 if(layers.grid){context.strokeStyle='#6b98a3';context.globalAlpha=.25;for(let x=-1000;x<1000;x+=48){context.beginPath();context.moveTo(x,-400);context.lineTo(x,600);context.stroke()}context.globalAlpha=1;}
 if(layers.labels){context.fillStyle=dark?'#e1eeef':'#38505a';context.font='bold 20px monospace';context.fillText('SYDENHAM • AFTER 1866',-430,-360)}
 context.restore();
}
function resize(){const r=stage.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);draw()}
function preset(key){
 view=key;zoom=key==='transept'?1.25:key==='plan'?.7:1;offset=key==='transept'?80:0;
 document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===key)));
 readout.textContent=key.toUpperCase()+' · SYDENHAM ELEVATION';
 status.textContent='Sydenham '+key+' elevation view (offline fallback).';draw();
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()}));
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('change',()=>{layers[b.dataset.layer]=b.checked;draw()}));
document.querySelectorAll('[data-focus]').forEach((b,i)=>b.addEventListener('click',()=>preset(i===0?'transept':i===1?'elevation':'isometric')));
document.querySelector('#zoom-in').addEventListener('click',()=>{zoom=Math.min(zoom*1.2,3.5);draw()});
document.querySelector('#zoom-out').addEventListener('click',()=>{zoom=Math.max(zoom/1.2,.4);draw()});
document.querySelector('#reset-view').addEventListener('click',()=>preset('isometric'));
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,base:offset,id:e.pointerId};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){offset=drag.base+e.clientX-drag.x;draw()}});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.4,Math.min(3.5,zoom*Math.exp(-e.deltaY*.001)));draw()},{passive:false});
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','+','=','-','_','0'].includes(e.key))return;e.preventDefault();if(e.key==='0')preset('isometric');else if(e.key.startsWith('Arrow'))offset+=e.key==='ArrowLeft'?-30:30;else zoom*=e.key==='+'||e.key==='='?1.15:.85;draw()});
document.querySelector('#export-view').addEventListener('click',()=>{draw();const a=document.createElement('a');a.download='crystal-palace-sydenham-elevation.png';a.href=canvas.toDataURL('image/png');a.click();status.textContent='Sydenham elevation saved.'});
if(window.ResizeObserver)new ResizeObserver(resize).observe(stage);else window.addEventListener('resize',resize);
resize();preset('isometric');
})();