'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const sourceURL = 'https://www.sportsbet.com.au/betting/politics/vic-politics/victorian-state-election-seat-betting-10944986';
 const colours = {Labor:'#ac5548',Liberal:'#426b88',Nationals:'#8b7044',Greens:'#5b7d5e','One Nation':'#c28b3e',Independent:'#82719a',Tied:'#9e988c',Unknown:'#d1c9bc'};
 const key = v => String(v||'').toLowerCase().normalize('NFKD').replace(/\b(district|electoral)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const family = value => value.startsWith('Independent') ? 'Independent' : (value==='Liberals' ? 'Liberal' : value);
 const sorted = market => [...market.odds].sort((a,b) => a.decimal-b.decimal);
 const leader = market => {
  if (!market || !market.odds || !market.odds.length) return 'Unknown';
  const offers=sorted(market);
  return offers.length>1 && Math.abs(offers[0].decimal-offers[1].decimal)<0.0001 ? 'Tied' : family(offers[0].party);
 };
 const tight = market => { const offers=sorted(market); return offers.length>1 && offers[1].decimal-offers[0].decimal<=.500001; };
 const fixed = price => Number(price).toFixed(2);
 const dotClass = party => party==='One Nation' ? 'OneNation' : party;
 const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let markets=[],byName=new Map(),selected='',map=null,view='state',partyFilter='All';
 const showStatus = (message,permanent=false) => { const box=$('map-loading');box.textContent=message;box.hidden=!message;if(permanent)box.classList.add('failed'); };
 function setSelected(name,zoom) {
  const market=byName.get(key(name));if(!market)return;
  selected=market.name;
  $('seat-title').textContent=market.name;
  const fav=leader(market),ranked=sorted(market);
  $('seat-summary').textContent = fav==='Tied' ? 'Joint favourites at '+fixed(ranked[0].decimal)+'. A tied price is not a race call.' : (fav==='Unknown' ? 'No quoted odds currently in this snapshot.' : fav+' has the shortest quoted price at '+fixed(ranked[0].decimal)+'.');
  const holder=$('seat-offers');holder.replaceChildren();
  ranked.forEach((offer,i)=>{
   const row=document.createElement('div');row.className='offer'+(offer.decimal===ranked[0].decimal?' favorite':'');
   const label=document.createElement('span');label.className='offer-label';
   const dot=document.createElement('i');dot.className='party-dot '+dotClass(family(offer.party));dot.setAttribute('aria-hidden','true');
   const nameNode=document.createElement('span');nameNode.textContent=offer.party;
   label.append(dot,nameNode);
   const price=document.createElement('strong');price.className='offer-price';price.textContent=fixed(offer.decimal);
   row.append(label,price);holder.append(row);
  });
  $('seat-caption').textContent='Published selections as captured 9 November 2026. Some markets have additional selections behind Sportsbet’s “Show All” control. Prices are not live and can change.';
  document.querySelectorAll('.district-button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.seat===name)));
  restyle();
  map?.select(market.name,Boolean(zoom));
 }
 function renderDirectory(){
  const search=key($('seat-search').value),matchParty = market => partyFilter==='All'||leader(market)===partyFilter;
  const filtered=markets.filter(m=>key(m.name).includes(search)&&matchParty(m));
  const directory=$('seat-directory');directory.replaceChildren();
  filtered.forEach(m=>{
   const btn=document.createElement('button');btn.type='button';btn.className='district-button';btn.dataset.seat=m.name;btn.setAttribute('aria-pressed',String(selected===m.name));btn.setAttribute('aria-label',m.name+', shortest odds '+fixed(sorted(m)[0].decimal)+', '+leader(m));
   const label=document.createElement('span');label.className='district-label';
   const dot=document.createElement('i');dot.className='party-dot '+dotClass(leader(m));dot.setAttribute('aria-hidden','true');
   const name=document.createElement('span');name.className='seat-name';name.textContent=m.name;
   const odds=document.createElement('span');odds.className='district-odds';odds.textContent=fixed(sorted(m)[0].decimal);
   label.append(dot,name);btn.append(label,odds);
   btn.addEventListener('click',()=>{setSelected(m.name,true);if(window.matchMedia('(max-width:800px)').matches)$('detail').scrollIntoView({block:'start',behavior:'auto'});});
   directory.append(btn);
  });
  $('list-count').textContent=filtered.length+' of '+markets.length+' electorates';
  $('list-empty').hidden=Boolean(filtered.length);
 }
 function restyle(){map?.updateFilter(partyFilter);}
 function createMap(data){
  if(!window.ElectorateAtlas)throw Error('Local map renderer unavailable');
  map=window.ElectorateAtlas.mount({
   container:$('map'),
   features:data.features,
   onSelect:name=>setSelected(name,false),
   getLeader:name=>leader(byName.get(key(name))),
   getLabel:name=>{
    const market=byName.get(key(name));
    if(!market)return name;
    return name+' · '+(leader(market)==='Tied'?'tied favourites':leader(market)+' '+fixed(sorted(market)[0].decimal));
   }
  });
  map.select(selected,false);
  map.updateFilter(partyFilter);
  map.frame(view);
  showStatus('');
 }
 async function loadBoundaries(){
  const res=await fetch('./electorates.geojson',{cache:'force-cache'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const data=await res.json();
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==88)throw Error('Expected exactly 88 local electorate polygons');
  return data;
 }
 async function boot(){
  $('seat-search').addEventListener('input',renderDirectory);
  $('clear-search').addEventListener('click',()=>{$('seat-search').value='';renderDirectory();$('seat-search').focus();});
  $('party-filter').addEventListener('change',event=>{partyFilter=event.target.value;renderDirectory();restyle();});
  const controls=document.querySelector('.map-controls');
  const pill=window.SiteUI?new SiteUI.SelectionPill(controls,'[aria-pressed="true"]'):null;
  controls.addEventListener('click',event=>{
   const button=event.target.closest('button[data-zoom]');if(!button)return;
   view=button.dataset.zoom;
   controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   pill?.sync();
   map?.frame(view);
  });
  pill?.sync(true);
  if(pill&&window.ResizeObserver)new ResizeObserver(()=>pill.sync(true)).observe(controls);
  try{
   const response=await fetch('./odds.json',{cache:'no-cache'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!Array.isArray(data.markets)||data.markets.length!==88)throw Error('Expected exactly 88 electorates');
   markets=data.markets.sort((a,b)=>a.name.localeCompare(b.name,'en-AU'));
   byName=new Map(markets.map(m=>[key(m.name),m]));
   if(byName.size!==88)throw Error('Duplicate electorate names');
   $('market-count').textContent=markets.length;
   $('priced-count').textContent=markets.filter(m=>m.odds.length).length;
   $('tight-count').textContent=markets.filter(tight).length;
   $('capture-date').textContent=new Date(data.capturedDate+'T12:00:00+11:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Melbourne'});
   renderDirectory();
   setSelected('Melbourne',false);
   try{createMap(await loadBoundaries());}catch(error){console.warn(error);showStatus('Locally hosted boundary data could not load. Use the complete searchable list below.',true);}
  }catch(error){
   console.error(error);
   $('list-count').textContent='Market data unavailable';
   showStatus('Could not load the local odds snapshot. Refresh the page to try again.',true);
  }
 }
 boot();
})();