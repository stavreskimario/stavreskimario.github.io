'use strict';

// Device-local itinerary editing. No credentials or server writes are involved.
(() => {
 const key = 'mario-la-dec2026-itinerary-v1';
 const trip = 'la-december-2026';
 const clone = value => JSON.parse(JSON.stringify(value));
 const defaults = clone(days);
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
 function validEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid event in the backup.');
  if (typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)) throw new Error('Invalid event identifier.');
  if (!Object.hasOwn(statuses, value.status) || !Object.hasOwn(types, value.type)) throw new Error('Choose a valid event status and icon.');
  if (value.map && !places.some(p => p.id === value.map)) throw new Error('Choose a saved map location.');
  if (value.reservation && !reservations.some(r => r.id === value.reservation)) throw new Error('Choose a linked booking record.');
  if (value.highlight !== undefined && typeof value.highlight !== 'boolean') throw new Error('Invalid highlight setting.');
  return {id:value.id, title:string(value.title,160,'the event name',true), time:string(value.time ?? '',160,'the time'), location:string(value.location ?? '',240,'the location'), note:string(value.note ?? '',5000,'the notes'), status:value.status, type:value.type, map:value.map || '', query:string(value.query ?? '',500,'the custom map destination'), source:website(value.source), reservation:value.reservation || '', highlight:value.highlight === true};
 }
 function validBackup(data) {
  if (!data || data.version !== 1 || data.trip !== trip || !Array.isArray(data.days) || data.days.length > defaults.length) throw new Error('Choose a valid LA trip backup (version 1).');
  const dates = new Set();
  const records = data.days.map(record => {
   const base = defaults.find(d => d.date === record?.date);
   if (!base || dates.has(record.date) || !Array.isArray(record.events) || record.events.length > 200) throw new Error('The backup has an invalid day or too many events (maximum 200 per day).');
   dates.add(record.date);
   const clean = {date:record.date, events:record.events.map(validEvent)};
   for (const [field,max,required] of [['title',160,true],['label',50,true],['description',3000,false],['noteTitle',160,false],['note',5000,false]]) clean[field] = string(record[field] ?? base[field],max,`the day’s ${field}`,required);
   clean.map = record.map ?? base.map;
   if (!places.some(p => p.id === clean.map)) throw new Error('Invalid day map.');
   return clean;
  });
  const ids = new Set();
  for (const day of defaults) for (const event of (records.find(r => r.date === day.date) || day).events) {
   if (ids.has(event.id)) throw new Error('The backup contains duplicate events.');
   ids.add(event.id);
  }
  return records;
 }
 const payload = records => ({version:1, trip, days:records});
 function dayRecord(day) {
  const {date,title,label,description,noteTitle,note,map,events} = day;
  return clone({date,title,label,description,noteTitle,note,map,events});
 }
 function apply(records) {
  days.forEach((day,i) => Object.assign(day,clone(defaults[i]),clone(records.find(r => r.date === day.date) || {})));
  selectDay(selectedDay);
 }
 function storageNotice() {
  $('#itinerary-storage').textContent = loadIssue || (saved ? 'Edits save in this browser on this device. Use a backup to move them.' : 'Changes are kept for this visit only. Saving is unavailable — download a backup before leaving.');
 }
 function announce(message) { $('#itinerary-feedback').textContent = message; }
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
 function commit(records, message, dayIndex = selectedDay) {
  isCurrent();
  const next = validBackup(payload(records));
  previous = clone(overrides);
  overrides = next;
  selectedDay = dayIndex;
  apply(overrides);
  save();
  $('#undo-itinerary').hidden = false;
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
 const placeOptions = places.map(p => [p.id,p.full]);
 options($('#event-map'),placeOptions,'No saved map');
 options($('#edit-day-map'),placeOptions);
 options($('#event-reservation'),reservations.map(r => [r.id,r.title]),'No linked booking');
 options($('#event-type'),Object.entries(types));
 options($('#event-day'),days.map((d,i) => [String(i),`${d.weekday} ${d.date} December`]));
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
  for (const [id,enabled] of [['event-fields',mode==='event'],['day-fields',mode==='day']]) { $('#'+id).hidden = !enabled; $('#'+id).disabled = !enabled; }
  $('#import-preview').hidden = mode !== 'import';
  $('#remove-event').hidden = mode !== 'event' || !editor.id;
  $('#editor-context').textContent = `${days[selectedDay].weekday} ${days[selectedDay].date} December · your plan`;
  dialog.showModal();
 }
 function closeEditor(focusId) {
  dialog.close();
  editor = null; imported = null;
  const target = focusId ? document.querySelector(`[data-edit-event="${focusId}"]`) : returnFocus;
  (target?.isConnected ? target : $('#add-event')).focus({preventScroll:true});
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
 function validateInput(input) {
  let message = '';
  if (input.required && !input.value.trim()) message = 'Please enter a name or title.';
  if (input.id === 'event-source') { try { website(input.value); } catch(e) { message = e.message; } }
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
    commit(imported,'Backup imported.'); closeEditor(); return;
   }
   const active = $('#'+(editor.mode === 'day' ? 'day-fields' : 'event-fields'));
   for (const input of active.querySelectorAll('input,textarea')) {
    const message = validateInput(input);
    if (message || !input.checkValidity()) { error(message || 'Check this field.',input); return; }
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
   const next = dayRecord(days[editor.dayIndex]);
   next.events = next.events.filter(e => e.id !== editor.id);
   commit(withDays([next]),'Event removed. You can undo this.',editor.dayIndex);
   closeEditor(); $('#undo-itinerary').focus({preventScroll:true});
  } catch(e) { error(e.message); }
 });
 $('#undo-itinerary').addEventListener('click',() => {
  if (!previous) return;
  try {
   isCurrent(); overrides = previous; previous = null; apply(overrides); save();
   $('#undo-itinerary').hidden = true;
   announce('Last change undone.' + (saved ? ' Saved on this device.' : ' Download a backup to keep it.'));
   $('#add-event').focus({preventScroll:true});
  } catch(e) { announce(e.message); }
 });
 $('#export-itinerary').addEventListener('click',() => {
  const content = {...payload(days.map(dayRecord)),exportedAt:new Date().toISOString()};
  const url = URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'la-itinerary-backup.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url),10000);
  announce('Backup download started. Keep the file to restore or move your itinerary.');
 });
 $('#import-itinerary').addEventListener('change',async e => {
  const file = e.target.files?.[0]; e.target.value = '';
  if (!file) return;
  try {
   if (file.size > 2*1024*1024) throw new Error('Choose a backup smaller than 2 MB.');
   imported = validBackup(JSON.parse(await file.text()));
   // Exported backups contain every day, so importing never accidentally mixes plans.
   if (imported.length !== days.length) throw new Error('Choose a complete backup containing all nine days.');
   editor = {mode:'import'};
   $('#editor-title').textContent = 'Import your plan'; $('#save-event').textContent = 'Import itinerary';
   $('#import-summary').textContent = `${imported.length} days · ${imported.reduce((n,d)=>n+d.events.length,0)} events · 20–28 December 2026`;
   showEditor('import',$('#export-itinerary')); $('#cancel-editor').focus();
  } catch(e) { imported = null; announce(e instanceof SyntaxError ? 'That file is not a valid JSON backup. Your plan has not changed.' : `${e.message} Your plan has not changed.`); }
 });
 try {
  storedRaw = localStorage.getItem(key);
  if (storedRaw) {
   try { overrides = validBackup(JSON.parse(storedRaw)); }
   catch { loadIssue = 'Your saved plan could not be read. Showing the original plan; a new save will replace the unreadable copy. Import a backup to recover it.'; }
  }
 } catch { storageReadable = false; saved = false; }
 window.tripEditor = {dayChanged:() => { $('#add-event').setAttribute('aria-label',`Add event on ${days[selectedDay].date} December`); }};
 apply(overrides); storageNotice();
})();
