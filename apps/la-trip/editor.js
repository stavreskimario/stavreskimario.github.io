'use strict';

// Device-local itinerary editing. No credentials or server writes are involved.
(() => {
 const key = 'mario-la-dec2026-itinerary-v1';
 const trip = 'la-december-2026';
 const clone = value => JSON.parse(JSON.stringify(value));
 const defaults = clone(days), defaultPlaces = clone(places), defaultBookings = clone(reservations);
 const types = {plane:'Flight',car:'Transport',hotel:'Hotel',ball:'Game',film:'Studio / film',sun:'Explore',coffee:'Food & drink',bag:'Shopping / packing',pin:'Place',ticket:'Tickets',calendar:'Event',moon:'Evening',spark:'Highlight',users:'Meet up',route:'Journey',clock:'Reminder'};
 const dialog = $('#itinerary-editor'), form = $('#itinerary-form');
 let overrides = [], previous = null, editor = null, imported = null;
 let storedRaw = null, storageReadable = true, saved = true, loadIssue = '';
 let returnFocus = null;

 function string(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Check ${label}${required ? ' — it cannot be empty' : ''}.`);
  return value.trim();
 }
 function website(value) {
  const clean = string(value || '', 2000, 'the website');
  if (!clean) return '';
  let url;
  try { url = new URL(clean); } catch { throw new Error('Enter a full website address starting with https:// or http://.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http:// or https:// website without login details.');
  return url.href;
 }
 function validEvent(value, mapRecords = places, bookingRecords = reservations) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid event in the backup.');
  if (typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)) throw new Error('Invalid event identifier.');
  if (!Object.hasOwn(statuses, value.status) || !Object.hasOwn(types, value.type)) throw new Error('Choose a valid event status and icon.');
  if (value.map && !mapRecords.some(p => p.id === value.map)) throw new Error('Choose a saved map location.');
  if (value.reservation && !bookingRecords.some(r => r.id === value.reservation)) throw new Error('Choose a linked booking record.');
  if (value.highlight !== undefined && typeof value.highlight !== 'boolean') throw new Error('Invalid highlight setting.');
  return {id:value.id, title:string(value.title,160,'the event name',true), time:string(value.time ?? '',160,'the time'), location:string(value.location ?? '',240,'the location'), note:string(value.note ?? '',5000,'the notes'), status:value.status, type:value.type, map:value.map || '', query:string(value.query ?? '',500,'the custom map destination'), source:website(value.source), reservation:value.reservation || '', highlight:value.highlight === true};
 }
 function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('Invalid record identifier.');
  return value;
 }
 function validPlace(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid location.');
  const result = {id:identifier(value.id)};
  for(const [field,max,required] of [['name',160,true],['full',240,false],['area',240,false],['address',500,false],['category',240,false],['query',500,true]]) result[field]=string(value[field] ?? '',max,`location ${field}`,required);
  result.full ||= result.name;
  result.source=website(value.source);
  result.day=value.day ?? null;
  if(result.day!==null&&!defaults.some(d=>d.date===result.day))throw new Error('Choose a valid linked trip day.');
  return result;
 }
 function validBooking(value,mapRecords=places) {
  if(!value||typeof value!=='object')throw new Error('Invalid booking.');
  if(!Object.hasOwn(statuses,value.status)||!Object.hasOwn(types,value.icon))throw new Error('Choose a valid booking status and icon.');
  if(!Array.isArray(value.details)||value.details.length>40)throw new Error('Use up to 40 booking fields.');
  const details=value.details.map(pair=>{
   if(!Array.isArray(pair)||pair.length!==2)throw new Error('Each booking field needs a label and a value.');
   return [string(pair[0],100,'the booking field label',true),string(pair[1],2000,'the booking field value')];
  });
  const map=value.map||'';
  if(map&&!mapRecords.some(p=>p.id===map))throw new Error('Choose a saved location for this booking.');
  return {id:identifier(value.id),title:string(value.title,160,'the booking name',true),subtitle:string(value.subtitle??'',300,'the booking summary'),status:value.status,icon:value.icon,details,note:string(value.note??'',5000,'the booking notes'),map,source:website(value.source)};
 }
 function records(list,validate,label) {
  if(!Array.isArray(list)||list.length>200)throw new Error(`Use up to 200 ${label}.`);
  const seen=new Set();return list.map(value=>{const result=validate(value);if(seen.has(result.id))throw new Error(`Duplicate ${label} identifier.`);seen.add(result.id);return result;});
 }
 function validBackup(data) {
  if (!data || ![1,2].includes(data.version) || data.trip !== trip || !Array.isArray(data.days) || data.days.length > defaults.length) throw new Error('Choose a valid LA trip backup (version 1 or 2).');
  const mapRecords=records(data.version===1?defaultPlaces:data.places,validPlace,'locations');
  const bookingRecords=records(data.version===1?defaultBookings:data.reservations,value=>validBooking(value,mapRecords),'bookings');
  const dates = new Set();
  const dayRecords = data.days.map(record => {
   const base = defaults.find(d => d.date === record?.date);
   if (!base || dates.has(record.date) || !Array.isArray(record.events) || record.events.length > 200) throw new Error('The backup has an invalid day or too many events (maximum 200 per day).');
   dates.add(record.date);
   const clean = {date:record.date, events:record.events.map(value=>validEvent(value,mapRecords,bookingRecords))};
   for (const [field,max,required] of [['title',160,true],['label',50,true],['description',3000,false],['noteTitle',160,false],['note',5000,false]]) clean[field] = string(record[field] ?? base[field],max,`the day’s ${field}`,required);
   clean.map = record.map ?? base.map;
   if (clean.map&&!mapRecords.some(p => p.id === clean.map)) throw new Error('Invalid day map.');
   return clean;
  });
  const ids = new Set();
  for (const day of defaults) {
   const current=dayRecords.find(r=>r.date===day.date)||day;
   if(current.map&&!mapRecords.some(p=>p.id===current.map))throw new Error('A day links to a missing location.');
   for(const event of current.events){
    validEvent(event,mapRecords,bookingRecords);
    if(ids.has(event.id))throw new Error('The backup contains duplicate events.');
    ids.add(event.id);
   }
  }
  return {days:dayRecords,places:mapRecords,reservations:bookingRecords};
 }
 const payload = (records,collections={places,reservations}) => ({version:2,trip,days:records,places:clone(collections.places),reservations:clone(collections.reservations)});
 function dayRecord(day) {
  const {date,title,label,description,noteTitle,note,map,events} = day;
  return clone({date,title,label,description,noteTitle,note,map,events});
 }
 function apply(state) {
  places.splice(0,places.length,...clone(state.places));
  reservations.splice(0,reservations.length,...clone(state.reservations));
  days.forEach((day,i) => Object.assign(day,clone(defaults[i]),clone(state.days.find(r => r.date === day.date) || {})));
  selectDay(selectedDay);renderReservations();renderReservationPeek();renderPlaces();renderPlacesPeek();
  selectPlace(place(selectedPlace)?selectedPlace:places[0]?.id);
  refreshOptions();refreshMapPreference();
 }
 function storageNotice() {
  document.querySelectorAll('[data-trip-storage]').forEach(el=>el.textContent=loadIssue||(saved?'Trip edits save in this browser on this device. Use a backup to move them.':'Changes are kept for this visit only. Saving is unavailable — download a backup before leaving.'));
 }
 function announce(message) { document.querySelectorAll('[data-trip-feedback]').forEach(el=>el.textContent=message); }
 function undoVisible(visible) { document.querySelectorAll('[data-undo-trip]').forEach(el=>el.hidden=!visible); }
 function isCurrent() {
  if (!storageReadable) return true;
  try {
   if (localStorage.getItem(key) !== storedRaw) throw new Error('Your plan changed in another tab. Download a backup of this tab, then reload before saving more changes.');
  } catch (error) {
   if (error.message.startsWith('Your plan changed')) throw error;
   storageReadable = false;
  }
  return true;
 }
 function save() {
  const raw = JSON.stringify(payload(overrides));
  try { localStorage.setItem(key,raw); storedRaw = raw; storageReadable = true; saved = true; loadIssue = ''; }
  catch { saved = false; loadIssue = ''; }
  storageNotice();
 }
 function commit(records, message, dayIndex = selectedDay, collections = {places,reservations}) {
  isCurrent();
  const next = validBackup(payload(records,collections));
  previous = payload(overrides);
  overrides = next.days;
  selectedDay = dayIndex;
  apply(next);
  save();
  undoVisible(true);
  announce(message + (saved ? ' Saved on this device.' : ' Download a backup to keep it.'));
 }
 function withDays(updated) {
  return [...overrides.filter(d => !updated.some(u => u.date === d.date)), ...updated].sort((a,b) => a.date-b.date);
 }
 function error(message, control) {
  $('#editor-error').textContent = message;
  if (control) { const details = control.closest('details'); if (details) details.open = true; control.setAttribute('aria-invalid','true'); control.focus(); }
 }
 function options(select, entries, blank) {
  select.replaceChildren();
  if (blank) entries = [['',blank], ...entries];
  entries.forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); });
 }
 function refreshOptions(){
  const placeOptions=places.map(p=>[p.id,p.full]);
  options($('#event-map'),placeOptions,'No saved map');
  options($('#edit-day-map'),placeOptions,'No day map');
  options($('#booking-map'),placeOptions,'No linked location');
  options($('#event-reservation'),reservations.map(r=>[r.id,r.title]),'No linked booking');
 }
 options($('#event-type'),Object.entries(types));options($('#booking-icon'),Object.entries(types));
 options($('#event-day'),days.map((d,i)=>[String(i),`${d.weekday} ${d.date} December`]));
 options($('#location-day'),days.map(d=>[String(d.date),`${d.weekday} ${d.date} December`]),'No linked day');
 function positions(preferred) {
  const dest = days[Number($('#event-day').value)];
  const count = dest.events.filter(e => e.id !== editor?.id).length;
  options($('#event-position'),Array.from({length:count+1},(_,i) => [String(i),i === count ? `${i+1} · Last` : `${i+1} · Before ${dest.events.filter(e=>e.id!==editor?.id)[i].title}`]));
  $('#event-position').value = String(Math.min(preferred ?? count,count));
 }
 function showEditor(mode, trigger) {
  returnFocus = trigger || document.activeElement;
  $('#editor-error').textContent = '';
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  for (const [id,enabled] of [['event-fields',mode==='event'],['day-fields',mode==='day'],['booking-fields',mode==='booking'],['location-fields',mode==='location']]) { $('#'+id).hidden = !enabled; $('#'+id).disabled = !enabled; }
  $('#import-preview').hidden = mode !== 'import';
  $('#remove-event').hidden = !['event','booking','location'].includes(mode) || !editor.id;
  $('#remove-event').textContent = `Remove ${mode}`;
  $('#record-remove-note').hidden=!editor.id||!['booking','location'].includes(mode);
  $('#record-remove-note').textContent=mode==='booking'?'Removing this record clears its links from events. The events stay in your plan. You can undo the removal.':'Removing this location clears linked day maps and booking links. Event directions are kept as custom destinations. You can undo the removal.';
  $('#editor-context').textContent = mode==='booking'?'YOUR BOOKING RECORD':mode==='location'?'YOUR SAVED LOCATION':`${days[selectedDay].weekday} ${days[selectedDay].date} December · your plan`;
  dialog.showModal();
 }
 function closeEditor(focusId) {
  const mode=editor?.mode, id=focusId||editor?.id;
  dialog.close();editor=null;imported=null;
  const selector=mode==='booking'?'data-edit-booking':mode==='location'?'data-edit-location':'data-edit-event';
  const target=id?document.querySelector(`[${selector}="${id}"]`):returnFocus;
  const fallback=document.body.dataset.view==='reservations'?$('#add-booking'):document.body.dataset.view==='maps'?$('#add-location'):$('#add-event');
  (target?.isConnected?target:returnFocus?.isConnected?returnFocus:fallback).focus({preventScroll:true});
 }
 function openEvent(id,trigger) {
  const day = days[selectedDay], existing = day.events.find(e => e.id === id);
  if (id && !existing) return;
  editor = {mode:'event', id:existing?.id || '', dayIndex:selectedDay};
  const event = existing || {title:'',time:'',location:'',note:'',status:'proposed',type:'pin',map:'',query:'',source:'',reservation:'',highlight:false};
  for (const field of ['title','time','location','note','status','type','map','query','source','reservation']) $('#event-'+field).value = event[field] || '';
  $('#event-highlight').checked = event.highlight === true;
  $('#event-day').value = String(selectedDay);
  positions(existing ? day.events.indexOf(existing) : undefined);
  $('#event-extras').open = false;
  $('#editor-title').textContent = existing ? 'Edit event' : 'Add an event';
  $('#save-event').textContent = existing ? 'Save event' : 'Add event';
  showEditor('event',trigger);
  $('#event-title').focus();
 }
 function openDay() {
  editor = {mode:'day',dayIndex:selectedDay};
  for (const [field,input] of [['title','title'],['label','label'],['map','map'],['description','description'],['noteTitle','note-title'],['note','note']]) $('#edit-day-'+input).value = days[selectedDay][field];
  $('#editor-title').textContent = 'Edit this day'; $('#save-event').textContent = 'Save day';
  showEditor('day',$('#edit-day')); $('#edit-day-title').focus();
 }
 function newId(){return `custom-${crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}`;}
 function addDetail(label='',value=''){
  if($('#booking-detail-rows').children.length>=40){$('#booking-field-feedback').textContent='Use up to 40 fields.';return;}
  const row=document.createElement('div');row.className='booking-field-row';
  const id=newId();
  for(const [kind,text,content,max] of [['label','Field name',label,100],['value','Value',value,2000]]){
   const wrapper=document.createElement('label');wrapper.htmlFor=id+'-'+kind;wrapper.textContent=text;
   const input=document.createElement('input');input.id=id+'-'+kind;input.setAttribute('data-detail-'+kind,'');input.maxLength=max;input.value=content;if(kind==='label')input.required=true;
   wrapper.append(input);row.append(wrapper);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='edit-event';remove.textContent='Remove field';remove.setAttribute('aria-label','Remove booking field');
  remove.addEventListener('click',()=>{row.remove();$('#add-booking-detail').focus();$('#booking-field-feedback').textContent='Field removed from this draft. Cancel to discard draft changes.';});row.append(remove);
  $('#booking-detail-rows').append(row);return row;
 }
 function openRecord(mode,id,trigger){
  const current=(mode==='booking'?reservations:places).find(r=>r.id===id);if(id&&!current)return;
  editor={mode,id:current?.id||''};
  if(mode==='booking'){
   const value=current||{title:'',subtitle:'',status:'proposed',icon:'ticket',map:'',source:'',note:'',details:[]};
   for(const field of ['title','subtitle','status','icon','map','source','note'])$('#booking-'+field).value=value[field]||'';
   $('#booking-detail-rows').replaceChildren();value.details.forEach(([k,v])=>addDetail(k,v));$('#booking-field-feedback').textContent='';
  }else{
   const value=current||{name:'',full:'',area:'',address:'',category:'',query:'',source:'',day:null};
   for(const field of ['name','full','area','address','category','query','source'])$('#location-'+field).value=value[field]||'';
   $('#location-day').value=value.day?String(value.day):'';
  }
  $('#editor-title').textContent=(current?'Edit ':'Add ')+mode;$('#save-event').textContent=(current?'Save ':'Add ')+mode;
  showEditor(mode,trigger);$('#'+(mode==='booking'?'booking-title':'location-name')).focus();
 }
 $('#add-booking-detail').addEventListener('click',()=>addDetail()?.querySelector('input').focus());
 $('#add-booking').addEventListener('click',e=>openRecord('booking','',e.currentTarget));
 $('#add-location').addEventListener('click',e=>openRecord('location','',e.currentTarget));
 document.addEventListener('click',e=>{
  const booking=e.target.closest('button[data-edit-booking]');if(booking){openRecord('booking',booking.dataset.editBooking,booking);return;}
  const location=e.target.closest('button[data-edit-location]');if(location){openRecord('location',location.dataset.editLocation,location);return;}
  if(e.target.closest('button[data-open-backup]')){showView('itinerary');const backup=$('.itinerary-backup');backup.open=true;backup.querySelector('summary').focus();tripScroll(backup);}
 });
 function validateInput(input) {
  let message = '';
  if (input.required && !input.value.trim()) message = 'Please enter a name or title.';
  if (['event-source','booking-source','location-source'].includes(input.id)) { try { website(input.value); } catch(e) { message = e.message; } }
  input.setCustomValidity(message);
  if (message) input.setAttribute('aria-invalid','true'); else input.removeAttribute('aria-invalid');
  return message;
 }
 form.addEventListener('input', e => {
  if (e.target.matches('input,textarea')) validateInput(e.target);
  $('#editor-error').textContent = '';
 });
 form.addEventListener('focusout',e => {
  if (e.target.matches('input,textarea')) { const message = validateInput(e.target); if (message) $('#editor-error').textContent = message; }
 });
 $('#event-day').addEventListener('change',() => positions());
 $('#add-event').addEventListener('click',e => openEvent('',e.currentTarget));
 $('#edit-day').addEventListener('click',openDay);
 $('#timeline').addEventListener('click',e => { const button = e.target.closest('button[data-edit-event]'); if (button) openEvent(button.dataset.editEvent,button); });
 $('#cancel-editor').addEventListener('click',() => closeEditor());
 $('#close-editor').addEventListener('click',() => closeEditor());
 dialog.addEventListener('cancel',e => { e.preventDefault(); closeEditor(); });
 form.addEventListener('submit',e => {
  e.preventDefault();
  try {
   if (editor.mode === 'import') {
    commit(imported.days,'Trip backup imported.',selectedDay,imported); closeEditor(); return;
   }
   const active = $('#'+editor.mode+'-fields');
   for (const input of active.querySelectorAll('input,textarea')) {
    const message = validateInput(input);
    if (message || !input.checkValidity()) { error(message || 'Check this field.',input); return; }
   }
   if(editor.mode==='booking'||editor.mode==='location'){
    const mode=editor.mode,draft={id:editor.id||newId()};
    if(mode==='booking'){
     for(const field of ['title','subtitle','status','icon','map','source','note'])draft[field]=$('#booking-'+field).value;
     draft.details=[...document.querySelectorAll('.booking-field-row')].map(row=>[row.querySelector('[data-detail-label]').value,row.querySelector('[data-detail-value]').value]);
    }else{
     for(const field of ['name','full','area','address','category','query','source'])draft[field]=$('#location-'+field).value;
     draft.day=$('#location-day').value?Number($('#location-day').value):null;
    }
    const next=mode==='booking'?validBooking(draft):validPlace(draft);
    const collection=clone(mode==='booking'?reservations:places),index=collection.findIndex(r=>r.id===editor.id);
    if(index<0)collection.push(next);else collection[index]=next;
    commit(overrides,`${mode==='booking'?'Booking':'Location'} ${editor.id?'updated':'added'}.`,selectedDay,mode==='booking'?{places,reservations:collection}:{places:collection,reservations});
    if(mode==='location')selectPlace(next.id);
    closeEditor(next.id);return;
   }
   if (editor.mode === 'day') {
    const next = dayRecord(days[editor.dayIndex]);
    for (const [field,input] of [['title','title'],['label','label'],['map','map'],['description','description'],['noteTitle','note-title'],['note','note']]) next[field] = $('#edit-day-'+input).value.trim();
    commit(withDays([next]),'Day updated.',editor.dayIndex); closeEditor(); return;
   }
   const destination = Number($('#event-day').value), position = Number($('#event-position').value);
   if (!Number.isInteger(destination) || !days[destination]) throw new Error('Choose a day.');
   const draft = {id:editor.id || `custom-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2)}`,highlight:$('#event-highlight').checked};
   for (const field of ['title','time','location','note','status','type','map','query','source','reservation']) draft[field] = $('#event-'+field).value;
   const event = validEvent(draft);
   const origin = dayRecord(days[editor.dayIndex]), target = destination === editor.dayIndex ? origin : dayRecord(days[destination]);
   origin.events = origin.events.filter(e => e.id !== editor.id);
   if (target.events.length >= 200) throw new Error('This day is full (200 events). Move or remove an event first.');
   if (!Number.isInteger(position) || position < 0 || position > target.events.length) throw new Error('Choose a position in the day.');
   target.events.splice(position,0,event);
   commit(withDays(destination === editor.dayIndex ? [target] : [origin,target]),editor.id ? 'Event updated.' : 'Event added.',destination);
   closeEditor(event.id);
   window.tripMotion?.centerDay(destination);
  } catch(e) { error(e.message); }
 });
 $('#remove-event').addEventListener('click',() => {
  if (!editor?.id) return;
  try {
   if(editor.mode==='booking'||editor.mode==='location'){
    const {mode,id}=editor;
    const oldPlace=place(id);
    const updated=days.filter(d=>mode==='booking'?d.events.some(e=>e.reservation===id):d.map===id||d.events.some(e=>e.map===id)).map(d=>{
     const next=dayRecord(d);
     if(mode==='location'&&next.map===id)next.map='';
     next.events.forEach(e=>{if(mode==='booking'&&e.reservation===id)e.reservation='';if(mode==='location'&&e.map===id){e.query ||= oldPlace.query;e.map='';}});
     return next;
    });
    const nextBookings=mode==='booking'?reservations.filter(r=>r.id!==id):reservations.map(r=>({...r,map:r.map===id?'':r.map}));
    commit(withDays(updated),`${mode==='booking'?'Booking':'Location'} removed. You can undo this.`,selectedDay,{places:mode==='location'?places.filter(p=>p.id!==id):places,reservations:nextBookings});
    closeEditor();document.querySelector(`#${document.body.dataset.view} [data-undo-trip]`)?.focus({preventScroll:true});return;
   }
   const next = dayRecord(days[editor.dayIndex]);
   next.events = next.events.filter(e => e.id !== editor.id);
   commit(withDays([next]),'Event removed. You can undo this.',editor.dayIndex);
   closeEditor(); $('#undo-itinerary').focus({preventScroll:true});
  } catch(e) { error(e.message); }
 });
 document.querySelectorAll('[data-undo-trip]').forEach(button=>button.addEventListener('click',() => {
  if (!previous) return;
  try {
   isCurrent(); const restored=previous;overrides=restored.days;previous=null;apply(restored);save();
   undoVisible(false);
   announce('Last change undone.' + (saved ? ' Saved on this device.' : ' Download a backup to keep it.'));
   (document.body.dataset.view==='reservations'?$('#add-booking'):document.body.dataset.view==='maps'?$('#add-location'):$('#add-event')).focus({preventScroll:true});
  } catch(e) { announce(e.message); }
 }));
 $('#export-itinerary').addEventListener('click',() => {
  const content = {...payload(days.map(dayRecord)),exportedAt:new Date().toISOString()};
  const url = URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'la-trip-backup.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url),10000);
  announce('Backup download started. Keep the file to restore or move your itinerary.');
 });
 $('#import-itinerary').addEventListener('change',async e => {
  const file = e.target.files?.[0]; e.target.value = '';
  if (!file) return;
  try {
   if (file.size > 2*1024*1024) throw new Error('Choose a backup smaller than 2 MB.');
   const data=JSON.parse(await file.text());
   imported = validBackup(data);
   $('#import-legacy-note').hidden=data.version!==1;
   $('#import-legacy-note').textContent='This older backup contains only itinerary days. Original booking and location records will be restored with it.';
   // Exported backups contain every day, so importing never accidentally mixes plans.
   if (imported.days.length !== days.length) throw new Error('Choose a complete backup containing all nine days.');
   editor = {mode:'import'};
   $('#editor-title').textContent = 'Import your plan'; $('#save-event').textContent = 'Import trip';
   $('#import-summary').textContent = `${imported.days.length} days · ${imported.days.reduce((n,d)=>n+d.events.length,0)} events · ${imported.reservations.length} bookings · ${imported.places.length} locations`;
   showEditor('import',$('#export-itinerary')); $('#cancel-editor').focus();
  } catch(e) { imported = null; announce(e instanceof SyntaxError ? 'That file is not a valid JSON backup. Your plan has not changed.' : `${e.message} Your plan has not changed.`); }
 });
 try {
  storedRaw = localStorage.getItem(key);
  if (storedRaw) {
   try { const loaded=validBackup(JSON.parse(storedRaw));overrides=loaded.days;places.splice(0,places.length,...loaded.places);reservations.splice(0,reservations.length,...loaded.reservations); }
   catch { loadIssue = 'Your saved plan could not be read. Showing the original plan; a new save will replace the unreadable copy. Import a backup to recover it.'; }
  }
 } catch { storageReadable = false; saved = false; }
 window.tripEditor = {dayChanged:() => { $('#add-event').setAttribute('aria-label',`Add event on ${days[selectedDay].date} December`); }};
 apply(payload(overrides)); storageNotice();
})();
