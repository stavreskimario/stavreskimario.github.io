'use strict';
(() => {
 const name = document.querySelector('#name');
 const title = document.querySelector('#greeting-title');
 const feedback = document.querySelector('#feedback');
 const group = document.querySelector('.segmented');
 let language = 0, style = 'simple', committedName = '';
 const greetings = [{hello:'Hello',world:'world',warm:'Lovely to see you.'},{hello:'Hola',world:'mundo',warm:'Qué alegría verte.'},{hello:'Ciao',world:'mondo',warm:'Che bello vederti.'}];
 const ui = window.SiteUI;
 const pill = ui ? new ui.SelectionPill(group,'[aria-pressed="true"]') : null;
 const reveal = ui ? new ui.Spring(1,value => { title.style.opacity = value; },.25,.001) : null;
 function render(message = '') {
  const greeting = greetings[language];
  title.textContent = `${greeting.hello}, ${committedName || greeting.world}${style === 'warm' ? '!' : '.'}`;
  feedback.textContent = message || (style === 'warm' ? greeting.warm : '');
  if (reveal) { if (!ui.motionPreference.matches && !reveal.running) reveal.set(.8); reveal.to(1); }
 }
 function chooseLanguage(index) { language = index; render(); }
 const rail = document.querySelector('#greeting-rail');
 const carousel = ui ? ui.mountRail(rail,chooseLanguage) : null;
 if (!carousel) rail.addEventListener('click',event => {
  const button = event.target.closest('button[data-slide]'); if (!button) return;
  rail.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed',String(el === button)));
  chooseLanguage(Number(button.dataset.slide));
 });
 group.addEventListener('click',event => {
  const button = event.target.closest('button[data-style]'); if (!button) return;
  style = button.dataset.style;
  group.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed',String(el === button)));
  pill?.sync(); render();
 });
 document.querySelector('#greeting-form').addEventListener('submit',event => {
  event.preventDefault(); committedName = name.value.trim(); render('Greeting updated.');
 });
 document.querySelector('#reset').addEventListener('click',() => {
  name.value = ''; committedName = ''; style = 'simple'; language = 0;
  group.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.style === style)));
  pill?.sync();
  if (carousel) carousel.choose(0);
  else rail.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.slide === '0')));
  render('Greeting reset.'); name.focus({preventScroll:true});
 });
 pill?.sync(true);
 if (pill) {
  if (window.ResizeObserver) new ResizeObserver(() => pill.sync(true)).observe(group);
  else window.addEventListener('resize',() => pill.sync(true),{passive:true});
  document.fonts?.ready.then(() => pill.sync(true));
 }
})();
