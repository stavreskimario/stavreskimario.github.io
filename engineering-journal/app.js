'use strict';
(() => {
  const KEY = 'mario-engineering-journal-v1';
  const TOPICS = {all:'All stories',ai:'AI & agents',architecture:'Architecture',data:'Data & ML',reliability:'Reliability',security:'Security',devtools:'Dev tools'};
  const TYPES = {'case-study':'Engineering story',research:'Research',tutorial:'Guide',announcement:'Technical update'};
  const $ = id => document.getElementById(id);
  let catalogue = {articles:[],sources:[]}, sourceMap = new Map(), entries = {}, storageAvailable = true;
  let visible = 30, pendingImport = null, filters = {view:'latest',q:'',topic:'all',companies:[],days:'all',type:'all',unread:false}, loaded = false;
  const scrollPositions = {};
  const renderedArticles = new WeakMap();
  const viewButtons = document.querySelector('.view-buttons');
  const viewIndicator = document.createElement('span');
  viewIndicator.className = 'view-indicator';
  viewIndicator.setAttribute('aria-hidden','true');
  viewButtons.append(viewIndicator);
  let indicatorWidth=0, indicatorHeight=0;
  function syncViewIndicator(immediate=false) {
    const selected = viewButtons.querySelector('[aria-pressed=true]');
    if (!selected?.offsetWidth) return;
    immediate=immediate||viewIndicator.dataset.indicatorView===selected.dataset.view||!viewIndicator.dataset.indicatorView;
    if (immediate) viewIndicator.style.transition = 'none';
    viewIndicator.style.transform = `translateX(${selected.offsetLeft}px) scaleX(${selected.offsetWidth})`;
    viewButtons.classList.add('has-indicator');
    viewIndicator.dataset.indicatorView=selected.dataset.view;
    indicatorWidth=viewButtons.offsetWidth;indicatorHeight=viewButtons.offsetHeight;
    if (immediate) { void viewIndicator.offsetWidth; viewIndicator.style.transition = ''; }
  }
  function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  function announce(text) { $('feedback').textContent = text; }
  function validUrl(value, sourceId) {
    try { const u = new URL(value), source = sourceMap.get(sourceId); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && source?.hosts.includes(u.hostname) ? u.href : null; } catch { return null; }
  }
  function cleanArticle(a) {
    if (!a || typeof a.id !== 'string' || !/^[a-f0-9]{24}$/.test(a.id) || !sourceMap.has(a.sourceId) || typeof a.title !== 'string' || !a.title.trim() || a.title.length > 500) return null;
    const url = validUrl(a.url, a.sourceId); if (!url) return null;
    return {id:a.id, sourceId:a.sourceId, title:a.title, url, excerpt:typeof a.excerpt === 'string' ? a.excerpt.slice(0,400) : '', topics:Array.isArray(a.topics) ? a.topics.filter(t => t !== 'all' && Object.hasOwn(TOPICS,t)).slice(0,4) : [], type:Object.hasOwn(TYPES,a.type) ? a.type : 'case-study', publishedAt:a.publishedAt && Number.isFinite(Date.parse(a.publishedAt)) ? a.publishedAt : null};
  }
  function parseEntries(raw) {
    if (!raw || raw.version !== 1 || !raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries) || Object.keys(raw.entries).length > 4000) throw new Error('Invalid reading-list format.');
    const out = {};
    for (const [id,e] of Object.entries(raw.entries)) {
      const article = cleanArticle(e?.article);
      if (!article || id !== article.id || typeof e.saved !== 'boolean' || typeof e.read !== 'boolean' || !Number.isFinite(e.changedAt)) throw new Error('The backup contains an invalid article.');
      out[id] = {article,saved:e.saved,read:e.read,changedAt:Math.min(e.changedAt,Date.now())};
    }
    return out;
  }
  function mergeEntries(a,b) { const out = {...a}; for (const [id,e] of Object.entries(b)) if (!out[id] || e.changedAt > out[id].changedAt) out[id] = e; return out; }
  function storageNotice() { storageAvailable = false; $('storage-notice').hidden = false; $('storage-notice').textContent = 'Browser storage is unavailable. Your reading list works for this visit; export it to keep a copy.'; }
  function loadEntries() {
    try { const raw = localStorage.getItem(KEY); if (raw) entries = parseEntries(JSON.parse(raw)); } catch { storageNotice(); }
  }
  function saveEntry(article, field) {
    if (storageAvailable) {
      try { const raw=localStorage.getItem(KEY); if(raw) entries=mergeEntries(entries,parseEntries(JSON.parse(raw))); } catch { storageNotice(); }
    }
    const current = entries[article.id] || {article,saved:false,read:false,changedAt:0};
    const changed = {...current,article,[field]:!current[field],changedAt:Math.max(Date.now(),current.changedAt+1)};
    entries[article.id] = changed;
    persist();
    render();
    announce(field === 'saved' ? (changed.saved ? 'Saved on this browser.' : 'Removed from your saved list.') : (changed.read ? 'Marked as read.' : 'Marked as unread.'));
  }
  function persist() { if (storageAvailable) try { localStorage.setItem(KEY, JSON.stringify({version:1,entries})); } catch { storageNotice(); } }
  function readFilters() {
    const p = new URLSearchParams(location.search);
    filters = {view:['latest','saved','sources'].includes(p.get('view')) ? p.get('view') : 'latest',q:(p.get('q') || '').slice(0,200),topic:Object.hasOwn(TOPICS,p.get('topic')) ? p.get('topic') : 'all',companies:(p.get('companies') || '').split(',').filter(id => sourceMap.has(id)),days:['7','30','90'].includes(p.get('days')) ? p.get('days') : 'all',type:Object.hasOwn(TYPES,p.get('type')) ? p.get('type') : 'all',unread:p.get('unread') === '1'};
  }
  function writeFilters(replace=false) {
    const p = new URLSearchParams();
    if (filters.view !== 'latest') p.set('view',filters.view);
    if (filters.q) p.set('q',filters.q);
    if (filters.topic !== 'all') p.set('topic',filters.topic);
    if (filters.companies.length) p.set('companies',filters.companies.join(','));
    if (filters.days !== 'all') p.set('days',filters.days);
    if (filters.type !== 'all') p.set('type',filters.type);
    if (filters.unread) p.set('unread','1');
    const suffix = p.toString(); history[replace?'replaceState':'pushState'](null,'',location.pathname+(suffix?'?'+suffix:''));
  }
  function updateFilters(replace=false) { visible=30;writeFilters(replace);render(); }
  function fmtDate(value) { return value ? new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value)) : 'Date unavailable'; }
  function fmtTime(value) { return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne',timeZoneName:'short'}).format(new Date(value)); }
  function icon() {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M6 3h12v18l-6-4-6 4V3Z');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.6');
    const fill=path.cloneNode();fill.setAttribute('fill','currentColor');fill.setAttribute('stroke','none');fill.classList.add('bookmark-fill');
    svg.append(fill,path);return svg;
  }
  function articleCard(a) {
    const source=sourceMap.get(a.sourceId), state=entries[a.id], card=node('article',undefined,'article');card.dataset.id=a.id;
    const meta=node('div',undefined,'article-meta');meta.append(node('span',source.mark,'publisher-mark'),node('span',source.name,'publisher-name'),node('span','·','meta-dot'));
    const time=node('time',fmtDate(a.publishedAt));if(a.publishedAt)time.dateTime=a.publishedAt;meta.append(time);
    if(state?.read)meta.append(node('span','Read','read-label'));
    const title=node('h3',undefined,'article-title'), link=node('a',a.title);link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',a.title+' — read original (opens in a new tab)');title.append(link);card.append(meta,title);
    if(a.excerpt)card.append(node('p',a.excerpt,'article-excerpt'));
    const bottom=node('div',undefined,'article-bottom'), tags=node('div',undefined,'article-tags');
    for(const topic of a.topics.slice(0,2))tags.append(node('span',TOPICS[topic],'tag'));
    if(a.type==='research'||a.type==='announcement')tags.append(node('span',TYPES[a.type],'tag'));
    const actions=node('div',undefined,'article-actions');
    const save=node('button');save.type='button';save.dataset.action='save';save.dataset.id=a.id;save.setAttribute('aria-pressed',String(!!state?.saved));save.setAttribute('aria-label',(state?.saved?'Unsave: ':'Save: ')+a.title);save.append(icon(),node('span',state?.saved?'Saved':'Save'));
    const read=node('button',state?.read?'✓ Read':'Mark read');read.type='button';read.dataset.action='read';read.dataset.id=a.id;read.setAttribute('aria-pressed',String(!!state?.read));read.setAttribute('aria-label',(state?.read?'Mark unread: ':'Mark read: ')+a.title);
    actions.append(read,save);bottom.append(tags,actions);card.append(bottom);renderedArticles.set(card,a);return card;
  }
  function updateArticleState(card,a) {
    const state=entries[a.id];
    const save=card.querySelector('[data-action=save]'),read=card.querySelector('[data-action=read]');
    save.setAttribute('aria-pressed',String(!!state?.saved));
    save.setAttribute('aria-label',(state?.saved?'Unsave: ':'Save: ')+a.title);
    save.querySelector('span').textContent=state?.saved?'Saved':'Save';
    read.setAttribute('aria-pressed',String(!!state?.read));
    read.setAttribute('aria-label',(state?.read?'Mark unread: ':'Mark read: ')+a.title);
    read.textContent=state?.read?'✓ Read':'Mark read';
    const label=card.querySelector('.read-label');
    if(state?.read&&!label)card.querySelector('.article-meta').append(node('span','Read','read-label'));
    else if(!state?.read)label?.remove();
  }
  function renderArticles(articles) {
    const list=$('reading-list'),existing=new Map([...list.children].map(el=>[el.dataset.id,el]));
    const cards=articles.map(a=>{
      const prior=existing.get(a.id);
      const card=prior&&renderedArticles.get(prior)===a?prior:articleCard(a);
      updateArticleState(card,a);return card;
    });
    const keep=new Set(cards);
    for(const child of [...list.children])if(!keep.has(child))child.remove();
    cards.forEach((card,i)=>{if(list.children[i]!==card)list.insertBefore(card,list.children[i]||null);});
  }
  function filteredArticles() {
    const all=filters.view==='saved' ? Object.values(entries).filter(e=>e.saved).map(e=>catalogue.articles.find(a=>a.id===e.article.id)||e.article) : catalogue.articles;
    const query=filters.q.trim().toLowerCase();
    return all.filter(a=>(!query||[a.title,a.excerpt,sourceMap.get(a.sourceId).name,...a.topics.map(t=>TOPICS[t])].join(' ').toLowerCase().includes(query)) && (!filters.companies.length||filters.companies.includes(a.sourceId)) && (filters.topic==='all'||a.topics.includes(filters.topic)) && (filters.type==='all'||a.type===filters.type) && (!filters.unread||!entries[a.id]?.read) && (filters.days==='all'||(a.publishedAt&&Date.parse(a.publishedAt)>=Date.now()-Number(filters.days)*86400000))).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)||a.title.localeCompare(b.title));
  }
  function restoreFocus(focus) {
    if(!focus)return;
    const match=[...$('reading-list').querySelectorAll('button')].find(el=>el.dataset.id===focus.id&&el.dataset.action===focus.action);
    (match || $('reading-list').querySelector('button') || $('list-title')).focus({preventScroll:true});
  }
  function render() {
    if(!loaded)return;
    const active=document.activeElement;
    const focus=active?.closest('#reading-list')&&active.dataset.action ? {id:active.dataset.id,action:active.dataset.action}:null;
    document.querySelectorAll('button[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===filters.view)));
    document.querySelector('.skip-link').href=filters.view==='sources'?'#sources-title':'#reading-list';
    $('reader').hidden=filters.view==='sources';$('sources-view').hidden=filters.view!=='sources';$('saved-tools').hidden=filters.view!=='saved';
    $('saved-count').textContent=Object.values(entries).filter(e=>e.saved).length;
    $('latest-count').textContent=catalogue.articles.length;
    syncViewIndicator();
    $('search').value=filters.q;$('date-range').value=filters.days;$('article-type').value=filters.type;$('unread-only').checked=filters.unread;
    document.querySelectorAll('#company-options input').forEach(c=>c.checked=filters.companies.includes(c.value));
    document.querySelectorAll('#topic-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===filters.topic)));
    const activeCount=filters.companies.length+(filters.days!=='all')+(filters.type!=='all')+Number(filters.unread);
    $('filter-count').textContent=activeCount?`(${activeCount})`:'';
    const matches=filteredArticles();$('result-count').textContent=matches.length+' '+(matches.length===1?'article':'articles');$('list-title').textContent=filters.view==='saved'?'For a quieter moment.':'The latest';
    if(matches.length)renderArticles(matches.slice(0,visible));
    else {
      $('reading-list').replaceChildren();
      const empty=node('div',undefined,'empty-state');empty.append(node('h3',filters.view==='saved'&&!Object.values(entries).some(e=>e.saved)?'Keep a good read for later.':'A different rabbit hole?'),node('p',filters.view==='saved'&&!Object.values(entries).some(e=>e.saved)?'Tap Save beside an article. Your list stays on this browser.':'No articles match these filters. Try another topic or clear your search.'));
      if(filters.q||activeCount||filters.topic!=='all'){const reset=node('button','Clear filters','button secondary');reset.type='button';reset.addEventListener('click',resetFilters);empty.append(reset);}
      $('reading-list').append(empty);
    }
    $('load-more').hidden=matches.length<=visible;$('reading-list').setAttribute('aria-busy','false');restoreFocus(focus);
  }
  function resetFilters() { const view=filters.view;filters={view,q:'',topic:'all',companies:[],days:'all',type:'all',unread:false};updateFilters();$('search').focus({preventScroll:true});announce('Filters cleared.'); }
  function renderSources() {
    $('source-list').replaceChildren();$('company-options').replaceChildren();
    for(const source of catalogue.sources){
      const count=catalogue.articles.filter(a=>a.sourceId===source.id).length;
      const label=node('label',undefined,'check-row'),checkbox=node('input');checkbox.type='checkbox';checkbox.value=source.id;checkbox.addEventListener('change',()=>{filters.companies=[...document.querySelectorAll('#company-options input:checked')].map(c=>c.value);updateFilters();});label.append(checkbox,node('span',source.name),node('span',String(count),'company-count'));$('company-options').append(label);
      const card=node('article',undefined,'source-card');card.append(node('span',source.mark,'publisher-mark'),node('h3',source.name),node('p',source.description));
      const state=node('p',source.status==='ok'?'Checked successfully':source.status==='error'?'Latest check unavailable':'First collection pending','source-state');state.dataset.state=source.status==='ok'?'ok':source.status==='error'?'unavailable':'pending';card.append(state);
      if(source.lastSuccessAt)card.append(node('p','Last success: '+fmtTime(source.lastSuccessAt)));
      card.append(node('p',`${count} ${count===1?'article':'articles'} · ${source.method==='rss'?'Official feed':'Official blog index'}`));
      const actions=node('div',undefined,'source-actions'),view=node('button','Browse articles');view.type='button';view.addEventListener('click',()=>{filters={view:'latest',q:'',topic:'all',companies:[source.id],days:'all',type:'all',unread:false};updateFilters();$('list-title').focus({preventScroll:true});});const link=node('a','Original blog ↗');link.href=source.homepage;link.target='_blank';link.rel='noopener noreferrer';actions.append(view,link);card.append(actions);$('source-list').append(card);
    }
  }
  function freshness() {
    if(catalogue.seed||!catalogue.lastPollAt){$('freshness').textContent='Starter reading list · daily collection starts after publishing is enabled.';$('freshness').dataset.stale='true';return;}
    const stale=Date.now()-Date.parse(catalogue.lastPollAt)>36*3600000, failed=catalogue.sources.filter(s=>s.status==='error').length;
    $('freshness').textContent=`Last checked ${fmtTime(catalogue.lastPollAt)}${stale?' · update overdue':''}${failed?` · ${failed} ${failed===1?'source unavailable':'sources unavailable'}`:''}. Next scheduled check: around 6 am Melbourne time.`;$('freshness').dataset.stale=String(stale||failed>0);
  }
  document.documentElement.dataset.input='keyboard';
  document.addEventListener('keydown',e=>{if(!['Shift','Control','Alt','Meta'].includes(e.key))document.documentElement.dataset.input='keyboard';},true);
  document.addEventListener('pointerdown',()=>document.documentElement.dataset.input='pointer',{capture:true,passive:true});
  document.addEventListener('click',e=>{if(e.detail===0)document.documentElement.dataset.input='keyboard';},true);
  document.addEventListener('visibilitychange',()=>document.documentElement.toggleAttribute('data-motion-paused',document.hidden));
  if(window.ResizeObserver)new ResizeObserver(()=>{if(viewButtons.offsetWidth!==indicatorWidth||viewButtons.offsetHeight!==indicatorHeight)syncViewIndicator(true);}).observe(viewButtons);
  else window.addEventListener('resize',()=>syncViewIndicator(true),{passive:true});
  document.fonts?.ready.then(()=>syncViewIndicator(true));
  document.querySelectorAll('button[data-view]').forEach(b=>b.addEventListener('click',()=>{if(!loaded)return;scrollPositions[filters.view]=scrollY;filters.view=b.dataset.view;visible=30;writeFilters();render();window.scrollTo({top:scrollPositions[filters.view]||0,behavior:'instant'});}));
  $('search').addEventListener('input',()=>{filters.q=$('search').value;updateFilters(true);});
  $('date-range').addEventListener('change',()=>{filters.days=$('date-range').value;updateFilters();});
  $('article-type').addEventListener('change',()=>{filters.type=$('article-type').value;updateFilters();});
  $('unread-only').addEventListener('change',()=>{filters.unread=$('unread-only').checked;updateFilters();});
  $('reset-filters').addEventListener('click',()=>loaded&&resetFilters());
  $('load-more').addEventListener('click',()=>{const first=visible;visible+=30;render();const next=$('reading-list').children[first]?.querySelector('a');next?.focus({preventScroll:true});announce('More articles loaded.');});
  $('reading-list').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const a=catalogue.articles.find(a=>a.id===b.dataset.id)||entries[b.dataset.id]?.article;if(a)saveEntry(a,b.dataset.action==='save'?'saved':'read');});
  $('export-saved').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,entries},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='engineering-journal-reading-list.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Reading list exported.');});
  $('import-saved').addEventListener('change',async()=>{
    const file=$('import-saved').files[0];if(!file)return;
    try {if(file.size>3000000)throw new Error('Choose a reading-list backup smaller than 3 MB.');pendingImport=parseEntries(JSON.parse(await file.text()));const count=Object.values(pendingImport).filter(e=>e.saved).length;$('import-description').textContent=`Merge ${count} saved ${count===1?'article':'articles'} and read status into this browser’s reading list? Existing saves will stay.`;$('import-dialog').showModal();}
    catch(e){announce('Could not import: '+e.message);$('storage-notice').hidden=false;$('storage-notice').textContent='Could not import this backup. Your current reading list has not changed.';}
    finally{$('import-saved').value='';}
  });
  $('cancel-import').addEventListener('click',()=>{$('import-dialog').close();pendingImport=null;});
  $('confirm-import').addEventListener('click',()=>{for(const [id,e] of Object.entries(pendingImport||{})){const old=entries[id];entries[id]={...e,saved:e.saved||!!old?.saved,read:e.read||!!old?.read,changedAt:Date.now()};}persist();pendingImport=null;$('import-dialog').close();render();announce('Reading list merged on this browser.');});
  $('import-dialog').addEventListener('close',()=>{if(!$('import-dialog').open){pendingImport=null;$('export-saved').focus();}});
  window.addEventListener('popstate',()=>{if(loaded){readFilters();visible=30;render();}});
  window.addEventListener('storage',e=>{if(e.key!==KEY||!loaded)return;try{entries=e.newValue?mergeEntries(entries,parseEntries(JSON.parse(e.newValue))):{};render();announce('Reading list updated from another tab.');}catch{announce('Could not read a change from another tab. Export your list before reloading.');}});
  if(matchMedia('(max-width:650px)').matches)$('filter-details').open=false;
  async function init(){
    try{
      const response=await fetch('./data/catalogue.json',{cache:'no-cache'});if(!response.ok)throw new Error('Catalogue unavailable');const data=await response.json();
      if(data.version!==1||!Array.isArray(data.sources)||!Array.isArray(data.articles)||data.articles.length>2500)throw new Error('Unsupported catalogue');
      catalogue=data;catalogue.sources=data.sources.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&Array.isArray(s.hosts)&&s.hosts.length&&typeof s.homepage==='string');sourceMap=new Map(catalogue.sources.map(s=>[s.id,s]));
      catalogue.sources=catalogue.sources.filter(s=>validUrl(s.homepage,s.id));sourceMap=new Map(catalogue.sources.map(s=>[s.id,s]));catalogue.articles=data.articles.map(cleanArticle).filter(Boolean);
      loadEntries();readFilters();renderSources();
      for(const [key,label] of Object.entries(TOPICS)){const b=node('button',label);b.type='button';b.dataset.topic=key;b.addEventListener('click',()=>{filters.topic=key;updateFilters();});$('topic-options').append(b);}
      loaded=true;freshness();render();
    }catch{
      $('freshness').textContent='The reading list could not be loaded. Please reload the page to try again.';
      $('reading-list').setAttribute('aria-busy','false');const box=node('div',undefined,'empty-state');box.append(node('h3','The journal is taking a moment.'),node('p','You can still read directly from the publishers.'));for(const [name,url] of [['Uber Engineering','https://www.uber.com/us/en/blog/engineering/'],['OpenAI','https://openai.com/news/engineering/'],['Anthropic','https://www.anthropic.com/engineering']]){const p=node('p'),a=node('a',name);a.href=url;p.append(a);box.append(p);}$('reading-list').replaceChildren(box);
    }
  }
  init();
})();
