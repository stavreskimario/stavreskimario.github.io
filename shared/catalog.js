'use strict';
(async () => {
 const list = document.querySelector('#apps');
 const status = document.querySelector('#catalog-status');
 const localPath = value => typeof value === 'string' && /^\.\/[a-z0-9][a-z0-9/_.-]*$/.test(value) && !value.split('/').includes('..');
 const element = (tag, className, text) => { const el = document.createElement(tag); el.className = className; if (text !== undefined) el.textContent = text; return el; };
 try {
  const response = await fetch('./apps.json', {cache:'no-cache'});
  if (!response.ok) throw new Error('Cannot load collection');
  const data = await response.json();
  const ids = new Set();
  if (data.version !== 1 || !Array.isArray(data.apps)) throw new Error('Invalid collection');
  const cards = data.apps.map((app, index) => {
   if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app.id) || ids.has(app.id) || app.path !== `./${app.id}/` || !localPath(app.path) || ![app.name,app.description,app.category].every(value => typeof value === 'string' && value.trim()) || (app.image && !localPath(app.image))) throw new Error('Invalid app entry');
   ids.add(app.id);
   const card = element('a','project'); card.href = app.path; card.setAttribute('aria-label',`Open ${app.name}`);
   const visual = element('div',app.image ? 'photo' : 'specimen');
   if (app.image) {
    const image = document.createElement('img'); image.src = app.image; image.alt = app.imageAlt || ''; image.width = 1200; image.height = 600; image.loading = index ? 'lazy' : 'eager'; visual.append(image);
    if (app.meta) visual.append(element('span','',app.meta));
   } else { visual.textContent = app.specimen || app.name; visual.setAttribute('aria-hidden','true'); }
   const copy = element('div','copy');
   copy.append(element('span','category',`${app.category} · ${String(index+1).padStart(2,'0')}`),element('h2','',app.name),element('p','',app.description));
   const open = element('span','open','Open app '), arrow = element('span','arrow','→'); arrow.setAttribute('aria-hidden','true'); open.append(arrow); copy.append(open); card.append(visual,copy); return card;
  });
  list.replaceChildren(...cards);
  status.textContent = cards.length ? '' : 'No apps published yet.';
 } catch {
  // Keep working static links if JSON is unavailable; never replace the page with a blank grid.
  status.textContent = 'Showing the saved collection. Refresh to try loading the latest apps.';
 }
})();
