'use strict';

// An original editorial catalogue of wine STYLES, not stock, bottle reviews or live prices.
// Trait scales are deliberately broad (1–3). See README for rules and sources.
(() => {
 const questions = [
  {id:'food', label:'Food', title:'What’s on the table?', hint:'Start with the main ingredient or the kind of meal.', options:[
   ['seafood','Fish & seafood','Shellfish, white fish, salmon or prawns','fish'],
   ['poultry','Chicken & lighter meats','Roast chicken, pork or creamy pasta','bird'],
   ['vegetable','Vegetables & soft cheese','Salads, grains, risotto or a cheese tart','leaf'],
   ['meat','Red meat & hearty dishes','Steak, lamb, meatballs or slow-cooked beef','steak'],
   ['spicy','Spice & aromatics','Chilli, curry, ginger or fragrant dishes','chilli'],
   ['dessert','Dessert & blue cheese','Something sweet, or a salty blue cheese','cake']
  ]},
  {id:'flavour', label:'Flavour', title:'What’s the leading flavour?', hint:'Think sauce, seasoning or dressing. It often makes the difference.', options:[
   ['fresh','Fresh & citrusy','Lemon, herbs, salty or zesty flavours','citrus'],
   ['creamy','Creamy & buttery','Cream sauces, butter or rich cheese','cream'],
   ['earthy','Earthy & savoury','Mushrooms, truffle or roasted vegetables','mushroom'],
   ['smoky','Smoky & chargrilled','Barbecue, black pepper or a little char','flame'],
   ['tomato','Tomato & tangy','Tomato sauces, tangy dressings or tartness','tomato'],
   ['sweet','Sweet & honeyed','Fruit, caramel, honey or sweet glazes','honey']
  ]},
  {id:'weight', label:'Weight', title:'How hearty is the dish?', hint:'Match the feel of the wine to the weight of the food.', options:[
   ['light','Light & delicate','A fresh salad, simple fish or a small plate','light'],
   ['medium','Somewhere in the middle','Pasta, roast chicken or a generous risotto','medium'],
   ['rich','Rich & full-flavoured','Slow-cooked meat, a big steak or a rich sauce','rich']
  ]},
  {id:'style', label:'Wine', title:'What would you like to pour?', hint:'Choose a favourite, or let the food lead.', options:[
   ['any','Find the best match','I’m happy to explore','glass'],
   ['sparkling','Sparkling','Fresh bubbles, from Prosecco to Champagne','bubbles'],
   ['white','White','Crisp and aromatic, or round and textured','white'],
   ['rose','Rosé','Fresh, dry or a little more savoury','rose'],
   ['red','Red','Light and juicy, through to bold and rich','red'],
   ['sweet','Sweet & dessert wine','Honeyed, luscious or fortified','sweetwine']
  ]}
 ];
 const wines = [];
 function group(kind, rows, defaults) {
  for (const [name, region, low, high, body, foods, flavours, notes, traits = {}] of rows) {
   wines.push(Object.freeze({id:`${kind}-${wines.length}`,kind,name,region,low,high,body,
    foods:foods.split(','),flavours:flavours.split(','),notes,size:750,
    acid:2,tannin:0,sweetness:0,alcohol:2,...defaults,...traits}));
  }
 }
 group('sparkling', [
  ['Prosecco brut','King Valley, Victoria',18,30,1,'seafood,vegetable,poultry','fresh,tomato','Pear, green apple and a light, fresh finish.'],
  ['Cava brut','Penedès, Spain',20,35,2,'seafood,poultry,vegetable','fresh,creamy','Citrus, almond and a dry, savoury finish.'],
  ['Sparkling Chenin Blanc','Loire Valley, France',25,40,2,'seafood,poultry,vegetable','fresh,tomato,creamy','Orchard fruit with bright acidity.'],
  ['Crémant de Loire rosé','Loire Valley, France',28,45,1,'poultry,vegetable,seafood','fresh,tomato','Red berries, citrus and gentle bubbles.'],
  ['Crémant d’Alsace','Alsace, France',30,50,2,'seafood,poultry,vegetable','fresh,creamy','Apple, citrus and a soft, bready edge.'],
  ['Blanc de blancs','Yarra Valley, Victoria',30,55,1,'seafood,vegetable','fresh,creamy','Chardonnay-led citrus, fine bubbles and freshness.',{acid:3}],
  ['Sparkling Pinot Noir rosé','Tasmania',30,60,2,'poultry,meat,seafood','smoky,tomato','Strawberry, citrus and a little savoury depth.'],
  ['Traditional-method brut','Tasmania',35,65,2,'seafood,poultry,vegetable','creamy,earthy','Lemon, brioche and a fine, dry finish.'],
  ['Sparkling Shiraz','South Australia',25,50,3,'meat,poultry','smoky,sweet','Dark berries, spice and generous texture.',{tannin:1,sweetness:1,alcohol:3}],
  ['Franciacorta brut','Lombardy, Italy',45,75,2,'poultry,seafood,vegetable','creamy,earthy','Ripe apple, toast and rounded texture.'],
  ['Champagne brut','Champagne, France',65,110,2,'seafood,poultry,vegetable','fresh,creamy,earthy','Citrus, orchard fruit and a toasty finish.',{acid:3}],
  ['Blanc de noirs','Champagne, France',75,130,3,'poultry,meat','smoky,earthy,creamy','Red-fruit depth with a fuller, savoury feel.']
 ], {acid:3});
 group('white', [
  ['Pinot Grigio','King Valley, Victoria',18,30,1,'seafood,vegetable,poultry','fresh,tomato','Pear, lemon and a clean, dry finish.',{acid:3}],
  ['Sauvignon Blanc','Marlborough, New Zealand',18,35,1,'seafood,vegetable','fresh,tomato','Citrus, passionfruit and fresh herbs.',{acid:3}],
  ['Dry Riesling','Clare Valley, South Australia',22,40,1,'seafood,vegetable,spicy','fresh,tomato','Lime, citrus blossom and bright acidity.',{acid:3}],
  ['Off-dry Riesling','Mosel, Germany',25,45,1,'spicy,seafood,poultry','fresh,sweet','Lime and apple with a gentle touch of sweetness.',{acid:3,sweetness:1,alcohol:1}],
  ['Albariño','Rías Baixas, Spain',25,45,1,'seafood,vegetable','fresh,tomato','Peach, citrus and a saline edge.',{acid:3}],
  ['Fiano','McLaren Vale, South Australia',24,40,2,'poultry,seafood,vegetable','creamy,earthy','Pear, almond and a rounded texture.'],
  ['Grüner Veltliner','Adelaide Hills, South Australia',25,45,1,'vegetable,spicy,seafood','fresh,earthy','Green apple, citrus and a white-pepper lift.',{acid:3}],
  ['Pinot Gris','Mornington Peninsula, Victoria',25,45,2,'poultry,spicy,vegetable','creamy,earthy,sweet','Ripe pear, spice and a textured palate.'],
  ['Gewürztraminer, off-dry','Alsace, France',25,45,2,'spicy,poultry','sweet,smoky','Rose, lychee and a little sweetness.',{sweetness:1}],
  ['Chenin Blanc, dry','Swartland, South Africa',25,45,2,'poultry,vegetable,seafood','creamy,fresh','Apple, quince and a bright, textural finish.',{acid:3}],
  ['Viognier','South Australia',25,45,3,'poultry,spicy','creamy,sweet','Apricot, blossom and a broad, rounded palate.',{acid:1,alcohol:3}],
  ['Chardonnay, lightly oaked','Yarra Valley, Victoria',28,50,2,'poultry,seafood,vegetable','creamy,earthy','Lemon, stone fruit and a little savoury oak.'],
  ['Semillon','Hunter Valley, New South Wales',25,50,1,'seafood,vegetable,poultry','fresh,earthy','Lemon and a lean, fresh finish; mature bottles gain toast.',{acid:3,alcohol:1}],
  ['Chardonnay, full-bodied','Margaret River, Western Australia',35,70,3,'poultry,seafood','creamy,smoky','Peach, oak and a richer texture.',{alcohol:3}]
 ]);
 group('rose', [
  ['Sangiovese rosé','Victoria',18,30,1,'vegetable,poultry,meat','tomato,fresh','Tart cherry, citrus and a dry finish.',{acid:3}],
  ['Grenache rosé','McLaren Vale, South Australia',20,35,2,'poultry,vegetable,meat','smoky,tomato','Strawberry, spice and a dry, rounded palate.'],
  ['Pinot Noir rosé','Yarra Valley, Victoria',22,38,1,'seafood,poultry,vegetable','fresh,earthy','Delicate red berries with a fresh finish.',{acid:3}],
  ['Dry Provençal rosé','Provence, France',25,45,1,'seafood,vegetable,poultry','fresh,tomato','Citrus, red berries and a dry, herbal edge.'],
  ['Tempranillo rosado','Rioja, Spain',22,38,2,'meat,poultry,vegetable','smoky,tomato','Red cherry, plum and a savoury feel.'],
  ['Syrah rosé','Heathcote, Victoria',22,38,2,'meat,poultry','smoky,earthy','Red fruit and a peppery, savoury lift.'],
  ['Cabernet Franc rosé, dry','Loire Valley, France',25,42,1,'vegetable,poultry','fresh,tomato,earthy','Redcurrant, herbs and bright acidity.',{acid:3}],
  ['Off-dry rosé','Anjou, Loire Valley, France',22,38,1,'spicy,poultry','sweet,fresh','Soft red berries with a little residual sweetness.',{sweetness:1,alcohol:1}],
  ['Tavel rosé','Southern Rhône, France',30,50,3,'meat,poultry,vegetable','smoky,earthy,creamy','Fuller-bodied, with red fruit and spice.',{alcohol:3}],
  ['Bandol rosé','Provence, France',40,65,2,'meat,poultry,seafood','earthy,smoky,creamy','Savoury red fruit, herbs and more texture.']
 ]);
 group('red', [
  ['Sangiovese','Victoria',20,38,2,'meat,vegetable,poultry','tomato,earthy','Sour cherry, dried herbs and lively acidity.',{acid:3}],
  ['Tempranillo','South Australia',20,35,2,'meat,poultry,vegetable','smoky,tomato','Plum, red cherry and savoury spice.'],
  ['Merlot','South Australia',20,35,2,'meat,poultry','earthy,creamy','Plum, dark cherry and a rounded palate.',{tannin:1}],
  ['Barbera','Piedmont, Italy',25,45,2,'meat,vegetable,poultry','tomato,fresh','Juicy cherry with high acidity and softer tannins.',{acid:3,tannin:1}],
  ['Gamay','Beaujolais, France',25,45,1,'poultry,vegetable,spicy','earthy,fresh,tomato','Bright red berries and gentle tannins.',{acid:3,tannin:1,alcohol:1}],
  ['Pinot Noir','Yarra Valley, Victoria',28,50,1,'poultry,vegetable,seafood','earthy,creamy','Cherry, forest-floor notes and fine tannins.',{acid:3,tannin:1}],
  ['Grenache','McLaren Vale, South Australia',25,45,2,'meat,poultry,vegetable','smoky,earthy,tomato','Ripe red fruit, dried herbs and spice.',{tannin:1}],
  ['Cabernet Franc','Loire Valley, France',28,50,2,'meat,vegetable,poultry','earthy,fresh,tomato','Redcurrant, leafy herbs and fresh acidity.',{acid:3}],
  ['Cool-climate Shiraz','Grampians, Victoria',28,50,2,'meat,poultry','smoky,earthy','Blackberry, pepper and a savoury finish.'],
  ['Shiraz','Barossa Valley, South Australia',25,55,3,'meat','smoky,sweet','Dark berries, spice and a generous, full palate.',{tannin:3,alcohol:3}],
  ['Malbec','Mendoza, Argentina',22,42,3,'meat','smoky,earthy','Dark plum, violet and a rich, rounded palate.',{tannin:3,alcohol:3}],
  ['Chianti Classico','Tuscany, Italy',30,55,2,'meat,vegetable,poultry','tomato,earthy','Sangiovese-led cherry, herbs and firm freshness.',{acid:3}],
  ['Rioja Crianza','Rioja, Spain',25,45,2,'meat,poultry','smoky,earthy','Red fruit, savoury spice and oak.'],
  ['Cabernet Sauvignon','Margaret River, Western Australia',30,60,3,'meat','smoky,earthy','Blackcurrant, cedar and structured tannins.',{tannin:3}],
  ['Nebbiolo','Langhe, Piedmont, Italy',35,65,2,'meat,vegetable','earthy,tomato','Rose, red cherry and firm, drying tannins.',{acid:3,tannin:3}],
  ['Mourvèdre-led red','Bandol, Provence, France',45,80,3,'meat','earthy,smoky','Dark fruit, herbs and a firm, savoury structure.',{tannin:3,alcohol:3}]
 ], {tannin:2});
 group('sweet', [
  ['Moscato d’Asti','Piedmont, Italy',20,35,1,'dessert,spicy','fresh,sweet','Peach and orange blossom with gentle bubbles.',{sweetness:2,alcohol:1}],
  ['Late-harvest Riesling','Australia or New Zealand',22,40,1,'dessert,spicy','fresh,sweet','Citrus and ripe orchard fruit with a sweet finish.',{acid:3,sweetness:2,alcohol:1,size:375}],
  ['Brachetto d’Acqui','Piedmont, Italy',25,45,1,'dessert','sweet,fresh','Rose and red berries in a sweet, lightly sparkling red.',{sweetness:2,alcohol:1}],
  ['Botrytis Semillon','Riverina, New South Wales',25,50,2,'dessert','sweet,creamy,fresh','Apricot, honey and luscious sweetness.',{acid:3,size:375}],
  ['Muscat de Beaumes-de-Venise','Southern Rhône, France',25,45,2,'dessert','sweet,fresh','Orange blossom and honeyed stone fruit.',{alcohol:3,size:375}],
  ['Ruby Port','Douro, Portugal',25,45,3,'dessert','sweet,creamy','Sweet dark berries and a warming, rich finish.',{tannin:2,alcohol:3}],
  ['Rutherglen Muscat','Rutherglen, Victoria',25,50,3,'dessert','sweet,creamy,smoky','Raisin, toffee and rich, sweet complexity.',{alcohol:3,size:375}],
  ['Rutherglen Topaque','Rutherglen, Victoria',25,50,3,'dessert','sweet,creamy,earthy','Malt, honey and a rich, warming texture.',{alcohol:3,size:375}],
  ['Tawny Port','Douro, Portugal',30,65,3,'dessert','sweet,smoky,earthy','Nuts, caramel and sweet dried fruit.',{alcohol:3}],
  ['Pedro Ximénez sherry','Jerez, Spain',30,55,3,'dessert','sweet,smoky,creamy','Intense raisin, fig and treacle sweetness.',{acid:1,alcohol:3,size:375}],
  ['Sauternes','Bordeaux, France',35,70,2,'dessert','sweet,fresh,creamy','Honey, apricot and balancing acidity.',{acid:3,size:375}],
  ['Tokaji Aszú','Tokaj, Hungary',50,95,2,'dessert','sweet,fresh,earthy','Honeyed fruit and concentrated sweetness with fresh acidity.',{acid:3,size:500}]
 ], {sweetness:3});

 const kindLabels = {sparkling:'Sparkling',white:'White',rose:'Rosé',red:'Red',sweet:'Sweet'};
 const bodyLabels = {1:'Light-bodied',2:'Medium-bodied',3:'Full-bodied'};
 function validateAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 4 || !answers.every((v,i) => questions[i].options.some(o=>o[0]===v))) throw new TypeError('Choose an answer to each of the four questions.');
 }
 function score(wine, answers) {
  const [food, flavour, weight] = answers;
  const body = {light:1,medium:2,rich:3}[weight];
  let value = 9 - Math.abs(wine.body-body)*7;
  value += wine.foods.includes(food) ? 14 : -4;
  value += wine.flavours.includes(flavour) ? 17 : 0;
  if (flavour==='fresh' || flavour==='tomato') value += wine.acid*3;
  if (flavour==='creamy') value += wine.acid*2;
  if (flavour==='earthy') value -= wine.tannin*2;
  if (flavour==='smoky') value += wine.body*2;
  if (food==='meat' && flavour!=='tomato') value += wine.tannin*2;
  if (food==='seafood' && wine.tannin>=2) value -= 16;
  if (food==='spicy') value += wine.sweetness*4 - wine.alcohol*5 - wine.tannin*4;
  if (flavour==='sweet') value += wine.sweetness*4;
  return value;
 }
 function recommend(answers, order='price') {
  validateAnswers(answers);
  const [food, flavour, , style] = answers;
  // Dessert is a hard constraint, including callers outside the UI.
  let pool = wines.filter(w=>food==='dessert' ? w.kind==='sweet' : style==='any' ? (w.kind!=='sweet' || food==='spicy' || flavour==='sweet') : w.kind===style);
  const ranked = pool.map(wine=>({wine,score:score(wine,answers)})).sort((a,b)=>b.score-a.score || a.wine.low-b.wine.low || a.wine.name.localeCompare(b.wine.name));
  const selected = ranked.slice(0,8).map((r,i)=>({...r,rank:i+1}));
  if (order==='price') selected.sort((a,b)=>a.wine.low-b.wine.low || a.wine.high-b.wine.high || a.rank-b.rank);
  return selected;
 }
 function explain(wine, answers) {
  const [food, flavour, weight] = answers;
  let reason;
  if (food==='dessert') reason = wine.sweetness>=3 ? 'Luscious sweetness suits a sweet course or contrasts with salty blue cheese.' : 'A lighter sweet style for fruit-led desserts or a gentler blue cheese.';
  else if (food==='spicy' && wine.sweetness>0 && wine.alcohol<3) reason = 'A little sweetness helps soften chilli heat, while the fruit complements aromatic seasoning.';
  else if (flavour==='tomato' && wine.acid===3) reason = 'Fresh acidity keeps pace with a tangy tomato sauce or dressing.';
  else if (flavour==='creamy' && wine.acid===3) reason = 'Bright acidity brings freshness between bites of a creamy, rich dish.';
  else if (flavour==='creamy' && wine.body>=2) reason = 'A rounded texture sits comfortably beside a creamy sauce.';
  else if (flavour==='earthy' && wine.flavours.includes('earthy')) reason = 'Savoury notes complement mushrooms, herbs and earthy flavours.';
  else if (flavour==='smoky' && wine.flavours.includes('smoky')) reason = 'Fruit and savoury spice suit chargrilled or smoky flavours.';
  else if (flavour==='fresh' && wine.acid===3) reason = 'Crisp acidity echoes citrus and fresh herbs without weighing down the meal.';
  else if (food==='meat' && wine.tannin>=2) reason = 'Structure and tannins suit the protein and richness of red meat.';
  else if (wine.foods.includes(food)) reason = 'Its fruit and texture make it a useful option for this kind of meal.';
  else reason = 'An exploratory option within your chosen style; the fit depends on the sauce and seasoning.';
  const target={light:1,medium:2,rich:3}[weight];
  if (wine.body===target) reason += ` Its ${['','light','medium','full'][wine.body]} body matches the dish’s weight.`;
  const cautions=[];
  if(food==='spicy' && (wine.alcohol===3 || wine.tannin>=2)) cautions.push('Keep chilli gentle: higher alcohol or firm tannin can amplify the heat.');
  if(food==='seafood' && wine.tannin>=2) cautions.push('An adventurous match: firm tannins can overwhelm delicate fish. Try it with a richer preparation.');
  if(food==='dessert' && wine.sweetness===2) cautions.push('Keep the dessert lightly sweet; a very sugary dessert may overwhelm this wine.');
  if(food!=='dessert' && wine.kind==='sweet' && food!=='spicy') cautions.push('A sweet contrast rather than a classic dry pairing. Try a small pour first.');
  return {reason,caution:cautions.join(' ')};
 }
 const api=Object.freeze({questions,wines:Object.freeze(wines),kindLabels,bodyLabels,recommend,explain});
 if (typeof module!=='undefined' && module.exports) module.exports=api;
 else window.WinePairings=api;
})();
