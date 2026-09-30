'use strict';
const tripMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
document.documentElement.dataset.input = 'keyboard';
// Capture modality before any delegated action runs, including native/AT clicks.
function tripInputMode(mode) {
 document.documentElement.dataset.input = mode;
 if (mode === 'keyboard') window.tripMotion?.finishAnimations?.();
}
document.addEventListener('keydown', e => {
 if (!['Shift','Control','Alt','Meta'].includes(e.key)) tripInputMode('keyboard');
}, true);
document.addEventListener('pointerdown', () => tripInputMode('pointer'), {capture:true, passive:true});
document.addEventListener('click', e => { if (e.detail === 0) tripInputMode('keyboard'); }, true);
function tripAllowsMotion() {
 return document.documentElement.dataset.input !== 'keyboard' && !tripMotionPreference.matches;
}
document.addEventListener('visibilitychange', () => { document.documentElement.toggleAttribute('data-motion-paused', document.hidden); });
function tripScrollBehavior() { return tripAllowsMotion() ? 'smooth' : 'instant'; }

const icons={calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M7 15h2m6 0h2m-10 3h2"/>',ticket:'<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M15 5v3m0 3v2m0 3v3"/>',map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',bag:'<rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M9 10v7m6-7v7M8 21v1m8-1v1"/>',plane:'<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="m22 2-11 11"/>',moon:'<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',external:'<path d="M14 3h7v7m0-7L10 14m0-11H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',hotel:'<path d="M4 21V3h12v18M2 21h20M16 10h4v11M8 7h4M8 11h4M8 15h4m-3 6v-3h2v3"/>',car:'<path d="m4 10 2-6h12l2 6M3 10h18v8H3v-8Zm2 8v3m14-3v3M6 14h2m8 0h2"/>',ball:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M6 5a11 11 0 0 1 0 14M18 5a11 11 0 0 0 0 14"/>',film:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7h4m-4 5h4m-4 5h4M17 7h4m-4 5h4m-4 5h4M7 12h10"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',coffee:'<path d="M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 0h2a3 3 0 0 1 0 6h-2M7 2v3m4-3v3M2 21h17"/>',route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',device:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',plus:'<path d="M12 5v14M5 12h14"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.pin}</svg>`}
function injectIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon))}
function esc(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const $=s=>document.querySelector(s);
const places=[
{id:'hotel',name:'The Westin Bonaventure',full:'The Westin Bonaventure Hotel & Suites',area:'Downtown Los Angeles',address:'404 South Figueroa Street, Los Angeles, CA 90071',category:'YOUR HOME BASE · BOOKED',query:'The Westin Bonaventure Hotel 404 South Figueroa Street Los Angeles',source:'https://www.marriott.com/en-us/hotels/laxbw-the-westin-bonaventure-hotel-and-suites-los-angeles/overview/',day:20},
{id:'warner',name:'Warner Bros. Studio Tour',full:'Warner Bros. Studio Tour Hollywood',area:'Burbank · Proposed 21 Dec',address:'3400 Warner Boulevard, Burbank, CA 91505',category:'STUDIO DAY · PROPOSED',query:'Warner Bros Studio Tour Hollywood 3400 Warner Boulevard Burbank',source:'https://www.wbstudiotour.com/info/directions/',day:21},
{id:'universal',name:'Universal Studios',full:'Universal Studios Hollywood',area:'Universal City · Proposed 22 Dec',address:'100 Universal City Plaza, Universal City, CA 91608',category:'THEME PARK · PROPOSED',query:'Universal Studios Hollywood 100 Universal City Plaza',source:'https://www.universalstudioshollywood.com/web/en/us/plan-your-visit/directions-parking',day:22},
{id:'intuit',name:'Intuit Dome',full:'Intuit Dome',area:'Inglewood · 23 Dec',address:'3930 West Century Boulevard, Inglewood, CA 90303',category:'CLIPPERS–WARRIORS · IN YOUR ITINERARY',query:'Intuit Dome 3930 West Century Boulevard Inglewood',source:'https://www.intuitdome.com/plan-your-visit/how-to-get-here',day:23},
{id:'crypto',name:'Crypto.com Arena',full:'Crypto.com Arena',area:'Downtown LA · 25 Dec',address:'1111 South Figueroa Street, Los Angeles, CA 90015',category:'LAKERS–76ERS · IN YOUR ITINERARY',query:'Crypto.com Arena 1111 South Figueroa Street Los Angeles',source:'https://www.cryptoarena.com/directions',day:25},
{id:'sf',name:'San Francisco',full:'San Francisco · Ferry Building',area:'Day trip · Proposed 26 Dec',address:'Ferry Building, Embarcadero, San Francisco, CA',category:'DAY TRIP BY AIR · PROPOSED',query:'Ferry Building San Francisco California',source:'https://www.sftravel.com/article/everything-you-need-to-know-about-san-franciscos-ferry-building',day:26},
{id:'santamonica',name:'Santa Monica',full:'Santa Monica Pier & beach',area:'Coast day · Proposed 27 Dec',address:'Santa Monica Pier, Santa Monica, CA',category:'COAST DAY · PROPOSED',query:'Santa Monica Pier California',source:'https://www.santamonica.com/things-to-do/visiting-santa-monica-pier/',day:27}
];
const place=id=>places.find(p=>p.id===id);
let selectedPlace='hotel';
const mapPreferenceKey='mario-la-dec2026-map-provider';
let mapProvider='google',mapPreferenceSaved=false;
try{const saved=localStorage.getItem(mapPreferenceKey);if(saved==='google'||saved==='apple'){mapProvider=saved;mapPreferenceSaved=true}}catch{}
const mapProviderName=()=>mapProvider==='apple'?'Apple Maps':'Google Maps';
function mapLinkUrl(query,action='search',origin=''){
 const q=encodeURIComponent(query),o=encodeURIComponent(origin);
 if(mapProvider==='apple')return action==='directions'?`https://maps.apple.com/?daddr=${q}${origin?'&saddr='+o:''}`:`https://maps.apple.com/?q=${q}`;
 return action==='directions'?`https://www.google.com/maps/dir/?api=1&destination=${q}${origin?'&origin='+o:''}`:`https://www.google.com/maps/search/?api=1&query=${q}`;
}
function updateMapLink(el){
 const action=el.dataset.mapAction||'search';
 el.href=mapLinkUrl(el.dataset.mapQuery,action,el.dataset.mapOrigin||'');
 const label=action==='directions'?`Directions in ${mapProviderName()}`:`Open in ${mapProviderName()}`;
 el.setAttribute('aria-label',`${label}: ${el.dataset.mapQuery}${el.dataset.mapOrigin?' from '+el.dataset.mapOrigin:''}`);
 el.querySelectorAll('[data-map-provider-name]').forEach(n=>n.textContent=mapProviderName());
}
function setMapLink(selector,query,action='search',origin=''){
 const el=$(selector);el.dataset.mapQuery=query;el.dataset.mapAction=action;el.dataset.mapOrigin=origin;updateMapLink(el);
}
function mapActionLink(query,action='search'){
 return `<a href="${esc(mapLinkUrl(query,action))}" data-map-query="${esc(query)}" data-map-action="${action}" target="_blank" rel="noopener noreferrer">${icon('pin')}<span>${action==='directions'?'Directions in':'Open in'} <span data-map-provider-name>${mapProviderName()}</span> ↗</span></a>`;
}
function refreshMapPreference(){
 document.querySelectorAll('button[data-map-provider]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mapProvider===mapProvider)));
 document.querySelectorAll('a[data-map-query]').forEach(updateMapLink);
 window.tripMotion?.syncChoices();
 $('#map-choice-note').textContent=mapPreferenceSaved?'Choice saved on this device.':'Applies to all location and directions links.';
}
function chooseMapProvider(provider){
 if(provider!=='google'&&provider!=='apple')return;
 mapProvider=provider;
 try{localStorage.setItem(mapPreferenceKey,provider);mapPreferenceSaved=true}catch{mapPreferenceSaved=false}
 refreshMapPreference();
 if(!mapPreferenceSaved)$('#map-choice-note').textContent='Choice applies for this visit; saving on this device is unavailable.';
}

function renderMapCard(id,p){
 const el=$(id);
 el.hidden=!p;
 if(!p){el.removeAttribute('src');el.dataset.placeId='';if(id==='#day-map')$('#day-map-open').hidden=true;return}
 if(id==='#day-map')$('#day-map-open').hidden=false;
 const src=`https://maps.google.com/maps?q=${encodeURIComponent(p.query)}&z=${p.id==='sf'?13:14}&output=embed`;
 if(el.getAttribute('src')!==src)el.setAttribute('src',src);
 el.title=`Google Maps: ${p.full}`;el.dataset.placeId=p.id;
 if(id==='#day-map')setMapLink('#day-map-open',p.query);
}
const statuses={booked:'Booked',plan:'In itinerary',proposed:'Proposed'};
const days=[
{date:20,weekday:'Sun',label:'Arrive',title:'Hello, Los Angeles',description:'A travel day, a hotel check-in and an easy first evening. Exact flight and arrival times are still to add.',map:'hotel',noteTitle:'Land. Settle in. Exhale.',note:'Keep the first evening open. Your Westin stay starts today, so there’s no need to rush into sightseeing.',events:[
{time:'Time to confirm · MEL local time',title:'Melbourne → Los Angeles',location:'United Airlines · UA99',status:'plan',type:'plane',note:'Depart Melbourne on 20 December. Flight times, terminal and booking reference to add.',reservation:'outbound'},
{time:'After arrival',title:'LAX → your hotel',location:'Airport transfer',status:'proposed',type:'car',note:'Transfer method and timing to arrange once the arrival details are confirmed.',map:'hotel'},
{time:'20 December · check-in time to confirm',title:'Check in at The Westin Bonaventure',location:'Downtown LA · 8 nights',status:'booked',type:'hotel',note:'Your stay is booked for 20–28 December, for two guests.',map:'hotel',reservation:'hotel'}]},
{date:21,weekday:'Mon',label:'Warner Bros.',title:'Behind the scenes',description:'A proposed studio day in Burbank. Choose the tour and start time once tickets are confirmed.',map:'warner',noteTitle:'A day for movie magic',note:'Warner Bros. has its own day in the plan. Keep the rest of the afternoon flexible around your eventual tour slot.',events:[
{time:'Morning · proposed',title:'Warner Bros. Studio Tour Hollywood',location:'Burbank',status:'proposed',type:'film',note:'Placeholder for your studio visit. Tour type, tickets and start time are not booked.',map:'warner',source:'https://www.wbstudiotour.com/'},
{time:'Afternoon · flexible',title:'Lunch & an easy afternoon',location:'Burbank / Los Angeles',status:'proposed',type:'coffee',note:'Leave room to linger after the studio tour. Lunch and any extra stops can be added later.'},
{time:'Evening · flexible',title:'Back to your home base',location:'The Westin Bonaventure',status:'proposed',type:'hotel',note:'An unhurried evening before a full Universal day.',map:'hotel'}]},
{date:22,weekday:'Tue',label:'Universal',title:'A full day at Universal',description:'Universal gets a day of its own. This date is a placeholder until you choose tickets and check park hours.',map:'universal',noteTitle:'Keep the whole day free',note:'There are no other fixed plans today. Ticket choice, holiday hours and transport are still to arrange.',events:[
{time:'Full day · proposed',title:'Universal Studios Hollywood',location:'Universal City',status:'proposed',type:'film',note:'Your theme park placeholder. Admission and operating hours are not yet confirmed.',map:'universal',source:'https://www.universalstudioshollywood.com/web/en/us'},
{time:'After the park · optional',title:'Dinner around CityWalk',location:'Universal CityWalk',status:'proposed',type:'coffee',note:'An optional nearby dinner before heading back. No restaurant reservation yet.',map:'universal',source:'https://www.universalstudioshollywood.com/web/en/us/things-to-do/lands/citywalk'}]},
{date:23,weekday:'Wed',label:'Clippers',title:'City time. Then courtside.',description:'Keep the daytime flexible and leave space to get to Inglewood for Clippers–Warriors.',map:'intuit',noteTitle:'Your first NBA night',note:'Clippers–Warriors is in the itinerary. Add the tickets, section and entry details when you have them.',events:[
{time:'Daytime · flexible',title:'Browse the Fashion District',location:'Downtown Los Angeles',status:'proposed',type:'bag',note:'An optional shopping window. Specific stores and opening hours can be added later.',source:'https://fashiondistrict.org/shop/shopping-tips',query:'Los Angeles Fashion District'},
{time:'Before the game',title:'Head to Intuit Dome',location:'Downtown LA → Inglewood',status:'proposed',type:'car',note:'Transport is still to arrange. Check live traffic and leave time for arena entry.',map:'intuit'},
{time:'7:30 pm · PST',title:'LA Clippers vs Golden State Warriors',location:'Intuit Dome · Inglewood',status:'plan',type:'ball',note:'23 December, using the time from your itinerary. Ticket and seat details to add.',map:'intuit',reservation:'clippers',highlight:true}]},
{date:24,weekday:'Thu',label:'Explore LA',title:'Christmas Eve, at your pace',description:'An open day in Los Angeles. A little exploring, a little downtime, and no fixed reservations.',map:'hotel',noteTitle:'A flexible Christmas Eve',note:'Keep today light. Choose the stops and a dinner reservation after holiday opening hours are known.',events:[
{time:'Morning · flexible',title:'Slow start in Downtown LA',location:'Around your hotel',status:'proposed',type:'coffee',note:'Breakfast and a wander. Exact cafés and stops are still open.',map:'hotel'},
{time:'Afternoon · flexible',title:'A little more Los Angeles',location:'Neighbourhood to choose',status:'proposed',type:'sun',note:'A free window for sightseeing, shopping or relaxing. Add a confirmed plan here later.'},
{time:'Evening · proposed',title:'Christmas Eve dinner',location:'Restaurant to choose',status:'proposed',type:'coffee',note:'No reservation yet. Pick a venue and check holiday service before locking it in.'}]},
{date:25,weekday:'Fri',label:'Lakers',title:'Christmas, courtside',description:'The anchor of Christmas Day: Lakers–76ers at Crypto.com Arena. Keep the surrounding plans easy.',map:'crypto',noteTitle:'The Christmas highlight',note:'Your calendar time is 2:00 pm in Los Angeles. Seats and ticket details can be added when ready.',events:[
{time:'Morning · flexible',title:'An easy Christmas morning',location:'Downtown LA',status:'proposed',type:'coffee',note:'Breakfast and time to get ready. Christmas dining plans are still to confirm.'},
{time:'2:00 pm · PST',title:'Los Angeles Lakers vs Philadelphia 76ers',location:'Crypto.com Arena',status:'plan',type:'ball',note:'25 December, matching your calendar plan. Ticket, seat and entry details to add.',map:'crypto',reservation:'lakers',highlight:true},
{time:'After the game · flexible',title:'Christmas dinner',location:'Restaurant to choose',status:'proposed',type:'coffee',note:'Keep the evening open until the game and dinner arrangements are final.'}]},
{date:26,weekday:'Sat',label:'SF day trip',title:'A San Francisco detour',description:'A proposed same-day flight trip, returning to your LA hotel that night. The date depends on workable flights.',map:'sf',noteTitle:'A flight day, not a road trip',note:'This is only a placeholder. Confirm outward and return flights, airport transfers and enough city time before booking.',events:[
{time:'Early departure · target only',title:'Fly Los Angeles → San Francisco',location:'Airports and flights to choose',status:'proposed',type:'plane',note:'No flight has been selected or booked. An early departure would make the day trip more useful.'},
{time:'Daytime · proposed',title:'The Ferry Building & waterfront',location:'San Francisco',status:'proposed',type:'sun',note:'A simple starting point for city time. Final stops depend on flight times and local conditions.',map:'sf',source:'https://www.sftravel.com/article/everything-you-need-to-know-about-san-franciscos-ferry-building'},
{time:'Evening return · target only',title:'Fly back to Los Angeles',location:'Return to The Westin Bonaventure',status:'proposed',type:'plane',note:'Same-day return required for this draft. Return flight and airport transfers still to arrange.',map:'hotel'}]},
{date:27,weekday:'Sun',label:'The coast',title:'One last California afternoon',description:'A proposed coastal day before you leave. Keep it flexible for weather, energy and any last-minute plans.',map:'santamonica',noteTitle:'Leave room for a favourite',note:'This is an open day. Swap the coast for anything you want to revisit, then leave some time to pack.',events:[
{time:'Daytime · proposed',title:'Santa Monica Pier & the beach',location:'Santa Monica',status:'proposed',type:'sun',note:'An optional coastal wander and lunch. No fixed time or reservation.',map:'santamonica',source:'https://www.santamonica.com/things-to-do/visiting-santa-monica-pier/'},
{time:'Evening · flexible',title:'Dinner, then pack for home',location:'Downtown Los Angeles',status:'proposed',type:'bag',note:'Keep your flight essentials and the next day’s clothes handy.',map:'hotel'}]},
{date:28,weekday:'Mon',label:'Fly home',title:'Until next time, LA',description:'Check out of the Westin and fly home on DL11. Departure time and Melbourne arrival date are still to confirm.',map:'hotel',noteTitle:'One last check',note:'The 28 December date is your LA departure date in this plan. Add the Melbourne arrival date from your ticket.',events:[
{time:'28 December · time to confirm',title:'Check out of The Westin Bonaventure',location:'Your eight-night stay ends',status:'booked',type:'hotel',note:'Check-out time and any luggage storage arrangements are still to add.',map:'hotel',reservation:'hotel'},
{time:'Before your flight',title:'Hotel → LAX',location:'Airport transfer',status:'proposed',type:'car',note:'Choose transport and departure time once the flight schedule is confirmed.',query:'Los Angeles International Airport LAX'},
{time:'Time to confirm · LA local time',title:'Los Angeles → Melbourne',location:'Delta Air Lines · DL11',status:'plan',type:'plane',note:'Depart Los Angeles on 28 December. Flight times, booking reference and Melbourne arrival date to add.',reservation:'inbound'}]}
];
// Stable identifiers let saved edits survive day changes and reloads.
days.forEach(d=>d.events.forEach((e,i)=>e.id=`day-${d.date}-event-${i+1}`));
let selectedDay=0;
const dayPresentation={20:{photo:'assets/westin-bonaventure.jpg',position:'50% 62%',label:'Arrive',icon:'plane'},21:{photo:'assets/la-skyline.jpg',position:'23% 50%',label:'Warner Bros.',icon:'film'},22:{photo:'assets/la-skyline.jpg',position:'66% 35%',label:'Universal',icon:'film'},23:{photo:'assets/la-skyline.jpg',position:'25% 60%',label:'Clippers',icon:'ball'},24:{photo:'assets/westin-bonaventure.jpg',position:'55% 40%',label:'Explore LA',icon:'sun'},25:{photo:'assets/la-skyline.jpg',position:'60% 45%',label:'Lakers',icon:'ball'},26:{photo:'assets/golden-gate-sunset.jpg',position:'50% 45%',label:'San Francisco',icon:'plane'},27:{photo:'assets/la-skyline.jpg',position:'83% 70%',label:'The coast',icon:'sun'},28:{photo:'assets/westin-bonaventure.jpg',position:'42% 50%',label:'Fly home',icon:'plane'}};
function renderDates(){
 const strip=$('#date-strip');
 if(!strip.children.length)strip.innerHTML=days.map((d,i)=>{const t=dayPresentation[d.date];return `<button class="date-button" data-day="${i}" aria-pressed="false" aria-label="Day ${i+1}, ${d.weekday} ${d.date} December: ${esc(d.label)}"><span class="date-copy"><span class="date-meta">DAY ${i+1}</span><span class="day-label">${esc(t.label)}</span><span class="date-number">${d.date} DEC</span></span><img class="date-photo" src="${t.photo}" style="object-position:${t.position}" alt="" width="87" height="78" loading="lazy"><span class="date-stamp">${icon(t.icon)}</span></button>`}).join('');
 strip.querySelectorAll('[data-day]').forEach(el=>{const i=Number(el.dataset.day),d=days[i];el.setAttribute('aria-pressed',String(i===selectedDay));el.querySelector('.day-label').textContent=d.label;el.setAttribute('aria-label',`Day ${i+1}, ${d.weekday} ${d.date} December: ${d.label}`)});
}
function readableTime(e){
 if(e.time==='Time to confirm · MEL local time')return 'Time to confirm · Melbourne';
 if(e.time==='Time to confirm · LA local time')return 'Time to confirm · Los Angeles';
 if(e.time==='20 December · check-in time to confirm')return 'Check-in time to confirm';
 if(e.time==='28 December · time to confirm')return 'Check-out time to confirm';
 return e.time;
}
function renderReservationPeek(){
 const featured=['hotel','clippers','lakers'].map(id=>reservations.find(r=>r.id===id)).filter(Boolean);
 const cards=[...featured,...reservations.filter(r=>!featured.includes(r))].slice(0,3);
 $('#reservation-peek-list').innerHTML=cards.length?cards.map(r=>`<button class="mini-reservation" data-reservation="${esc(r.id)}" aria-label="View details: ${esc(r.title)}">${r.id==='hotel'&&r.title.includes('Westin Bonaventure')?'<img src="assets/westin-bonaventure.jpg" alt="Westin Bonaventure towers" width="67" height="77" loading="lazy">':`<span class="mini-art ${esc(r.id)}" aria-hidden="true">${icon(r.icon)}</span>`}<div><h3>${esc(r.title)}</h3><p>${esc(r.subtitle)}</p><span class="badge ${r.status}">${statuses[r.status]}</span></div></button>`).join(''):'<p class="empty-day">No bookings yet. Add one in Bookings.</p>';
}
function renderPlacesPeek(){
 const featured=['hotel','warner','universal','sf'].map(place).filter(Boolean);
 const preview=[...featured,...places.filter(p=>!featured.includes(p))].slice(0,4);
 $('#places-peek-list').innerHTML=preview.map(p=>`<button class="place-peek-button" data-open-map="${esc(p.id)}" aria-label="Open map: ${esc(p.name)}">${p.id==='hotel'&&p.name.includes('Westin Bonaventure')?'<img src="assets/westin-bonaventure.jpg" alt="" width="30" height="30" loading="lazy">':`<span class="place-peek-icon">${icon('pin')}</span>`}<div><strong>${esc(p.name)}</strong><small>${esc(p.area)}</small></div><span aria-hidden="true">↗</span></button>`).join('')||'<p class="empty-day">No saved locations. Add one in Maps.</p>';
}
function renderPackingPeek(){
 const items=[['passport','Passport'],['knits','Warm layers'],['jacket','Jacket'],['shoes','Walking shoes'],['phone','Phone charger'],['adapter','US adaptor'],['headphones','Headphones'],['jersey','Game-day outfit']];
 $('#packing-peek-list').innerHTML=items.map(([id,label])=>{const p=packing.find(p=>p.id===id);return `<label class="peek-check"><input type="checkbox" data-pack-id="${id}" ${p.checked?'checked':''} aria-label="${esc(p.label)}"><span>${esc(label)}</span></label>`}).join('');
}
function eventActions(e){let actions=[];if(e.query||place(e.map))actions.push(mapActionLink(e.query||place(e.map).query,'directions'));if(reservations.some(r=>r.id===e.reservation))actions.push(`<button data-reservation="${esc(e.reservation)}">${icon('ticket')}Booking details</button>`);if(e.source)actions.push(`<a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">Website ${icon('external')}</a>`);return actions.length?`<div class="event-actions">${actions.join('')}</div>`:''}
function selectDay(index,scroll=false){
 if(!Number.isInteger(index)||index<0||index>=days.length)throw new Error('Choose a day from 20 to 28 December.');
 selectedDay=index;const d=days[index];renderDates();
 $('#day-number').textContent=`DAY ${index+1} · ${d.weekday.toUpperCase()} ${d.date} DEC`;
 $('#day-title').textContent=d.title;$('#day-description').textContent=d.description;
 $('#timeline').innerHTML=d.events.length?d.events.map(e=>`<article class="timeline-item ${e.status}"><span class="timeline-node" aria-hidden="true">${icon(e.type)}</span><div class="event-card ${e.highlight?'highlight':''}"><span class="event-time">${esc(readableTime(e))}</span><h4 class="event-title">${esc(e.title)}</h4><p class="event-location">${esc(e.location)}</p><div class="event-controls"><span class="badge ${e.status}">${statuses[e.status]}</span><button type="button" class="edit-event" data-edit-event="${esc(e.id)}" aria-label="Edit ${esc(e.title)}">Edit</button></div><details class="event-more"><summary>Details${e.map||e.query?' & directions':''}</summary><p class="event-note">${esc(e.note)}</p>${eventActions(e)}</details></div></article>`).join(''):'<p class="empty-day">A little room to wander. Add an event to start this day’s plan.</p>';
 const p=place(d.map);renderMapCard('#day-map',p);$('#day-map-name').textContent=p?.name||'No location selected';$('#day-map-area').textContent=p?.area||'Choose a location in Edit day.';$('#day-note-title').textContent=d.noteTitle;$('#day-note').textContent=d.note;
 $('#prev-day').disabled=index===0;$('#next-day').disabled=index===days.length-1;
 window.tripEditor?.dayChanged();
 if(scroll&&window.tripMotion){window.tripMotion.centerDay(index);return}
 if(scroll){const button=$('#date-strip').querySelector(`[data-day="${index}"]`);const strip=$('#date-strip');strip.scrollTo({left:button.offsetLeft-strip.offsetLeft-(strip.clientWidth-button.clientWidth)/2,behavior:tripScrollBehavior()});}
}
const reservations=[
{id:'hotel',title:'The Westin Bonaventure Hotel & Suites',subtitle:'20–28 December · 8 nights · 2 guests',status:'booked',icon:'hotel',details:[['Check-in','20 December 2026 · time to add'],['Check-out','28 December 2026 · time to add'],['Address',places[0].address],['Booking reference','To add']],note:'Confirmed stay. Room type and any additional booking details can be added later.',map:'hotel',source:places[0].source},
{id:'outbound',title:'Melbourne → Los Angeles',subtitle:'20 December · United Airlines · UA99',status:'plan',icon:'plane',details:[['Flight','UA99 · United Airlines'],['Departure','20 December · MEL local time'],['Flight times','To confirm from your ticket'],['Booking reference','To add']],note:'Latest flight details supplied by you. Ticket, seat and terminal information has not been added.',source:'https://www.united.com/'},
{id:'clippers',title:'LA Clippers vs Golden State Warriors',subtitle:'23 December · 7:30 pm PST · Intuit Dome',status:'plan',icon:'ball',details:[['Date & time','23 December 2026 · 7:30 pm PST'],['Venue','Intuit Dome, Inglewood'],['Section & seats','To add'],['Tickets / booking reference','To add']],note:'Time carried over from your itinerary. Check the final ticket for event and entry details.',map:'intuit',source:places[3].source},
{id:'lakers',title:'Los Angeles Lakers vs Philadelphia 76ers',subtitle:'25 December · 2:00 pm PST · Crypto.com Arena',status:'plan',icon:'ball',details:[['Date & time','25 December 2026 · 2:00 pm PST'],['Venue','Crypto.com Arena, Los Angeles'],['Section & seats','To add'],['Tickets / booking reference','To add']],note:'Time matches your Christmas game calendar plan. Doors and other ticket details have not been added.',map:'crypto',source:places[4].source},
{id:'inbound',title:'Los Angeles → Melbourne',subtitle:'28 December · Delta Air Lines · DL11',status:'plan',icon:'plane',details:[['Flight','DL11 · Delta Air Lines'],['Departure','28 December · LA local time'],['Melbourne arrival date & time','To confirm from your ticket'],['Booking reference','To add']],note:'28 December is treated as the departure date from LA. Exact times, seats and terminal are still to add.',source:'https://www.delta.com/'}
];
function renderReservations(){
 const open=new Set([...document.querySelectorAll('.reservation[open]')].map(el=>el.id));
 $('#reservation-list').innerHTML=reservations.map(r=>`<article class="booking-record"><div class="booking-edit"><button type="button" class="edit-event" data-edit-booking="${esc(r.id)}" aria-label="Edit booking: ${esc(r.title)}">Edit booking</button></div><details data-motion-disclosure class="reservation" id="reservation-${esc(r.id)}" ${open.has('reservation-'+r.id)||r.id==='hotel'?'open':''}><summary><span class="event-icon">${icon(r.icon)}</span><div class="reservation-text"><h3>${esc(r.title)}</h3><p>${esc(r.subtitle)}</p></div><span class="badge ${r.status}">${statuses[r.status]}</span><span class="chevron">${icon('right')}</span></summary><div class="reservation-body"><dl>${r.details.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="detail-note">${esc(r.note)}</p><div class="event-actions">${place(r.map)?mapActionLink(place(r.map).query):''}${r.source?`<a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">Website ${icon('external')}</a>`:''}</div></div></details></article>`).join('')||'<p class="empty-day">No bookings yet. Add your first booking above.</p>';
 const pending=days.flatMap(d=>d.events.filter(e=>e.status==='proposed'&&['film','plane'].includes(e.type)).map(e=>({event:e,date:d.date}))).slice(0,3);
 $('#pending-heading').hidden=!pending.length;
 $('#pending-plans').innerHTML=pending.map(({event:e,date})=>`<article class="pending-card"><span class="badge proposed">Proposed</span><p class="eyebrow">${date} DEC</p><h4>${esc(e.title)}</h4><p>${esc(e.note)}</p><button class="button secondary" data-jump-day="${date}">See proposed day ${icon('right')}</button></article>`).join('');
}
function renderPlaces(){
 $('#place-list').innerHTML=places.map((p,i)=>`<div class="location-record"><button class="place-button" data-place="${esc(p.id)}" aria-pressed="false"><span class="place-number">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.area)}</small></span></button><button type="button" class="edit-event" data-edit-location="${esc(p.id)}" aria-label="Edit location: ${esc(p.name)}">Edit</button></div>`).join('')||'<p class="empty-day">No saved locations. Add a location to see it on the map.</p>';
}
function selectPlace(id){
 const p=place(id);selectedPlace=p?.id||'';
 document.querySelectorAll('[data-place]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.place===selectedPlace)));
 renderMapCard('#large-map',p);
 $('#map-title').textContent=p?.full||'Your map starts here';$('#map-category').textContent=p?.category||'';$('#map-address').textContent=p?.address||'Add a location to get directions and plan your stops.';
 for(const selector of ['#map-open','#map-source','#map-directions'])$(selector).hidden=!p;
 $('#map-day-jump').hidden=!p?.day;
 if(p?.day)$('#map-day-jump').dataset.jumpDay=String(p.day);else $('#map-day-jump').removeAttribute('data-jump-day');
 if(!p)return;
 setMapLink('#map-open',p.query);$('#map-source').hidden=!p.source;$('#map-source').href=p.source||'#';
 const hotel=place('hotel');$('#map-directions').hidden=p.id==='hotel'||p.id==='sf';
 $('#map-directions').textContent=hotel?'Directions from hotel':'Directions';
 setMapLink('#map-directions',p.query,'directions',hotel?.query||'');
}
const defaultPacking=[
{id:'passport',group:'Travel essentials',label:'Passport & travel documents'},
{id:'bookings',group:'Travel essentials',label:'Flight, hotel & ticket confirmations'},
{id:'insurance',group:'Travel essentials',label:'Travel insurance details'},
{id:'wallet',group:'Travel essentials',label:'Wallet & payment cards'},
{id:'meds',group:'Travel essentials',label:'Personal medicines'},
{id:'tees',group:'Clothes & layers',label:'T-shirts & long-sleeve tops'},
{id:'knits',group:'Clothes & layers',label:'Jumpers or a hoodie'},
{id:'jacket',group:'Clothes & layers',label:'Warm jacket & light rain layer'},
{id:'trousers',group:'Clothes & layers',label:'Jeans or trousers'},
{id:'basics',group:'Clothes & layers',label:'Underwear, socks & sleepwear'},
{id:'dinner',group:'Clothes & layers',label:'An outfit for dinners'},
{id:'shoes',group:'Days out',label:'Comfortable walking shoes'},
{id:'daybag',group:'Days out',label:'Small day bag'},
{id:'sunnies',group:'Days out',label:'Sunglasses & sunscreen'},
{id:'hat',group:'Days out',label:'Cap or beanie'},
{id:'jersey',group:'Days out',label:'Game-day outfit'},
{id:'phone',group:'Tech & toiletries',label:'Phone & charging cable'},
{id:'adapter',group:'Tech & toiletries',label:'US plug adaptor'},
{id:'power',group:'Tech & toiletries',label:'Power bank'},
{id:'headphones',group:'Tech & toiletries',label:'Headphones'},
{id:'camera',group:'Tech & toiletries',label:'Camera & charger, if bringing one'},
{id:'toiletries',group:'Tech & toiletries',label:'Toiletries & skincare'}
];
const storageKey='mario-la-dec2026-packing-v1';let packing=defaultPacking.map(p=>({...p,checked:false}));let storageAvailable=true;
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&typeof saved==='object'){packing=packing.map(p=>({...p,checked:saved.checked?.[p.id]===true}));if(Array.isArray(saved.custom))for(const p of saved.custom.slice(0,100)){if(p&&typeof p.id==='string'&&p.id.startsWith('custom-')&&typeof p.label==='string'&&p.label.trim()&&!packing.some(x=>x.id===p.id))packing.push({id:p.id,group:'Your additions',label:p.label.slice(0,100),checked:p.checked===true,custom:true})}}}catch{storageAvailable=false}
function updateStorageNotice(){
 $('#storage-note').innerHTML=storageAvailable?`${icon('device')}Checklist changes save on this device. They don’t sync between devices.`:`${icon('device')}Changes are available for this visit only; saving on this device is unavailable.`;
 $('#peek-storage-note').textContent=storageAvailable?'Saved on this device':'This visit only';
}
function savePacking(){try{localStorage.setItem(storageKey,JSON.stringify({checked:Object.fromEntries(packing.filter(p=>!p.custom).map(p=>[p.id,p.checked])),custom:packing.filter(p=>p.custom).map(({id,label,checked})=>({id,label,checked}))}));storageAvailable=true}catch{storageAvailable=false}updateStorageNotice()}
function renderPacking(){const groups=[...new Set(packing.map(p=>p.group))];$('#packing-groups').innerHTML=groups.map(g=>{const items=packing.filter(p=>p.group===g);return `<section class="packing-group"><h3>${esc(g)}<span>${items.filter(p=>p.checked).length} / ${items.length}</span></h3>${items.map(p=>`<div class="packing-row"><label><input type="checkbox" data-pack-id="${esc(p.id)}" ${p.checked?'checked':''}><span>${esc(p.label)}</span></label>${p.custom?`<button data-remove-pack="${esc(p.id)}" aria-label="Remove ${esc(p.label)}">${icon('trash')}</button>`:''}</div>`).join('')}</section>`}).join('');renderPackingPeek();updatePackingCounts();updateStorageNotice()}
function updatePackingCounts(){
 const count=packing.filter(p=>p.checked).length;
 $('#packing-counter').textContent=`${count} of ${packing.length} packed`;$('#packing-percent').textContent=`${Math.round(count/packing.length*100)}%`;$('#packing-progress').max=packing.length;$('#packing-progress').value=count;$('#packing-fill').style.transform=`scaleX(${packing.length ? count/packing.length : 0})`;$('#nav-pack-count').textContent=String(count);$('#peek-packing-count').textContent=`${count} / ${packing.length} packed`;
 document.querySelectorAll('.packing-group').forEach((el,i)=>{const group=[...new Set(packing.map(p=>p.group))][i];const items=packing.filter(p=>p.group===group);el.querySelector('h3>span').textContent=`${items.filter(p=>p.checked).length} / ${items.length}`});
 document.querySelectorAll('[data-pack-id]').forEach(el=>{const item=packing.find(p=>p.id===el.dataset.packId);if(item)el.checked=item.checked});
}
function setPackingItems(updates){if(!Array.isArray(updates)||!updates.length||updates.some(u=>!u||typeof u.id!=='string'||typeof u.checked!=='boolean'||!packing.some(p=>p.id===u.id)))throw new Error('Each update must contain a known item id and a boolean checked value.');for(const u of updates)packing.find(p=>p.id===u.id).checked=u.checked;savePacking();renderPacking();return {packed:packing.filter(p=>p.checked).length,total:packing.length,savedOnDevice:storageAvailable}}
const views=['itinerary','reservations','maps','packing'];
function showView(name,updateHash=true){
 if(!views.includes(name))name='itinerary';
 const changed=document.body.dataset.view!==name;
 document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==name);
 document.querySelectorAll('.main-nav [data-view]').forEach(el=>{if(el.dataset.view===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 document.body.dataset.view=name;
 if(updateHash){history.replaceState(null,'',`#${name}`);if(name!=='itinerary')$('#main').scrollIntoView({block:'start',behavior:'auto'})}
 if(document.activeElement?.closest('.view[hidden]'))$('#main').focus({preventScroll:true});
 window.tripMotion?.viewChanged(name,changed);
}
function tripScroll(el,block='center'){el.scrollIntoView({behavior:tripScrollBehavior(),block})}
document.addEventListener('click',e=>{
 const provider=e.target.closest('button[data-map-provider]');if(provider){chooseMapProvider(provider.dataset.mapProvider);return}
 const nav=e.target.closest('a[data-view], button[data-view]');if(nav){e.preventDefault();showView(nav.dataset.view);return}
 const d=e.target.closest('[data-day]');if(d){selectDay(Number(d.dataset.day),true);return}
 const r=e.target.closest('[data-reservation]');if(r){showView('reservations');const details=$(`#reservation-${r.dataset.reservation}`);if(!details)return;details.open=true;details.querySelector('summary').focus();tripScroll(details);return}
 const j=e.target.closest('[data-jump-day]');if(j){showView('itinerary');selectDay(days.findIndex(d=>d.date===Number(j.dataset.jumpDay)),true);tripScroll($('#day-title'));return}
 const peek=e.target.closest('[data-open-map]');if(peek){showView('maps');selectPlace(peek.dataset.openMap);return}
 const p=e.target.closest('[data-place]');if(p){selectPlace(p.dataset.place);return}
 const remove=e.target.closest('[data-remove-pack]');if(remove){packing=packing.filter(p=>p.id!==remove.dataset.removePack||!p.custom);savePacking();renderPacking();$('#new-packing').focus();$('#packing-feedback').textContent='Item removed.'}
});
$('#prev-day').addEventListener('click',()=>selectDay(Math.max(0,selectedDay-1),true));$('#next-day').addEventListener('click',()=>selectDay(Math.min(days.length-1,selectedDay+1),true));
document.addEventListener('change',e=>{if(e.target.matches('[data-pack-id]')){const item=packing.find(p=>p.id===e.target.dataset.packId);if(item){item.checked=e.target.checked;savePacking();updatePackingCounts()}}});
$('#add-packing').addEventListener('submit',e=>{e.preventDefault();const input=$('#new-packing');const label=input.value.trim();if(!label){input.setCustomValidity('Enter an item to add.');input.reportValidity();return}if(packing.some(p=>p.label.toLowerCase()===label.toLowerCase())){$('#packing-feedback').textContent='That item is already on your list.';return}const id=`custom-${typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}`;packing.push({id,group:'Your additions',label,checked:false,custom:true});savePacking();renderPacking();input.value='';input.focus();$('#packing-feedback').textContent=`Added “${label}”.`});$('#new-packing').addEventListener('input',e=>e.target.setCustomValidity(''));
window.addEventListener('hashchange',()=>showView(location.hash.slice(1),false));
injectIcons();selectDay(0);renderReservations();renderReservationPeek();renderPlaces();renderPlacesPeek();selectPlace('hotel');renderPacking();refreshMapPreference();showView(location.hash.slice(1)||'itinerary',false);
$('#strip-prev').addEventListener('click',()=>window.tripMotion?window.tripMotion.browseDays(-1):$('#date-strip').scrollBy({left:-280,behavior:tripScrollBehavior()}));
$('#strip-next').addEventListener('click',()=>window.tripMotion?window.tripMotion.browseDays(1):$('#date-strip').scrollBy({left:280,behavior:tripScrollBehavior()}));
// Optional WebMCP enhancement shares the visible itinerary and packing state.
const modelContext=document.modelContext;const lifecycle=new AbortController();
if(modelContext?.registerTool){const definitions=[
{name:'read_trip_itinerary',title:'Read LA trip',description:'Read the current device-local itinerary, including user edits, and separate booking records; this does not verify or book reservations.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({dates:'20–28 December 2026',timeZone:'America/Los_Angeles',days:days.map(({date,title,events})=>({date,title,events})),reservations})},
{name:'read_packing_list',title:'Read packing list',description:'Read the device-local packing checklist and its item identifiers.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({items:packing.map(p=>({...p})),savedOnDevice:storageAvailable})},
{name:'update_packing_items',title:'Update packing checks',description:'Check or uncheck known packing items in the visible checklist. Saves only on this device, with no cross-device sync.',inputSchema:{type:'object',properties:{updates:{type:'array',minItems:1,items:{type:'object',properties:{id:{type:'string'},checked:{type:'boolean'}},required:['id','checked'],additionalProperties:false}}},required:['updates'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='updates'))throw new Error('Expected only an updates array.');const result=setPackingItems(input.updates);showView('packing');return result}}
];for(const definition of definitions){try{Promise.resolve(modelContext.registerTool(definition,{signal:lifecycle.signal})).catch(()=>{})}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true})}
