import assert from 'node:assert/strict';
import { findFloorJointSupport } from '../penn-station-1935/src/floor-contact.mjs';

// Actual decoded prism/opaque join from optimized concourse b17bbb24232f… .
// Two separate upward faces differ by only 77.5 nm in height; the plan gap is
// 2.2649765 micrometres. These are contact-test inputs, not replacement geometry.
const measured={x:-49.8,leftEnd:-49.80000150203705,rightStart:-49.79999923706055,leftY:7.75380401552006e-8,rightY:0};
const joint=(axis=0,gap=null,heights=[measured.leftY,measured.rightY],normalY=1)=>p=>{
  const coordinate=p[axis],centre=measured.x;
  if(coordinate<=(gap===null?measured.leftEnd:centre-gap/2))return [{height:heights[0],normalY}];
  if(coordinate>=(gap===null?measured.rightStart:centre+gap/2))return [{height:heights[1],normalY}];
  return [];
};
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS',name);};
check('Exact decoded micron joint returns an actual surface height',()=>{
  assert.equal(joint()([measured.x,0,27.149065]).length,0);
  const contact=findFloorJointSupport([measured.x,1.68,27.149065],0,joint());
  assert.equal(contact.axis,'x');assert.equal(contact.height,measured.rightY);
  assert.deepEqual(contact.samples.map(s=>s.height),[measured.leftY,measured.rightY]);
});
check('Same bounded contact works along Z',()=>{
  const c=findFloorJointSupport([0,1.68,measured.x],0,joint(2));assert.equal(c.axis,'z');assert.equal(c.height,0);
});
check('Actual negative Main world datum retains sampled heights',()=>{
  const floor=-4.2672,c=findFloorJointSupport([measured.x,floor+1.68,27.149065],floor,joint(0,null,[floor+measured.leftY,floor]));assert.equal(c.height,floor);
});
check('Probe positions are exactly 0.1mm each side on one axis',()=>{
  const calls=[];findFloorJointSupport([measured.x,1.68,2],0,p=>{calls.push(p);return joint()(p);});
  assert.deepEqual(calls,[[measured.x-.0001,0,2],[measured.x+.0001,0,2]]);
});
check('A wider real hole remains unsupported',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,.001)),null));
check('A 0.3mm hole exceeds the entire probe span',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,.0003)),null));
check('Empty space remains unsupported',()=>assert.equal(findFloorJointSupport([0,0,0],0,()=>[]),null));
check('One supported edge cannot bridge into a void',()=>assert.equal(findFloorJointSupport([0,0,0],0,p=>p[0]<0?[{height:0,normalY:1}]:[]),null));
check('Opposite unsupported edge is also rejected',()=>assert.equal(findFloorJointSupport([0,0,0],0,p=>p[0]>0?[{height:0,normalY:1}]:[]),null));
check('Vertical walls do not become floors',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,null,[0,0],0)),null));
check('Steep faces do not become joint support',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,null,[0,0],.95)),null));
check('Undersides do not become joint support',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,null,[0,0],-1)),null));
check('An actual stair-sized height difference is rejected',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,null,[0,.17152])),null));
check('Original step-up limit is retained',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,null,[.240001,.240001])),null));
check('Original step-down limit is retained',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,null,[-.350001,-.350001])),null));
check('Non-coplanar 2.1mm surfaces are rejected',()=>assert.equal(findFloorJointSupport([measured.x,0,0],0,joint(0,null,[0,.0021])),null));
check('Contact chooses a real height without averaging',()=>{
  const c=findFloorJointSupport([measured.x,0,0],.0008,joint(0,null,[0,.001]));assert.equal(c.height,.001);assert.notEqual(c.height,.0005);
});
check('Separate axes cannot combine into invented support',()=>assert.equal(findFloorJointSupport([0,0,0],0,p=>(p[0]<0||p[2]>0)?[{height:0,normalY:1}]:[]),null));
check('Invalid numeric geometry is rejected',()=>{
  assert.equal(findFloorJointSupport([0,0,0],0,()=>[{height:NaN,normalY:1}]),null);
  assert.equal(findFloorJointSupport([0,NaN,0],0,()=>[{height:0,normalY:1}]),null);
});
console.log(`PASS ${count} floor-contact controls`);
