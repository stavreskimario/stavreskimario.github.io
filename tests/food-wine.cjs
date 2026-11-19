'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {questions,wines,recommend,explain}=require('../food-wine/pairings.js');

test('every input combination yields eight unique styles with both sort contracts',()=>{
 let checked=0;
 for(const [food] of questions[0].options)for(const [flavour] of questions[1].options)for(const [weight] of questions[2].options)for(const [style] of questions[3].options){
  const answers=[food,flavour,weight,style];
  const price=recommend(answers),fit=recommend(answers,'match');
  assert.equal(price.length,8);assert.equal(new Set(price.map(r=>r.wine.id)).size,8);
  assert.deepEqual(price.map(r=>r.wine.id).sort(),fit.map(r=>r.wine.id).sort());
  assert(price.every((r,i)=>i===0||r.wine.low>=price[i-1].wine.low));
  assert(fit.every((r,i)=>i===0||r.score<=fit[i-1].score));
  assert.equal(fit[0].rank,1);
  for(const {wine} of price){
   if(food==='dessert')assert.equal(wine.kind,'sweet');
   else if(style!=='any')assert.equal(wine.kind,style);
   assert(wine.low>0&&wine.high>=wine.low);
   const explanation=explain(wine,answers).reason;
   assert(explanation.length>35);assert(!explanation.includes('undefined'));assert(!explanation.includes(',light,medium,full'));
  }
  checked++;
 }
 assert.equal(checked,648);
});
test('tomato and mushroom sauces produce different leading red matches',()=>{
 const tomato=recommend(['meat','tomato','medium','red'],'match');
 const mushroom=recommend(['meat','earthy','medium','red'],'match');
 assert.notEqual(tomato[0].wine.id,mushroom[0].wine.id);
 assert.equal(tomato[0].wine.acid,3);
 assert.equal(tomato[0].wine.name,'Sangiovese');
 assert.match(explain(tomato[0].wine,['meat','tomato','medium','red']).reason,/tomato/);
 assert.match(explain(mushroom[0].wine,['meat','earthy','medium','red']).reason,/mushrooms/);
});
test('weight and chilli materially change ranking',()=>{
 const light=recommend(['meat','smoky','light','red'],'match')[0].wine;
 const rich=recommend(['meat','smoky','rich','red'],'match')[0].wine;
 assert(light.body<rich.body);
 const spicy=recommend(['spicy','fresh','light','any'],'match')[0].wine;
 assert.equal(spicy.alcohol,1);assert.equal(spicy.tannin,0);assert(spicy.sweetness>0);
});
test('catalogue has unique records and enough choices within each style',()=>{
 assert.equal(wines.length,64);assert.equal(new Set(wines.map(w=>w.id)).size,wines.length);
 for(const kind of ['sparkling','white','rose','red','sweet'])assert(wines.filter(w=>w.kind===kind).length>8);
 assert.throws(()=>recommend(['meat','tomato','medium','invalid']),TypeError);
 assert.throws(()=>recommend([]),TypeError);
});
