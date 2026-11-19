'use strict';

(() => {
 const {questions,kindLabels,bodyLabels,recommend,explain}=window.WinePairings;
 const $=id=>document.getElementById(id);
 let answers=Array(4).fill(null), step=0, returnToResults=false, matches=[];
 const create=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
 const paths={
  fish:'M3 12c5-8 12-8 16 0-4 8-11 8-16 0Zm16 0 4-5v10Zm-5-2h.1',
  bird:'M5 15c-3-5 2-10 7-7l3 3c5-1 7 4 4 7-3 3-11 3-14-3Zm7-7 3-5 3 3-3 5M8 12l4 4',
  leaf:'M4 19C0 7 9 2 21 3c0 12-6 20-17 16Zm0 0L17 7M10 13V8m0 5h6',
  steak:'M4 6c6-6 18-1 17 8-1 7-9 8-13 4-3-2-9-4-4-12Zm4 1c-4 6-1 7 3 9m3-7 3 2m-3 2 3 2',
  chilli:'M19 5c0 12-7 16-16 15 7-2 4-11 12-12m0 0c-1-5 3-5 5-6m-5 6 5-1',
  cake:'M4 11 14 5l7 6H4Zm0 0v9h17v-9M5 16h16M14 5V2',
  citrus:'M4 7c7-6 17 0 15 10C10 21 3 17 4 7Zm2 1 11 8M11 4l1 8M4 13l9-1',
  cream:'M4 9h16v4c0 5-16 5-16 0V9Zm3 0c-2-5 3-8 5-3 3-4 7-1 5 3M7 21h10',
  mushroom:'M2 12c0-12 20-12 20 0H2Zm7 0v9h6v-9M6 8h.1M14 5h.1M18 9h.1',
  flame:'M12 2c3 5-1 7 3 10l3-5c9 13-10 20-13 8-1-5 2-7 3-10 0 5 2 5 4 7',
  tomato:'M12 8c-13-5-13 14 0 13 13 1 13-18 0-13Zm0 0V2M7 5l5 3 6-3m-6 3 3 4',
  honey:'M9 3h6v4H9zM6 10h12l2 10H4l2-10Zm2 4h8m-8 3h8M12 7v3',
  glass:'M6 3h12l1 6c1 7-15 7-14 0l1-6Zm6 12v7m-5 0h10',
  bubbles:'M6 5h12l1 6c0 7-14 7-14 0l1-6Zm6 12v5m-4 0h8M9 9h.1m5-6h.1m0 8h.1',
  white:'M6 3h12l1 6c1 7-15 7-14 0l1-6ZM5 10h14m-7 5v7m-5 0h10',
  rose:'M6 3h12l1 6c1 7-15 7-14 0l1-6ZM5 8c5-2 9 2 14 0m-7 7v7m-5 0h10',
  red:'M6 3h12l1 6c1 7-15 7-14 0l1-6ZM5 7h14m-7 8v7m-5 0h10M8 10l1 2',
  sweetwine:'M5 4h14l-2 8H7L5 4Zm7 8v10m-5 0h10m-8-15h.1m5 1h.1',
  light:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v8',
  medium:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 8v8m6-8v8',
  rich:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8 8v8m4-8v8m4-8v8'
 };
 function icon(name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.4','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',class:'option-icon'}))svg.setAttribute(key,value);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[name]||paths.glass);svg.append(path);return svg;
 }
 function label(index){return questions[index].options.find(o=>o[0]===answers[index])?.[1]||'';}
 function focusHeading(id){
  const title=$(id);title.focus({preventScroll:true});
  const rect=title.getBoundingClientRect();
  if(rect.top<16 || rect.bottom>window.innerHeight-24)title.scrollIntoView({behavior:'instant',block:'start'});
 }
 function renderSummary(){
  $('answers').replaceChildren();
  answers.forEach((answer,index)=>{
   if(!answer)return;
   const li=create('li'),button=create('button','answer-button');button.type='button';button.dataset.edit=String(index);button.setAttribute('aria-label',`Change ${questions[index].label.toLowerCase()}: ${label(index)}`);
   const value=create('span','answer-value',label(index)),edit=create('span','answer-edit','Edit');edit.setAttribute('aria-hidden','true');value.append(edit);
   button.append(create('span','answer-label',questions[index].label),value);li.append(button);$('answers').append(li);
  });
  $('summary-empty').hidden=answers.some(Boolean);$('restart').hidden=!answers.some(Boolean);
 }
 function renderQuestion(focus=true){
  $('quiz').hidden=false;$('results').hidden=true;
  const question=questions[step];$('question-count').textContent=`Question ${step+1} of 4`;$('question-title').textContent=question.title;
  $('question-hint').textContent=step===3&&answers[0]==='dessert'?'For dessert or blue cheese, explore a sweet style. A dessert needs a wine at least as sweet as the food.':question.hint;
  $('steps').replaceChildren();
  const firstMissing=answers.findIndex(v=>v===null);
  questions.forEach((q,index)=>{
   const li=create('li',answers[index]?'completed':''),button=create('button');button.type='button';button.dataset.step=String(index);button.disabled=firstMissing!==-1&&index>firstMissing&&!answers[index];button.setAttribute('aria-label',`${index+1}. ${q.label}${answers[index]?`, selected: ${label(index)}`:''}`);
   if(index===step)button.setAttribute('aria-current','step');
   const number=create('span','step-number',String(index+1));number.setAttribute('aria-hidden','true');button.append(number,create('span','',q.label));li.append(button);$('steps').append(li);
  });
  $('options').replaceChildren();
  const options=step===3&&answers[0]==='dessert'?question.options.filter(o=>o[0]==='any'||o[0]==='sweet'):question.options;
  options.forEach(([id,title,note,symbol])=>{
   const button=create('button','option');button.type='button';button.dataset.option=id;button.setAttribute('aria-pressed',String(answers[step]===id));
   const copy=create('span','option-copy');copy.append(create('span','option-title',title),create('span','option-note',note));button.append(icon(symbol),copy);$('options').append(button);
  });
  $('back').disabled=step===0;renderSummary();if(focus)focusHeading('question-title');
 }
 function renderCards(){
  $('wine-grid').replaceChildren();
  for(const {wine,rank} of matches){
   const article=create('article',`wine-card${rank===1?' best':''}`);article.dataset.wine=wine.id;
   const top=create('div','wine-card-top');top.append(create('span','wine-kind',kindLabels[wine.kind]));if(rank===1)top.append(create('span','match-label','Best pairing fit'));
   const title=create('h3','',wine.name);title.id=`wine-${wine.id}`;article.setAttribute('aria-labelledby',title.id);
   const {reason,caution}=explain(wine,answers),why=create('p','wine-reason');why.append(create('strong','','Why try it'),document.createTextNode(reason));
   article.append(top,title,create('p','wine-region',wine.region),create('p','tasting-note',wine.notes),why);
   if(caution)article.append(create('p','wine-caution',caution));
   const bottom=create('div','wine-bottom'),price=create('div');price.append(create('span','wine-price',`A$${wine.low}–${wine.high}`),create('span','bottle-size',`${wine.size} ml · estimate`));bottom.append(price,create('span','wine-weight',bodyLabels[wine.body]));article.append(bottom);
   const details=create('details'),summary=create('summary','','At the bottle shop');
   const look=wine.kind==='sweet'?`Look for “${wine.name}” and check sweetness with the retailer. Sweet wine formats vary; the estimate above is for ${wine.size} ml.`:`Look for “${wine.name}”. ${wine.region} is a region to explore, rather than a required origin. Ask for a ${bodyLabels[wine.body].toLowerCase()} example.`;
   details.append(summary,create('p','',look));article.append(details);$('wine-grid').append(article);
  }
 }
 function showResults(focus=true){
  matches=recommend(answers,$('sort').value);$('quiz').hidden=true;$('results').hidden=false;
  $('result-note').textContent=answers[0]==='dessert'?'Sweet styles for the final course. Choose a wine at least as sweet as your dessert; lighter sweet wines suit lighter desserts.':`Selected for ${label(0).toLowerCase()}, with ${label(1).toLowerCase()} flavours and a ${answers[2]==='rich'?'full-flavoured':answers[2]} feel. ${answers[3]==='any'?'A mix of styles, led by the food.':'Eight options within your chosen wine style.'}`;
  renderCards();renderSummary();if(focus)focusHeading('results-title');
 }
 function goTo(index,edit=false){step=index;returnToResults=edit&&answers.every(Boolean);renderQuestion();}
 function reset(){answers=Array(4).fill(null);step=0;returnToResults=false;matches=[];$('sort').value='price';$('wine-grid').replaceChildren();$('feedback').textContent='New pairing started. Choose your food.';renderQuestion();}
 $('options').addEventListener('click',event=>{
  const button=event.target.closest('button[data-option]');if(!button)return;
  answers[step]=button.dataset.option;
  if(step===0&&answers[0]==='dessert'&&!['any','sweet',null].includes(answers[3]))answers[3]=null;
  if((returnToResults&&answers.every(Boolean))||step===3){returnToResults=false;showResults();}
  else{step=returnToResults?answers.findIndex(v=>v===null):step+1;returnToResults=false;renderQuestion();}
 });
 $('steps').addEventListener('click',event=>{const button=event.target.closest('button[data-step]');if(button&&!button.disabled)goTo(Number(button.dataset.step));});
 $('answers').addEventListener('click',event=>{const button=event.target.closest('button[data-edit]');if(button)goTo(Number(button.dataset.edit),true);});
 $('back').addEventListener('click',()=>{if(step>0)goTo(step-1);});
 $('restart').addEventListener('click',reset);$('new-pairing').addEventListener('click',reset);
 $('sort').addEventListener('change',()=>{matches=recommend(answers,$('sort').value);renderCards();$('feedback').textContent=$('sort').value==='price'?'Eight matches sorted by estimated price, low to high.':'Eight matches sorted by pairing fit.';});
 // Local input policy avoids changing shared behavior for other apps.
 document.addEventListener('keydown',()=>{document.documentElement.dataset.input='keyboard';},true);
 document.addEventListener('pointerdown',()=>{document.documentElement.dataset.input='pointer';},true);
 document.addEventListener('click',event=>{if(event.detail===0)document.documentElement.dataset.input='keyboard';},true);
 renderQuestion(false);
})();
