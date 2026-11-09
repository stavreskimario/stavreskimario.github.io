'use strict';
/* Keyless electorate atlas: zero external map services, self-hosted Vicmap polygons. */
(() => {
 const SVG='http://www.w3.org/2000/svg';
 const make=(tag,attrs={})=>{
  const element=document.createElementNS(SVG,tag);
  for(const [name,value] of Object.entries(attrs))element.setAttribute(name,String(value));
  return element;
 };
 const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const point=(lon,lat)=>[(lon-140)*80,(-lat-33.4)*100];
 const empty=()=>({x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity});
 const extend=(box,x,y)=>{
  box.x0=Math.min(box.x0,x);box.y0=Math.min(box.y0,y);
  box.x1=Math.max(box.x1,x);box.y1=Math.max(box.y1,y);
 };
 const colours={Labor:'#ac5548',Liberal:'#426b88',Nationals:'#8b7044',Greens:'#5b7d5e','One Nation':'#c28b3e',Independent:'#82719a',Tied:'#9e988c',Unknown:'#d1c9bc'};
 const landmarks=[
  ['MELBOURNE',144.9631,-37.8136],['GEELONG',144.36,-38.15],
  ['BALLARAT',143.8503,-37.5622],['BENDIGO',144.2794,-36.7596],
  ['MILDURA',142.16,-34.1855],['SHEPPARTON',145.4,-36.38],
  ['WARRNAMBOOL',142.48,-38.381],['TRARALGON',146.534,-38.196],
  ['WODONGA',146.888,-36.121]
 ];
 function geometryPath(geometry,bounds){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const lines=[];
  for(const polygon of polygons)for(const ring of polygon){
   const vertices=[];
   for(const coord of ring){
    const xy=point(coord[0],coord[1]);
    if(!Number.isFinite(xy[0])||!Number.isFinite(xy[1]))throw Error('Invalid map coordinate');
    extend(bounds,xy[0],xy[1]);
    vertices.push(xy[0].toFixed(3)+' '+xy[1].toFixed(3));
   }
   if(vertices.length>=4)lines.push('M'+vertices.join('L')+'Z');
  }
  return lines.join('');
 }
 function mount({container,features,onSelect,getLeader,getLabel}){
  if(!container||!Array.isArray(features)||features.length!==88)throw Error('Expected 88 electorates');
  container.replaceChildren();
  const svg=make('svg',{class:'atlas-svg',role:'img','aria-label':'Victorian state election districts. Click or tap to select. The list below is also keyboard accessible.'});
  const paths=make('g',{class:'atlas-districts'}),cities=make('g',{class:'atlas-cities','aria-hidden':'true'});
  svg.append(paths,cities);container.append(svg);
  const bounds=empty(),seats=new Map(),cityNodes=[];
  let camera=null,home=null,selected='',filter='All',hovered='',gesture=null,pinch=null;
  const touches=new Map();
  const hoverCard=document.getElementById('map-hover');
  for(const feature of features){
   const name=feature.properties?.name||'',key=norm(name),seatBox=empty();
   if(!name||seats.has(key))throw Error('Duplicate or missing electorate: '+name);
   const d=geometryPath(feature.geometry,seatBox);
   if(!d)throw Error('Empty electorate shape: '+name);
   extend(bounds,seatBox.x0,seatBox.y0);extend(bounds,seatBox.x1,seatBox.y1);
   const path=make('path',{d,fill:'none','fill-rule':'evenodd','data-seat':name,class:'atlas-shape'});
   const title=make('title');title.textContent=getLabel(name);path.append(title);
   paths.append(path);seats.set(key,{name,path,bounds:seatBox});
  }
  if(seats.size!==88)throw Error('Incomplete map coverage');
  for(const [name,lon,lat] of landmarks){
   const [x,y]=point(lon,lat),group=make('g',{class:'atlas-city'});
   const circle=make('circle',{cx:x,cy:y,r:2});
   const label=make('text',{x,y,'dominant-baseline':'middle'});label.textContent=name;
   group.append(circle,label);cities.append(group);cityNodes.push({circle,label});
  }
  const ratio=()=>Math.max(.5,container.clientWidth/Math.max(container.clientHeight,1));
  const fit=(box,pad=0)=>{
   let w=Math.max(12,box.x1-box.x0+2*pad),h=Math.max(12,box.y1-box.y0+2*pad);
   const aspect=ratio();
   if(w/h<aspect)w=h*aspect;else h=w/aspect;
   return {x:(box.x0+box.x1-w)/2,y:(box.y0+box.y1-h)/2,w,h};
  };
  function draw(){
   if(!camera)return;
   svg.setAttribute('viewBox',[camera.x,camera.y,camera.w,camera.h].join(' '));
   const unit=camera.w/Math.max(container.clientWidth,1);
   for(const {circle,label} of cityNodes){
    circle.setAttribute('r',(2.1*unit).toFixed(3));
    label.setAttribute('dx',(6*unit).toFixed(3));
    label.setAttribute('font-size',(10*unit).toFixed(3));
    label.setAttribute('stroke-width',(2*unit).toFixed(3));
   }
   const line=unit;
   for(const [key,seat] of seats){
    const favourite=getLeader(seat.name),active=norm(selected)===key,over=hovered===key;
    const matched=filter==='All'||favourite===filter;
    seat.path.setAttribute('fill',colours[favourite]||colours.Unknown);
    seat.path.setAttribute('fill-opacity',active?'.98':matched?'.84':'.15');
    seat.path.setAttribute('stroke',active?'#292522':over?'#292522':'#f9f7ef');
    seat.path.setAttribute('stroke-width',((active?2.6:over?2.0:1.1)*line).toFixed(3));
    seat.path.setAttribute('stroke-dasharray',favourite==='Tied'?(4*line).toFixed(3)+' '+(2*line).toFixed(3):'none');
   }
  }
  function setCamera(next){
   if(!home)return;
   const a=ratio(),w=Math.max(12,Math.min(home.w*2.2,next.w)),h=w/a;
   const pad=w*.4;
   camera={
    x:Math.max(bounds.x0-pad-w,Math.min(bounds.x1+pad,next.x)),
    y:Math.max(bounds.y0-pad-h,Math.min(bounds.y1+pad,next.y)),
    w,h
   };
   draw();
  }
  function focus(box,pad=15){setCamera(fit(box,pad));}
  function zoom(factor,rx=.5,ry=.5){
   if(!camera)return;
   const w=camera.w/factor,h=camera.h/factor;
   setCamera({x:camera.x+(camera.w-w)*rx,y:camera.y+(camera.h-h)*ry,w,h});
  }
  function relative(e){
   const rect=container.getBoundingClientRect();
   return {x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),
    y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};
  }
  function showHover(seat,e){
   hovered=norm(seat);
   hoverCard.textContent=getLabel(seat);
   hoverCard.hidden=false;
   const box=container.getBoundingClientRect();
   hoverCard.style.left=Math.max(8,Math.min(e.clientX-box.left+14,box.width-hoverCard.offsetWidth-8))+'px';
   hoverCard.style.top=Math.max(8,Math.min(e.clientY-box.top-38,box.height-hoverCard.offsetHeight-8))+'px';
   draw();
  }
  function hideHover(){hovered='';hoverCard.hidden=true;draw();}
  svg.addEventListener('pointerover',e=>{
   const path=e.target.closest('path.atlas-shape');
   if(path&&!gesture?.moved&&!pinch)showHover(path.dataset.seat,e);
  });
  svg.addEventListener('pointermove',e=>{
   if(!touches.has(e.pointerId)){
    const path=e.target.closest('path.atlas-shape');
    if(path&&!hoverCard.hidden)showHover(path.dataset.seat,e);
    return;
   }
   touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(touches.size>=2){
    const values=[...touches.values()],distance=Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);
    if(!pinch){pinch={distance,camera:{...camera}};gesture=null;}
    if(pinch.distance>0){
     const r=relative({clientX:(values[0].x+values[1].x)/2,clientY:(values[0].y+values[1].y)/2});
     const factor=distance/pinch.distance,w=pinch.camera.w/factor,h=pinch.camera.h/factor;
     setCamera({x:pinch.camera.x+(pinch.camera.w-w)*r.x,y:pinch.camera.y+(pinch.camera.h-h)*r.y,w,h});
    }
    hideHover();return;
   }
   if(!gesture||gesture.id!==e.pointerId)return;
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(Math.hypot(dx,dy)>6)gesture.moved=true;
   if(gesture.moved){
    const units=gesture.camera.w/Math.max(container.clientWidth,1);
    container.classList.add('dragging');
    setCamera({x:gesture.camera.x-dx*units,y:gesture.camera.y-dy*units,w:gesture.camera.w,h:gesture.camera.h});
    hideHover();
   }
  });
  svg.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
   svg.setPointerCapture(e.pointerId);
   gesture={id:e.pointerId,x:e.clientX,y:e.clientY,camera:{...camera},moved:false,seat:e.target.closest('path.atlas-shape')?.dataset.seat||''};
  });
  function release(e){
   if(!touches.has(e.pointerId))return;
   touches.delete(e.pointerId);
   if(pinch){if(touches.size<2){pinch=null;gesture=null;}container.classList.remove('dragging');return;}
   if(gesture?.id===e.pointerId){
    const {moved,seat}=gesture;gesture=null;container.classList.remove('dragging');
    if(!moved&&seat&&e.type==='pointerup')onSelect(seat);
   }
  }
  svg.addEventListener('pointerup',release);
  svg.addEventListener('pointercancel',release);
  svg.addEventListener('lostpointercapture',release);
  svg.addEventListener('pointerout',e=>{if(!e.relatedTarget||!svg.contains(e.relatedTarget))hideHover();});
  svg.addEventListener('wheel',e=>{
   if(!e.ctrlKey&&!e.metaKey)return;
   e.preventDefault();
   const r=relative(e);zoom(e.deltaY<0?1.2:1/1.2,r.x,r.y);
  },{passive:false});
  svg.addEventListener('dblclick',e=>{e.preventDefault();const r=relative(e);zoom(1.5,r.x,r.y);});
  const plus=document.getElementById('zoom-in'),minus=document.getElementById('zoom-out');
  plus?.addEventListener('click',()=>zoom(1.3));
  minus?.addEventListener('click',()=>zoom(1/1.3));
  home=fit(bounds,26);camera=home;draw();
  if(window.ResizeObserver)new ResizeObserver(()=>{
   if(!camera||!container.clientWidth)return;
   const centerX=camera.x+camera.w/2,centerY=camera.y+camera.h/2;
   home=fit(bounds,26);
   setCamera({x:centerX-camera.w/2,y:centerY-camera.w/ratio()/2,w:camera.w,h:camera.w/ratio()});
  }).observe(container);
  return {
   select(name,shouldZoom){
    const seat=seats.get(norm(name));if(!seat)return;
    selected=seat.name;paths.append(seat.path);draw();
    if(shouldZoom)focus(seat.bounds,4);
   },
   updateFilter(value){filter=value;draw();},
   frame(mode){
    if(mode==='metro'){
     const p0=point(143.98,-37.15),p1=point(145.9,-38.5);
     focus({x0:p0[0],x1:p1[0],y0:p0[1],y1:p1[1]},6);
    }else focus(bounds,26);
   },
   zoom
  };
 }
 window.ElectorateAtlas={mount};
})();