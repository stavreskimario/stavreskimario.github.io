'use strict';

(() => {
 const C = TripCore, editor = window.tripEditor, files = TripDocuments;
 const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
 const button = (text, action, className = 'button secondary') => { const el = node('button',text,className); el.type = 'button'; el.addEventListener('click',action); return el; };
 const link = (text, href, className = 'text-link') => { const el = node('a',text,className); el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer'; return el; };
 const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
 const state = () => editor.snapshot();
 const findEvent = id => days.flatMap(d=>d.events).find(e=>e.id===id);
 const destination = event => event.query || place(event.map)?.query || '';
 const content = $('#tool-content'), dialog = $('#travel-dialog'), form = $('#travel-form');
 let modalVersion = 0;
 let tool = 'ideas', returnFocus, onSave, onDelete, busy = false, documentFilter = '', documentList = [], documentIssue = '', removedDocument = null;
 let importDraft = [], importReview = null, mapKey = '', weather = null, weatherPending = false;
 let offlineStatus = 'Keep the itinerary and app on this device for flights and patchy reception.';
 try { mapKey = localStorage.getItem('mario-la-dec2026-embed-key') || ''; } catch {}
 function feedback(message) { $('#tools-feedback').textContent = message; }
 function mutate(change,message) { editor.update(change,message); }
 function download(name, content, type) {
  const object = URL.createObjectURL(new Blob([content],{type})), a = node('a'); a.href = object; a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(object),30000);
 }
 function heading(title, description) {
  const h = node('h3',title,'tool-heading'); h.tabIndex = -1; content.append(h); if(description) content.append(node('p',description,'tool-intro'));
 }
 function toolbar(...items) { const el=node('div',undefined,'tool-actions'); el.append(...items); return el; }
 function empty(message) { return node('p',message,'tool-empty'); }
 function card(title,meta) { const el=node('article',undefined,'tool-card'); el.append(node('h4',title)); if(meta) el.append(node('p',meta,'small-note')); return el; }
 function field(name,label,value = '',options = {}) {
  const wrap = node('label',label,options.full ? 'full-field' : ''); wrap.htmlFor = `travel-${name}`;
  const input = document.createElement(options.choices ? 'select' : options.multiline ? 'textarea' : 'input');
  input.id = `travel-${name}`; input.name = name;
  if(options.choices) for(const [v,t] of options.choices) { const o = node('option',t); o.value = v; input.append(o); }
  else { if(!options.multiline) input.type = options.type || 'text'; input.maxLength = options.max || 160; if(options.multiline) input.rows = 3; }
  if(options.required) input.required = true;
  for(const key of ['min','max','step','placeholder','accept','inputMode']) if(options[key] !== undefined) input[key] = options[key];
  input.value = value ?? ''; wrap.append(input); $('#travel-fields').append(wrap); return input;
 }
 function modal(title,build,save,remove) {
  modalVersion++; returnFocus = document.activeElement; onSave = save; onDelete = remove; busy = false;
  form.reset(); $('#travel-fields').replaceChildren(); $('#travel-error').textContent = '';
  $('#travel-dialog-title').textContent = title; $('#travel-save').textContent = 'Save'; $('#travel-save').disabled = false;
  $('#travel-delete').hidden = !remove; build(); dialog.showModal();
  $('#travel-fields').querySelector('input,select,textarea,button')?.focus();
 }
 function close() { modalVersion++; busy = false; dialog.close(); if(returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({preventScroll:true}); else content.querySelector('h3')?.focus({preventScroll:true}); }
 async function submit(action) {
  if(busy) return;
  const version = modalVersion;
  try { busy = true; $('#travel-save').disabled = true; await action(); if(version === modalVersion) close(); }
  catch(error) { if(version === modalVersion) $('#travel-error').textContent = error.message; else feedback(error.message); }
  finally { if(version === modalVersion) { busy = false; $('#travel-save').disabled = false; } }
 }
 form.addEventListener('submit',event => {
  event.preventDefault();
  for(const el of $('#travel-fields').querySelectorAll('input,select,textarea')) if(!el.checkValidity()) { el.reportValidity(); return; }
  submit(()=>onSave(new FormData(form)));
 });
 $('#travel-delete').addEventListener('click',()=>submit(onDelete));
 document.querySelectorAll('[data-travel-close]').forEach(el=>el.addEventListener('click',close));
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 form.addEventListener('input',()=>$('#travel-error').textContent='');
 function choose(name,focus = false) {
  tool = name; document.querySelectorAll('button[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===name))); render(); if(focus) content.querySelector('h3')?.focus();
 }
 document.querySelectorAll('button[data-tool]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.tool)));
 function openTools(name) { showView('tools'); choose(name,true); }

 function editIdea(id) {
  const idea = state().companion.ideas.find(i=>i.id===id) || {title:'',query:'',source:'',note:''};
  modal(id?'Edit idea':'Save an idea',()=>{
   field('title','Place or idea',idea.title,{required:true,full:true}); field('query','Map destination',idea.query,{max:500,full:true});
   field('source','Website',idea.source,{type:'url',max:2000,full:true}); field('note','Why go?',idea.note,{multiline:true,max:5000,full:true});
  },data=>mutate(next=>{const item={id:id||uid('idea'),...Object.fromEntries(data)}; const list=next.companion.ideas,index=list.findIndex(i=>i.id===id); if(index<0)list.push(item);else list[index]=item;},'Idea saved.'),id?()=>mutate(next=>next.companion.ideas=next.companion.ideas.filter(i=>i.id!==id),'Idea removed. Undo to restore it.'):null);
 }
 function scheduleIdea(id) {
  const idea = state().companion.ideas.find(i=>i.id===id); if(!idea)return;
  modal('Add idea to a day',()=>{
   field('title','Event name',idea.title,{required:true,full:true}); field('day','Trip day',days[selectedDay].date,{choices:days.map(d=>[d.date,`${d.date} December · ${d.label}`])});
   field('time','Time label','',{placeholder:'e.g. Afternoon · flexible'});
   field('status','Status','proposed',{choices:Object.entries(statuses)});
   field('location','Location',idea.query.slice(0,240),{max:240,full:true});
  },data=>{
   const day = Number(data.get('day'));
   mutate(next=>{ const item=next.companion.ideas.find(i=>i.id===id); if(!item)throw new Error('This idea no longer exists.'); next.days.find(d=>d.date===day).events.push({id:uid('event'),title:data.get('title'),time:data.get('time'),status:data.get('status'),location:data.get('location'),query:item.query,source:item.source,note:item.note,type:'pin'}); next.companion.ideas=next.companion.ideas.filter(i=>i.id!==id); },'Idea moved into your itinerary.');
  });
 }
 function renderIdeas() {
  heading('For a free afternoon','Keep places and links here until you know which day they belong to.');
  content.append(toolbar(button('Save an idea',()=>editIdea()),button('View bookings',()=>showView('reservations'))));
  const grid=node('div',undefined,'tool-grid');
  for(const idea of state().companion.ideas) { const el=card(idea.title,idea.query); el.append(node('p',idea.note)); const actions=toolbar(button('Add to a day',()=>scheduleIdea(idea.id)),button('Edit',()=>editIdea(idea.id),'edit-event')); if(idea.source) actions.append(link('Website ↗',idea.source)); if(idea.query) actions.append(link('Map ↗',mapLinkUrl(idea.query))); el.append(actions); grid.append(el); }
  content.append(grid.children.length?grid:empty('Nothing tucked away yet. Save a café, a view or a place you’ve been meaning to visit.'));
  const tasks=node('section',undefined,'tool-section'); tasks.append(node('h3','Before you go','tool-heading'));
  const data=state().companion;
  for(const task of data.tasks) {
   const row=node('div',undefined,'task-row'), label=node('label'), check=node('input'); check.type='checkbox'; check.checked=task.done;
   check.addEventListener('change',()=>{try{mutate(next=>next.companion.tasks.find(t=>t.id===task.id).done=check.checked,'Task updated.');const target=content.querySelector(`[data-task-id="${task.id}"]`);target?.focus();}catch(e){check.checked=!check.checked;feedback(e.message);}});check.dataset.taskId=task.id;
   label.append(check,node('span',task.title)); row.append(label,button('Edit',()=>editTask(task.id),'edit-event'));tasks.append(row);
  }
  tasks.append(button('Add a planning task',()=>editTask())); content.append(tasks);
 }
 function editTask(id) {
  const current=state().companion.tasks.find(t=>t.id===id);
  modal(current?'Edit planning task':'Add a planning task',()=>field('title','Task',current?.title||'',{required:true,full:true}),data=>mutate(next=>{const item={id:id||uid('task'),title:data.get('title'),done:current?.done||false},index=next.companion.tasks.findIndex(t=>t.id===id);if(index<0)next.companion.tasks.push(item);else next.companion.tasks[index]=item;},'Planning task saved.'),current?()=>mutate(next=>next.companion.tasks=next.companion.tasks.filter(t=>t.id!==id),'Planning task removed.'):null);
 }
 function editExpense(id) {
  const e=state().companion.expenses.find(e=>e.id===id)||{title:'',amount:0,currency:'USD',state:'planned',payer:'Mario',marioShare:50,date:`2026-12-${days[selectedDay].date}`,category:'Other',event:'',note:'',actualAud:null};
  modal(id?'Edit expense':'Add an expense',()=>{
   field('title','What was it for?',e.title,{required:true,full:true}); field('amount','Amount',id?(e.amount/100).toFixed(2):'',{required:true,inputMode:'decimal'});
   field('currency','Currency',e.currency,{choices:[['USD','USD · US dollars'],['AUD','AUD · Australian dollars']]});
   field('state','Payment status',e.state,{choices:[['planned','Planned — not paid'],['paid','Paid']]}); field('date','Date',e.date,{type:'date',required:true});
   field('payer','Paid by / planned payer',e.payer,{choices:C.people.map(p=>[p,p])});
   field('marioShare','Mario’s share (%)',e.marioShare,{type:'number',min:0,max:100,step:1,required:true});
   $('#travel-fields').append(node('p','Andreas covers the rest. Use 100% or 0% for a personal expense.','field-hint full-field'));
   field('category','Category',e.category,{choices:['Flights','Stay','Food & drink','Activities','Transport','Shopping','Other'].map(x=>[x,x])});
   field('event','Linked activity',e.event,{choices:[['','No linked activity'],...days.flatMap(d=>d.events.map(x=>[x.id,`${d.date} Dec · ${x.title}`]))],full:true});
   field('actualAud','Actual AUD card charge (paid USD only)',e.actualAud===null?'':(e.actualAud/100).toFixed(2),{inputMode:'decimal',full:true,placeholder:'Optional; overrides the planning rate'});
   field('note','Notes',e.note,{max:2000,multiline:true,full:true});
  },data=>{
   const r=Object.fromEntries(data);r.id=id||uid('expense');r.amount=C.cents(r.amount);r.marioShare=Number(r.marioShare);r.actualAud=r.actualAud===''?null:C.cents(r.actualAud);
   mutate(next=>{const index=next.companion.expenses.findIndex(e=>e.id===id);if(index<0)next.companion.expenses.push(r);else next.companion.expenses[index]=r;},'Expense saved.');
  },id?()=>mutate(next=>next.companion.expenses=next.companion.expenses.filter(e=>e.id!==id),'Expense removed. Undo to restore it.'):null);
 }
 function budgetSettings() {
  const data=state().companion;
  modal('Budget & exchange rate',()=>{
   field('budget','Trip budget (AUD)',data.budget===null?'':(data.budget/100).toFixed(2),{inputMode:'decimal',full:true});
   field('rate','1 USD = how many AUD?',data.rate??'',{type:'number',min:0.000001,max:1000,step:'any',full:true});
   $('#travel-fields').append(node('p','Enter your own planning rate. It is not a live exchange rate. Actual AUD charges stay fixed when you change it.','small-note full-field'));
  },data=>mutate(next=>{next.companion.budget=data.get('budget')===''?null:C.cents(data.get('budget'));next.companion.rate=data.get('rate')===''?null:Number(data.get('rate'));},'Budget settings saved.'));
 }
 function editSettlement(id) {
  const current=state().companion.settlements.find(s=>s.id===id);
  modal(current?'Edit repayment':'Record a repayment',()=>{
   field('from','Who paid the other person?',current?.from||'Mario',{choices:C.people.map(p=>[p,p])});
   field('amount','Amount in AUD',current?(current.amount/100).toFixed(2):'',{required:true,inputMode:'decimal'});
   field('date','Date',current?.date||new Date().toISOString().slice(0,10),{type:'date',required:true});
   field('note','Notes',current?.note||'',{max:2000,multiline:true,full:true});
   $('#travel-fields').append(node('p','Repayments adjust who owes whom. They do not add to trip spending.','small-note full-field'));
  },data=>mutate(next=>{const r={id:id||uid('repayment'),...Object.fromEntries(data),amount:C.cents(data.get('amount'))},index=next.companion.settlements.findIndex(s=>s.id===id);if(index<0)next.companion.settlements.push(r);else next.companion.settlements[index]=r;},'Repayment saved.'),current?()=>mutate(next=>next.companion.settlements=next.companion.settlements.filter(s=>s.id!==id),'Repayment removed.'):null);
 }
 function renderExpenses() {
  const data=state().companion,t=C.totals(data);
  heading('Spend a little. Keep track.','Plan in USD or AUD, record what was paid and keep shared costs clear.');
  content.append(toolbar(button('Add expense',()=>editExpense()),button('Budget & rate',budgetSettings),button('Record repayment',()=>editSettlement())));
  const stats=node('div',undefined,'expense-stats');
  for(const [label,value] of [['Paid',C.money(t.paid)],['Still planned',C.money(t.planned)],['Left in budget',t.remaining===null?'Not set':C.money(t.remaining)]]) {const el=node('div');el.append(node('span',label),node('strong',value));stats.append(el);} content.append(stats);
  content.append(node('p',data.rate?`Planning rate: 1 USD = ${data.rate} AUD. Actual card charges take priority.`:'No exchange rate set. AUD totals exclude USD expenses without an actual AUD charge.','small-note'));
  if(t.unconverted) content.append(node('p',`${t.unconverted} expense${t.unconverted===1?'':'s'} still need an exchange rate. The AUD totals and balance are incomplete.`,'travel-warning'));
  const balance=t.balance===0?'You’re square so far.':`${t.balance>0?'Mario owes Andreas':'Andreas owes Mario'} ${C.money(Math.abs(t.balance))}.`;
  content.append(node('p',`${t.unconverted?'Partial balance: ':''}${balance} Planned costs are excluded.`,'expense-balance'));
  if(!data.expenses.length) content.append(empty('Add your first cost. Nothing is counted twice: changing Planned to Paid moves it between totals.'));
  const list=node('div',undefined,'tool-grid');
  for(const e of data.expenses) {
   const el=card(e.title,`${e.date} · ${e.category} · ${e.state==='paid'?'Paid':'Planned'}`);
   el.append(node('p',C.money(e.amount,e.currency),'expense-amount'),node('p',`${e.payer} ${e.state==='paid'?'paid':'to pay'} · Mario ${e.marioShare}% / Andreas ${100-e.marioShare}%`,'small-note'));
   if(e.actualAud!==null)el.append(node('p',`Actual charge ${C.money(e.actualAud)}`,'small-note'));
   const linked=findEvent(e.event);if(e.event)el.append(node('p',linked?`Activity: ${linked.title}`:'Previously linked activity was removed.','small-note'));
   if(e.note)el.append(node('p',e.note));el.append(button('Edit expense',()=>editExpense(e.id),'edit-event'));list.append(el);
  }
  content.append(list);
  if(data.settlements.length) {const section=node('section',undefined,'tool-section');section.append(node('h3','Repayments','tool-heading'));for(const s of data.settlements){const el=card(`${s.from} repaid ${C.money(s.amount)}`,s.date);if(s.note)el.append(node('p',s.note));el.append(button('Edit repayment',()=>editSettlement(s.id),'edit-event'));section.append(el);}content.append(section);}
 }
 async function refreshDocuments() { try { documentList=await files.all();documentIssue=''; } catch(e){documentIssue=e.message;} if(tool==='documents')render(); }
 function addDocument() {
  modal('Keep a ticket or document',()=>{
   field('event','Linked activity',documentFilter,{choices:[['','Trip document'],...days.flatMap(d=>d.events.map(e=>[e.id,`${d.date} Dec · ${e.title}`]))],full:true});
   field('file','File','',{type:'file',accept:'.pdf,.png,.jpg,.jpeg,.webp,.txt',required:true,full:true});
   $('#travel-fields').append(node('p','PDF, image or text, up to 5 MB. Stored only on this device. Keep originals and download a complete backup before clearing website data.','small-note full-field'));
  },async data=>{const id=data.get('event');await files.add(data.get('file'),id,findEvent(id)?.title||'');await refreshDocuments();feedback('Document saved on this device.');});
 }
 function renderDocuments() {
  heading('Tickets, within reach','Your tickets and travel documents stay on this device. They are never uploaded by this app.');
  content.append(toolbar(button('Add document',addDocument),button('All documents',()=>{documentFilter='';render();}),button('Complete backup',()=>{choose('travel',true);} )));
  if(documentFilter)content.append(node('p',`For: ${findEvent(documentFilter)?.title||'Removed activity'}`,'small-note'));
  if(documentIssue)content.append(node('p',documentIssue,'travel-warning'));
  const list=node('div',undefined,'tool-grid');
  for(const file of documentList.filter(f=>!documentFilter||f.event===documentFilter)){
   const event=findEvent(file.event),meta=event?event.title:file.event?`${file.eventTitle||'Activity'} · no longer in itinerary`:'Trip document';
   const el=card(file.name,`${meta} · ${(file.size/1024/1024).toFixed(2)} MB`);
   el.append(toolbar(button('Download / open',()=>files.download(file)),button('Remove',async()=>{try{removedDocument=await files.remove(file.id);await refreshDocuments();feedback('Document removed. Undo is available until another removal or reload.');}catch(e){feedback(e.message);}},'edit-event')));list.append(el);
  }
  content.append(list.children.length?list:empty('Add a confirmation, ticket or useful document. Files are available offline once saved.'));
  if(removedDocument)content.append(button('Undo document removal',async()=>{try{await files.merge([removedDocument]);removedDocument=null;await refreshDocuments();feedback('Document restored.');}catch(e){feedback(e.message);}}));
 }
 function renderImport() {
  heading('Bring your plans together','Paste one idea per line, or use: Name | 23 Dec | 7:30 pm | Location | https://website. Everything is reviewed before it is added.');
  const wrap=node('label','Plans to import','import-label');const input=node('textarea');input.id='paste-plans';input.maxLength=30000;input.rows=6;input.placeholder='A place to visit | 24 Dec | Afternoon | Los Angeles';wrap.htmlFor=input.id;wrap.append(input);content.append(wrap);
  content.append(node('p','For screenshots or PDFs, copy the text using your device’s text selection, then paste it here. This importer does not read images or guess reservations.','small-note'));
  content.append(button('Review import',()=>{try{importDraft=C.draftText(input.value);reviewImport();}catch(e){feedback(e.message);}}));
  const review=node('div');review.id='plan-import-review';content.append(review);
  if(importDraft.length)reviewImport();
 }
 function reviewImport() {
  const host=$('#plan-import-review');host.replaceChildren();if(!importDraft.length)return;
  host.append(node('h4','Review before adding','tool-heading'),node('p','Choose a day, or keep an item as an unscheduled idea. Imported events start as Proposed. Time labels stay flexible until you enter exact times.','small-note'));
  const form=node('form');form.className='import-review';
  importDraft.forEach((draft,index)=>{
   const row=node('fieldset');row.append(node('legend',`Item ${index+1}`));
   for(const [key,label,max] of [['title','Name',160],['time','Time label',160],['location','Location',240],['source','Website',2000],['note','Notes',2000]]){
    const wrap=node('label',label),input=node('input');input.value=draft[key];input.maxLength=max;input.required=key==='title';if(key==='source')input.type='url';input.dataset.importField=key;wrap.append(input);row.append(wrap);
   }
   const wrap=node('label','Add to'),select=node('select');for(const [value,text] of [['','Unscheduled ideas'],...days.map(d=>[d.date,`${d.date} Dec · ${d.label}`])]){const o=node('option',text);o.value=value;select.append(o);}select.value=draft.day;select.dataset.importField='day';wrap.append(select);row.append(wrap);
   const include=node('label','Include this item'),check=node('input');check.type='checkbox';check.checked=true;check.dataset.importInclude='';include.prepend(check);row.append(include);form.append(row);
  });
  const save=node('button','Add reviewed items','button primary');save.type='submit';form.append(save);
  form.addEventListener('submit',e=>{
   e.preventDefault();try{
    const drafts=[...form.querySelectorAll('fieldset')].filter(row=>row.querySelector('[data-import-include]').checked).map(row=>Object.fromEntries([...row.querySelectorAll('[data-import-field]')].map(input=>[input.dataset.importField,input.value])));
    if(!drafts.length)throw new Error('Include at least one item.');
    mutate(next=>{for(const d of drafts){const item={title:d.title,query:d.location,source:C.url(d.source),note:d.note||''};if(!d.day)next.companion.ideas.push({id:uid('idea'),...item});else {const day=next.days.find(day=>day.date===Number(d.day));if(!day)throw new Error('Choose a trip day.');day.events.push({id:uid('event'),...item,location:d.location,time:d.time,type:'pin',status:'proposed'});}}},`${drafts.length} reviewed item${drafts.length===1?'':'s'} added.`);
    importDraft=[];render();feedback('Import complete. Review exact times in the event editor when you have them.');
   }catch(error){feedback(error.message);}
  });host.append(form);
 }
 function exportCalendar(ids = null) {
  const result=C.calendar(days,ids);if(!result.count){feedback('Select at least one activity.');return;}
  download('la-trip-calendar.ics',result.content,'text/calendar;charset=utf-8');editor.announce(`Calendar download started: ${result.count} activities, ${result.floating} without exact times exported as all-day reminders.`);
 }
 function renderCalendar() {
  heading('A place in your calendar','Download an .ics file for Apple Calendar, Google Calendar or Outlook. This is a one-time export, not calendar sync.');
  content.append(node('p','Exact times are exported as the correct UTC instant, including flights across timezones. Flexible or unconfirmed times become all-day reminders. Reimporting can create duplicates in some calendar apps.','small-note'));
  const list=node('div',undefined,'calendar-checks');
  for(const day of days){const section=node('fieldset');section.append(node('legend',`${day.date} December · ${day.label}`));for(const event of day.events){const label=node('label'),input=node('input');input.type='checkbox';input.checked=true;input.value=event.id;input.dataset.calendarId=event.id;label.append(input,node('span',`${event.title} · ${event.schedule?.start?C.displayTime(event):'All-day reminder'}`));section.append(label);}list.append(section);}
  content.append(toolbar(button('Export whole trip',()=>exportCalendar()),button('Export selected',()=>exportCalendar([...content.querySelectorAll('[data-calendar-id]:checked')].map(el=>el.value))),button('Select none',()=>content.querySelectorAll('[data-calendar-id]').forEach(el=>el.checked=false))));content.append(list);
 }
 function renderNow() {
  const host=$('#trip-now');host.replaceChildren();const today=C.wallTime(Date.now(),C.ZONE).slice(0,10),data=state().companion;
  const pre=C.wallTime(Date.now(),'Australia/Melbourne').slice(0,10)<'2026-12-20',post=today>'2026-12-28',next=C.upcoming(days);
  const label=pre?'ON THE HORIZON':post?'BACK FROM CALIFORNIA':'UP NEXT';host.append(node('p',label,'eyebrow'));
  if(pre){const melToday=C.wallTime(Date.now(),'Australia/Melbourne').slice(0,10),count=Math.max(0,Math.round((Date.parse('2026-12-20')-Date.parse(melToday))/86400000));host.append(node('h3',`${count} days until California`),node('p',`${data.tasks.filter(t=>!t.done).length} planning tasks open · ${days.flatMap(d=>d.events).filter(e=>e.status==='proposed').length} proposed activities`));host.append(button('Plan the details',()=>openTools('ideas'),'text-link'));}
  else if(next&&!post){const s=next.event.schedule,ongoing=next.at<Date.now();host.append(node('h3',next.event.title),node('p',`${ongoing?'Under way · ':''}${C.displayTime(next.event)}`));const actions=toolbar(button('View activity',()=>{showView('itinerary');selectDay(days.indexOf(next.day),true);const target=$(`[data-edit-event="${next.event.id}"]`);target?.focus({preventScroll:true});tripScroll(target);}));if(destination(next.event))actions.append(link('Directions ↗',mapLinkUrl(destination(next.event),'directions')));host.append(actions);}
  else {host.append(node('h3',post?'Keep the good memories':'A little room to wander'),node('p',post?'Your itinerary, documents and expense records are still here.':'No more timed activities are set. Flexible plans are still in your day’s itinerary.'));}
 }
 function renderDay() {
  const day=days[selectedDay],stops=day.events.filter(e=>destination(e)).map(e=>({event:e,query:destination(e)}));
  const host=$('#day-stops');host.replaceChildren();
  if(stops.length){const rail=node('div',undefined,'day-stop-rail');rail.setAttribute('aria-label','Stops in itinerary order');stops.forEach((stop,i)=>{const b=button(`${i+1}. ${stop.event.title}`,()=>{renderMapCard('#day-map',{id:stop.event.id,name:stop.event.title,full:stop.event.title,query:stop.query});$('#day-map-name').textContent=stop.event.title;$('#day-map-area').textContent='Selected activity';},'stop-chip');rail.append(b);});host.append(rail);
   const unique=stops.filter((s,i)=>i===0||s.query!==stops[i-1].query);
   if(unique.length>1){const routes=node('div',undefined,'day-routes');for(let i=0;i<unique.length-1;i+=4){const segment=unique.slice(i,i+5);try{routes.append(link(`${unique.length>5?`Stops ${i+1}–${i+segment.length}`:'Day route'} in Google Maps ↗`,C.routeUrl(segment.map(s=>s.query))));}catch(error){routes.append(node('p',error.message,'small-note'));}}host.append(routes);
    if(mapKey&&unique.length<=22){const params=new URLSearchParams({key:mapKey,origin:unique[0].query,destination:unique.at(-1).query,mode:'driving'});if(unique.length>2)params.set('waypoints',unique.slice(1,-1).map(s=>s.query).join('|'));$('#day-map').src='https://www.google.com/maps/embed/v1/directions?'+params;$('#day-map').title='Google Maps route in itinerary order';$('#day-map').hidden=false;$('#day-map-name').textContent='The day’s route';$('#day-map-area').textContent='Driving route · check each travel leg';}
   }
   host.append(node('p',mapKey?'Tap a stop to focus its map. Route mode is driving; individual directions use your travel mode.':'Tap a stop to see its Google map. Day routes open all stops in Google Maps.','small-note'));
  }
  day.events.forEach((event,index)=>{
   const host=document.querySelector(`[data-event-travel="${event.id}"]`);if(!host)return;host.replaceChildren();const s=event.schedule,previous=day.events[index-1];
   if(s?.start&&s.end){const minutes=Math.round((C.instant(s.end,s.endZone)-C.instant(s.start,s.zone))/60000);host.append(node('p',`Duration: ${Math.floor(minutes/60)}h ${minutes%60}m`,'small-note'));}
   if(s?.end)host.append(node('p',`Ends / arrives: ${new Intl.DateTimeFormat('en-AU',{timeZone:s.endZone,day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(C.instant(s.end,s.endZone))}`,'small-note'));
   if(s?.travel!==null&&s?.travel!==undefined)host.append(node('p',`${s.travel} min travel estimate · ${s.buffer} min arrival buffer`,'small-note'));
   if(s?.start&&s.travel!==null){const leave=C.instant(s.start,s.zone)-(s.travel+s.buffer)*60000;host.append(node('p',`Leave by ${new Intl.DateTimeFormat('en-AU',{timeZone:s.zone,day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(leave)} · based on your estimate`,'small-note'));}
   if(s?.flight)host.append(node('p',`${s.flight} · ${s.departure||'Departure airport to add'} → ${s.arrival||'Arrival airport to add'}${s.terminal?' · '+s.terminal:''}`,'small-note'));
   const warning=C.timingWarning(previous,event);if(warning)host.append(node('p',warning,'travel-warning'));
   if(previous&&destination(previous)&&destination(event)) {const url=new URL(mapLinkUrl(destination(event),'directions',destination(previous)));if(mapProvider==='google')url.searchParams.set('travelmode',s?.mode||'driving');else url.searchParams.set('dirflg',s?.mode==='walking'?'w':s?.mode==='transit'?'r':'d');host.append(link(`From previous activity in ${mapProviderName()} ↗`,url.href));}
  });
 }
 async function completeBackup() {
  try {const documents=await files.all(); const plan=state();const backup={format:'mario-la-complete',version:1,exportedAt:new Date().toISOString(),plan,documents,packing:packing.map(p=>({...p})),mapProvider};const json=JSON.stringify(backup);if(new Blob([json]).size>32*1024*1024)throw new Error('This combined file exceeds 32 MB. Use an itinerary-only backup and download documents individually.');download('la-trip-complete-backup.json',json,'application/json');feedback('Complete backup downloaded, including documents. Keep it private.');}
  catch(e){feedback(`Complete backup failed: ${e.message} The itinerary-only backup is still available.`);}
 }
 function validateFullBackup(data) {
  if(data?.format!=='mario-la-complete'||data.version!==1)throw new Error('Choose a complete LA trip backup.');
  const plan=editor.validate(data.plan);if(plan.days.length!==9)throw new Error('The backup must contain all nine days.');
  const documents=files.validateList(data.documents);
  if(!['google','apple'].includes(data.mapProvider)||!Array.isArray(data.packing)||data.packing.length>122)throw new Error('Invalid packing or map preference.');
  const ids=new Set();const checked=data.packing.map(p=>{C.id(p.id);C.text(p.label,100,true);if(ids.has(p.id)||typeof p.checked!=='boolean')throw new Error('Invalid packing item.');ids.add(p.id);const base=defaultPacking.find(x=>x.id===p.id);if(!base&&(!p.id.startsWith('custom-')||p.custom!==true))throw new Error('Unknown packing item.');return base?{...base,checked:p.checked}:{id:p.id,label:p.label,checked:p.checked,custom:true,group:'Your additions'};});
  if(defaultPacking.some(p=>!ids.has(p.id)))throw new Error('The backup is missing packing essentials.');
  return {plan:{...data.plan,...plan},documents,packing:checked,mapProvider:data.mapProvider};
 }
 async function importFull(file) {
  try {
   if(file.size>32*1024*1024)throw new Error('Choose a complete backup smaller than 32 MB.');
   importReview=validateFullBackup(JSON.parse(await file.text()));
   const count=importReview.plan.days.reduce((sum,d)=>sum+d.events.length,0);
   modal('Restore a complete backup',()=>{
    const details=node('div',undefined,'full-field');details.append(node('p',`${count} activities · ${importReview.plan.companion.expenses.length} expenses · ${importReview.documents.length} documents`));
    details.append(node('p','Replaces this device’s plan, ideas, expenses, tasks, packing checks and map preference. Documents are merged; existing files are kept. Trip changes can be undone; packing and preferences cannot. Download a complete backup first if you need the current copy.'));$('#travel-fields').append(details);
   },async()=>{
    editor.assertCurrent();const restored=importReview;
    await files.merge(restored.documents);
    // A tab may have saved while IndexedDB was busy. Never overwrite its plan.
    try{editor.replace(restored.plan,'Complete trip backup restored.');}catch(e){await refreshDocuments();throw new Error(`${e.message} Documents were added safely, but the plan and packing have not changed.`);}
    packing=restored.packing;savePacking();renderPacking();chooseMapProvider(restored.mapProvider);await refreshDocuments();importReview=null;
    feedback(`Backup restored.${!storageAvailable?' Packing could not be saved beyond this visit.':''}`);
   });$('#travel-save').textContent='Restore backup';
  } catch(e){feedback(`${e instanceof SyntaxError?'That file is not valid JSON.':e.message} Your plan has not changed.`);}
 }
 function mapSettings() {
  modal('Google route map',()=>{
   $('#travel-fields').append(node('p','Optional: to show a multi-stop route inside the site, add a Google Maps Embed browser key restricted to this website and to Maps Embed API. It stays on this device and is excluded from backups. Ordinary Google maps and directions work without it.','small-note full-field'));
   field('key','Restricted browser key',mapKey,{max:150,full:true});
   $('#travel-fields').append(link('Google setup & restrictions ↗','https://developers.google.com/maps/documentation/embed/get-api-key'));
  },data=>{const value=data.get('key').trim();if(value&&!/^[\w-]{20,150}$/.test(value))throw new Error('Check your Google Maps browser key.');try{localStorage.setItem('mario-la-dec2026-embed-key',value);}catch{throw new Error('This browser cannot save the key.');}mapKey=value;selectDay(selectedDay);renderDay();feedback(value?'Google route maps enabled on this device.':'Route key removed; ordinary place maps remain available.');});
 }
 async function loadWeather(city) {
  if(weatherPending)return;weatherPending=true;const selected=city==='sf'?{lat:37.7749,lon:-122.4194,name:'San Francisco'}:{lat:34.0522,lon:-118.2437,name:'Los Angeles'};
  const today=C.wallTime(Date.now(),C.ZONE).slice(0,10),last=new Date(Date.parse(today)+15*86400000).toISOString().slice(0,10);
  if(last<'2026-12-20'||today>'2026-12-28'){weather={message:today>'2026-12-28'?'The trip dates are in the past. This tool shows forecasts, not historical weather.':'Trip forecasts are not available for these dates yet. Open-Meteo forecasts reach up to 16 days ahead.',city:selected.name};weatherPending=false;render();return;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
   render();const params=new URLSearchParams({latitude:selected.lat,longitude:selected.lon,daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max',timezone:C.ZONE,forecast_days:16});
   const response=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('Weather service is unavailable.');const data=await response.json();
   const daily=data.daily;if(!daily||!Array.isArray(daily.time)||daily.time.length>16)throw new Error('Weather service returned an unexpected forecast.');
   const rows=daily.time.map((date,i)=>({date,high:daily.temperature_2m_max?.[i],low:daily.temperature_2m_min?.[i],rain:daily.precipitation_probability_max?.[i]})).filter(r=>r.date>='2026-12-20'&&r.date<='2026-12-28'&&[r.high,r.low,r.rain].every(Number.isFinite));
   weather={rows,city:selected.name,at:new Date().toISOString()};if(!rows.length)weather.message='No forecast is available for your trip dates yet.';
  }catch(e){weather={message:navigator.onLine?'Could not load the forecast. Try again later.':'You’re offline. Weather needs a connection.',city:selected.name};}finally{clearTimeout(timer);weatherPending=false;if(tool==='travel')render();}
 }
 async function offline() {
  if(!('serviceWorker' in navigator)||!window.isSecureContext){feedback('Offline saving needs HTTPS or localhost and a browser with service workers.');return;}
  try{feedback('Saving the trip app for offline use…');const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});await registration.update();
   const worker = registration.installing || registration.waiting;
   if(worker && worker.state !== 'installed' && worker.state !== 'activated') await new Promise((resolve,reject)=>{worker.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated')resolve();if(worker.state==='redundant')reject(new Error('Offline installation failed.'));});});
   if(registration.waiting) registration.waiting.postMessage('activate-update');
   await navigator.serviceWorker.ready;offlineStatus='The trip app is saved for offline use on this device. Maps, websites and fresh weather still need a connection.';feedback(offlineStatus);if(tool==='travel')render();}catch(e){feedback('Offline saving could not finish. Keep the page open and retry with a connection.');}
 }
 function renderTravel() {
  heading('Ready for the journey','Keep a backup, check the forecast and have the useful details close by.');
  const backup=node('section',undefined,'tool-card');backup.append(node('h4','Back up or move everything'),node('p','A private file with your plan, ideas, expenses, documents and packing checks. Use it to move a copy to another device. This does not create a shared, live plan.'));
  const input=node('input');input.type='file';input.accept='.json,application/json';input.id='complete-backup-input';input.addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';if(file)importFull(file);});const label=node('label','Import complete backup','file-control');label.htmlFor=input.id;label.append(input);
  backup.append(toolbar(button('Download complete backup',completeBackup),label,button('Itinerary-only backup',()=>$('#export-itinerary').click())));content.append(backup);
  const offlineCard=card('Take it offline',offlineStatus);offlineCard.append(button('Save / update offline copy',offline));offlineCard.append(node('p','Open the app once online, save the copy, then keep the same browser. Your documents and edits stay in browser storage. Saving offline is not a backup.','small-note'));content.append(offlineCard);
  const weatherCard=card('A little weather check','Trip dates only · forecast range up to 16 days');weatherCard.append(toolbar(button(weatherPending?'Loading forecast…':'Los Angeles forecast',()=>loadWeather('la')),button('San Francisco forecast',()=>loadWeather('sf'))));
  if(weather){weatherCard.append(node('p',weather.city));if(weather.message)weatherCard.append(node('p',weather.message,'small-note'));for(const row of weather.rows||[])weatherCard.append(node('p',`${row.date}: ${row.low}–${row.high} °C · rain ${row.rain}%`));if(weather.at)weatherCard.append(node('p',`Retrieved ${new Date(weather.at).toLocaleString()}`,'small-note'));}weatherCard.append(link('Weather data by Open-Meteo ↗','https://open-meteo.com/'));content.append(weatherCard);
  const flights=card('Check your flights','Live status and alerts are not connected. The airline’s status page is the source for gates and delays.');
  for(const event of days.flatMap(d=>d.events).filter(e=>e.schedule?.flight)){
   const number=event.schedule.flight.toUpperCase();const row=node('div',undefined,'flight-row');row.append(node('p',`${number} · ${event.schedule.start?C.displayTime(event):'Departure time to add'}`),button('Edit flight details',()=>editor.editEvent(event.id),'edit-event'));
   if(number.startsWith('UA'))row.append(link('United flight status ↗','https://www.united.com/en/us/flightstatus'));
   if(number.startsWith('DL'))row.append(link('Delta flight status ↗','https://www.delta.com/flightstatus/search'));
   flights.append(row);
  }content.append(flights);
  const routes=card('Your maps, your way','Google maps stay embedded. External directions follow your Google / Apple choice.');routes.append(button('Optional Google route map setup',mapSettings));content.append(routes);
 }
 function render() {
  // Do not destroy a draft while typing. Changes from the editor only re-render the active tool.
  
  content.replaceChildren();({ideas:renderIdeas,expenses:renderExpenses,documents:renderDocuments,import:renderImport,calendar:renderCalendar,travel:renderTravel}[tool]||renderIdeas)();
 }
 document.addEventListener('click',e=>{
  const docs=e.target.closest('button[data-event-docs]');if(docs){documentFilter=docs.dataset.eventDocs;openTools('documents');refreshDocuments();}
  const cal=e.target.closest('button[data-event-calendar]');if(cal)exportCalendar([cal.dataset.eventCalendar]);
  if(e.target.closest('button[data-map-provider]')){renderDay();if(tool==='ideas')render();}
 });
 window.addEventListener('trip:day',()=>{renderDay();renderNow();});
 window.addEventListener('trip:change',()=>{renderDay();renderNow();render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderNow();refreshDocuments();}});
 window.addEventListener('pageshow',renderNow);
 // One inexpensive update per minute while visible; never on an input path.
 setInterval(()=>{if(!document.hidden)renderNow();},60000);
 if('serviceWorker' in navigator) navigator.serviceWorker.getRegistration(new URL('./',location.href)).then(reg=>{if(reg?.active){offlineStatus='An offline copy is saved on this device. Use Save / update before leaving.';if(tool==='travel')render();}}).catch(()=>{});
 renderNow();renderDay();render();refreshDocuments();
})();
