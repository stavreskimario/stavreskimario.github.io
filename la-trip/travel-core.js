'use strict';

// Pure, dependency-free rules shared by the UI and the regression checks.
(() => {
 const ZONE = 'America/Los_Angeles';
 const people = ['Mario', 'Andreas'];
 const modes = ['driving', 'walking', 'transit', 'bicycling'];
 const copy = value => JSON.parse(JSON.stringify(value));
 function text(value, max = 500, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Check the text fields and their length.');
  return value.trim();
 }
 function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('Invalid record identifier.');
  return value;
 }
 function url(value = '') {
  const clean = text(value, 2000);
  if (!clean) return '';
  let parsed; try { parsed = new URL(clean); } catch { throw new Error('Use a full http:// or https:// website address.'); }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Use a website without login details.');
  return parsed.href;
 }
 function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Check ${label}.`);
  return value;
 }
 function cents(value) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(value).trim())) throw new Error('Enter an amount with up to two decimal places.');
  const [whole, fraction = ''] = String(value).trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
 }
 function date(value) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Choose a valid date.');
  return value;
 }
 function zone(value = ZONE) {
  text(value, 80, true);
  try { new Intl.DateTimeFormat('en', {timeZone:value}).format(0); } catch { throw new Error('Use a valid timezone, such as America/Los_Angeles.'); }
  return value;
 }
 function wallTime(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(instant);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
 }
 function instant(local, timeZone = ZONE) {
  zone(timeZone);
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Enter both a date and a time.');
  date(local.slice(0, 10));
  if (Number(local.slice(11, 13)) > 23 || Number(local.slice(14)) > 59) throw new Error('Choose a valid time.');
  const nominal = Date.parse(local + 'Z');
  let result = nominal;
  for (let i = 0; i < 4; i++) result += nominal - Date.parse(wallTime(result, timeZone) + 'Z');
  if (wallTime(result, timeZone) !== local) throw new Error('That local time does not exist because the clocks change. Choose another time.');
  // A repeated clock hour needs an explicit UTC time to avoid silently choosing a flight instant.
  if ([-3600000, -1800000, 1800000, 3600000].some(delta => wallTime(result + delta, timeZone) === local)) throw new Error('That clock time occurs twice. Enter this time in UTC instead.');
  return result;
 }
 function schedule(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid activity timing.');
  const s = {start:text(raw.start || '', 16), end:text(raw.end || '', 16), zone:zone(raw.zone || ZONE), endZone:zone(raw.endZone || raw.zone || ZONE), mode:raw.mode || 'driving', travel:raw.travel ?? null, buffer:raw.buffer ?? 0, flight:text(raw.flight || '', 20), departure:text(raw.departure || '', 100), arrival:text(raw.arrival || '', 100), terminal:text(raw.terminal || '', 100)};
  if (!modes.includes(s.mode)) throw new Error('Choose a travel mode.');
  if (s.travel !== null) integer(s.travel, 0, 1440, 'the travel estimate in minutes');
  integer(s.buffer, 0, 1440, 'the arrival buffer in minutes');
  if (s.end && !s.start) throw new Error('Add a start time before an end time.');
  if (s.start) {
   const start = instant(s.start, s.zone);
   if (s.end && instant(s.end, s.endZone) <= start) throw new Error('The end/arrival must be after the start/departure, including timezones.');
  }
  return s;
 }
 function defaults() { return {ideas:[], expenses:[], settlements:[], tasks:[], budget:null, rate:null}; }
 function records(raw, validate, maximum = 500) {
  if (!Array.isArray(raw) || raw.length > maximum) throw new Error(`Use up to ${maximum} records.`);
  const seen = new Set();
  return raw.map(value => { if (!value || typeof value !== 'object') throw new Error('Invalid record.'); const r = validate(value); if (seen.has(r.id)) throw new Error('Duplicate record identifier.'); seen.add(r.id); return r; });
 }
 function companion(raw = defaults()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid trip tools data.');
  const out = defaults();
  if (raw.budget !== null && raw.budget !== undefined) out.budget = integer(raw.budget, 0, 9999999999, 'the AUD budget');
  if (raw.rate !== null && raw.rate !== undefined) {
   if (typeof raw.rate !== 'number' || !Number.isFinite(raw.rate) || raw.rate <= 0 || raw.rate > 1000) throw new Error('Enter a positive USD to AUD exchange rate.');
   out.rate = raw.rate;
  }
  out.ideas = records(raw.ideas || [], r => ({id:id(r.id), title:text(r.title, 160, true), note:text(r.note || '', 5000), query:text(r.query || '', 500), source:url(r.source)}), 200);
  out.tasks = records(raw.tasks || [], r => { if (typeof r.done !== 'boolean') throw new Error('Invalid task status.'); return {id:id(r.id), title:text(r.title, 160, true), done:r.done}; }, 100);
  out.expenses = records(raw.expenses || [], r => {
   if (!['AUD', 'USD'].includes(r.currency) || !['planned', 'paid'].includes(r.state) || !people.includes(r.payer)) throw new Error('Choose a valid currency, payment status and payer.');
   const result = {id:id(r.id), title:text(r.title,160,true), amount:integer(r.amount,0,9999999999,'the expense amount'), currency:r.currency, state:r.state, payer:r.payer, marioShare:integer(r.marioShare,0,100,'Mario’s share from 0 to 100%'), date:date(r.date), category:text(r.category || 'Other', 80), event:r.event ? id(r.event) : '', note:text(r.note || '', 2000), actualAud:r.actualAud ?? null};
   if (result.actualAud !== null) { integer(result.actualAud,0,9999999999,'the actual AUD charge'); if (r.currency !== 'USD' || r.state !== 'paid') throw new Error('An actual AUD charge applies only to a paid USD expense.'); }
   return result;
  });
  out.settlements = records(raw.settlements || [], r => { if (!people.includes(r.from)) throw new Error('Choose who made the repayment.'); return {id:id(r.id), from:r.from, amount:integer(r.amount,1,9999999999,'the repayment amount'), date:date(r.date), note:text(r.note || '',2000)}; });
  return out;
 }
 function totals(data) {
  let paid = 0, planned = 0, balance = 0, unconverted = 0;
  const native = {AUD:{paid:0,planned:0}, USD:{paid:0,planned:0}};
  for (const e of data.expenses) {
   native[e.currency][e.state] += e.amount;
   const aud = e.currency === 'AUD' ? e.amount : e.actualAud !== null ? e.actualAud : data.rate ? Math.round(e.amount * data.rate) : null;
   if (aud === null) { unconverted++; continue; }
   if (e.state === 'planned') planned += aud;
   else {
    paid += aud;
    const mario = Math.round(aud * e.marioShare / 100);
    balance += e.payer === 'Mario' ? -(aud - mario) : mario;
   }
  }
  for (const s of data.settlements) balance += s.from === 'Mario' ? -s.amount : s.amount;
  return {paid, planned, balance, unconverted, native, remaining:data.budget === null ? null : data.budget - paid - planned};
 }
 function money(value, currency = 'AUD') { return new Intl.NumberFormat('en-AU', {style:'currency',currency,currencyDisplay:'code'}).format(value / 100); }
 function displayTime(event) {
  const s = event.schedule;
  if (!s?.start) return event.time;
  return new Intl.DateTimeFormat('en-AU', {timeZone:s.zone,day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(instant(s.start,s.zone));
 }
 function upcoming(days, now = Date.now()) {
  const timed = days.flatMap(d => d.events.filter(e => e.schedule?.start && e.status !== 'proposed').map(event => ({event, day:d, at:instant(event.schedule.start,event.schedule.zone)}))).sort((a,b) => a.at-b.at);
  const active = timed.filter(item => item.at < now && item.event.type !== 'hotel' && item.event.schedule.end && instant(item.event.schedule.end,item.event.schedule.endZone) >= now);
  // A multi-night hotel stay must not hide every subsequent day's activity.
  return active.at(-1) || timed.find(item => item.at >= now) || null;
 }
 function timingWarning(previous, current) {
  const a = previous?.schedule, b = current?.schedule;
  if (!a?.end || !b?.start || b.travel === null) return '';
  const gap = (instant(b.start,b.zone) - instant(a.end,a.endZone))/60000 - b.travel - b.buffer;
  return gap < 0 ? `Allow ${Math.ceil(-gap)} more minutes between these activities, based on your travel estimate and buffer.` : '';
 }
 function routeUrl(stops, mode = 'driving') {
  if (!modes.includes(mode)) throw new Error('Choose a route mode.');
  if (stops.length < 2 || stops.length > 5) throw new Error('Choose 2–5 stops per route for mobile compatibility.');
  const params = new URLSearchParams({api:'1',origin:stops[0],destination:stops.at(-1),travelmode:mode});
  if (stops.length > 2) params.set('waypoints',stops.slice(1,-1).join('|'));
  const result = 'https://www.google.com/maps/dir/?' + params;
  if (result.length > 2048) throw new Error('This route is too long for a link. Open individual legs instead.');
  return result;
 }
 function calendar(days, selectedIds = null, now = new Date()) {
  const escape = s => String(s).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const utc = ms => new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mario Sites//LA Trip//EN','CALSCALE:GREGORIAN'];
  let count = 0, floating = 0;
  for (const day of days) for (const event of day.events) {
   if (selectedIds && !selectedIds.includes(event.id)) continue;
   count++;
   lines.push('BEGIN:VEVENT',`UID:${event.id}@la-december-2026.mario-sites`,`DTSTAMP:${utc(now.getTime())}`);
   if (event.schedule?.start) {
    lines.push(`DTSTART:${utc(instant(event.schedule.start,event.schedule.zone))}`);
    if (event.schedule.end) lines.push(`DTEND:${utc(instant(event.schedule.end,event.schedule.endZone))}`);
   } else {
    floating++;
    lines.push(`DTSTART;VALUE=DATE:202612${day.date}`);
    lines.push(`DTEND;VALUE=DATE:${new Date(Date.UTC(2026,11,day.date+1)).toISOString().slice(0,10).replace(/-/g,'')}`);
   }
   const detail = [event.time, event.note, !event.schedule?.start ? 'Time not confirmed. Exported as an all-day reminder.' : '', event.schedule?.start ? `Start timezone: ${event.schedule.zone}` : '', event.schedule?.end ? `End timezone: ${event.schedule.endZone}` : ''].filter(Boolean).join('\n');
   lines.push(`SUMMARY:${escape(event.title)}`,`DESCRIPTION:${escape(detail)}`,`LOCATION:${escape(event.location)}`,'CLASS:PRIVATE',`STATUS:${event.status === 'proposed' ? 'TENTATIVE' : 'CONFIRMED'}`);
   if (event.source) lines.push(`URL:${url(event.source)}`);
   lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 folds at 75 octets, never splitting a UTF-8 code point.
  const folded = lines.map(line => { let result = '', size = 0; for (const character of line) { const bytes = new TextEncoder().encode(character).length; if (size + bytes > 75) { result += '\r\n '; size = 1; } result += character; size += bytes; } return result; }).join('\r\n') + '\r\n';
  return {content:folded,count,floating};
 }
 function draftText(input) {
  text(input, 30000, true);
  // Deliberately conservative: free text is kept, never guessed into a booking or precise time.
  const lines = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if(lines.length > 50) throw new Error('Import up to 50 items at a time.');
  return lines.map(line => {
   const [title = '', when = '', time = '', location = '', source = ''] = line.split('|').map(s => s.trim());
   const match = when.match(/^(?:2026-12-)?(2[0-8])(?:\s+Dec(?:ember)?)?$/i);
   return {title:text(title,160,true), day:match ? Number(match[1]) : '', time:text(time,160), location:text(location,240), source:url(source), note:!match && when ? `Original date text: ${when}` : ''};
  });
 }
 const api = {ZONE,people,modes,copy,text,id,url,cents,date,zone,instant,wallTime,schedule,defaults,companion,totals,money,displayTime,upcoming,timingWarning,routeUrl,calendar,draftText};
 if (typeof module !== 'undefined' && module.exports) module.exports = api;
 else window.TripCore = api;
})();
