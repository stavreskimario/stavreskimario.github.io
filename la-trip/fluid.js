'use strict';

// Progressive enhancement: trip data, links and native buttons live in app.js.
(() => {
 const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
 const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
 const activeSprings = new Set();
 let frame = 0, lastFrame = 0;

 // One display-synced clock. Exact spring solutions remain stable on slow frames.
 function tick(now) {
  const dt = Math.min((now - lastFrame) / 1000, .064);
  lastFrame = now;
  activeSprings.forEach(spring => spring.step(dt));
  frame = activeSprings.size ? requestAnimationFrame(tick) : 0;
 }
 function schedule(spring) {
  activeSprings.add(spring);
  if (!frame) { lastFrame = performance.now(); frame = requestAnimationFrame(tick); }
 }
 class Spring {
  constructor(value, render, response = .34, epsilon = .08) {
   this.value = this.target = value;
   this.velocity = 0;
   this.response = response;
   this.damping = 1;
   this.epsilon = epsilon;
   this.render = render;
  }
  get running() { return activeSprings.has(this); }
  stop() { activeSprings.delete(this); }
  set(value) {
   this.stop();
   this.value = this.target = value;
   this.velocity = 0;
   this.render(value);
  }
  to(target, {velocity, damping = 1} = {}) {
   this.target = target;
   this.damping = damping;
   // Retargets preserve presentation position AND velocity. Only a gesture supplies a new velocity.
   if (velocity !== undefined) this.velocity = velocity;
   if (!tripAllowsMotion()) return this.set(target);
   schedule(this);
  }
  step(dt) {
   const w = 2 * Math.PI / this.response;
   const displacement = this.value - this.target;
   const v = this.velocity;
   if (this.damping === 1) {
    const decay = Math.exp(-w * dt), c = v + w * displacement;
    this.value = this.target + (displacement + c * dt) * decay;
    this.velocity = (v - w * c * dt) * decay;
   } else {
    const a = this.damping * w, b = w * Math.sqrt(1 - this.damping ** 2);
    const decay = Math.exp(-a * dt), sine = Math.sin(b * dt), cosine = Math.cos(b * dt);
    const c = (v + a * displacement) / b;
    this.value = this.target + decay * (displacement * cosine + c * sine);
    this.velocity = decay * (v * cosine - (a * c + b * displacement) * sine);
   }
   if (Math.abs(this.value - this.target) < this.epsilon && Math.abs(this.velocity) < this.epsilon * 10) {
    this.value = this.target; this.velocity = 0; this.stop();
   }
   this.render(this.value);
  }
 }

 const pressSelector = 'button:not(:disabled), a[href], summary, .packing-row label, .peek-check';
 document.documentElement.dataset.fluidPress = 'true';
 const presses = new WeakMap();
 let press = null, canceledTap = null;
 function pressFeedback(el, down) {
  if (!el) return;
  el.classList.toggle('is-pressed', down);
  let spring = presses.get(el);
  if (!spring) {
   spring = new Spring(1, value => {
    el.style.scale = String(value);
    el.style.willChange = spring.running ? 'scale' : '';
   }, .19, .0002);
   presses.set(el, spring);
  }
  // Colour changes on pointer-down. Scale follows from the live spring value.
  spring.to(down && tripAllowsMotion() ? .975 : 1);
 }
 function endPress() {
  if (press) pressFeedback(press.el, false);
  press = null;
 }
 function withinPress(e, el) {
  const rect = el.getBoundingClientRect(), pad = 10;
  return e.clientX >= rect.left - pad && e.clientX <= rect.right + pad &&
   e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad;
 }
 document.addEventListener('pointerdown', e => {
  if (e.isPrimary === false || e.button !== 0) return;
  endPress(); canceledTap = null;
  const el = e.target.closest(pressSelector);
  if (el) { press = {el, id:e.pointerId}; pressFeedback(el, true); }
 }, {passive:true});
 document.addEventListener('pointermove', e => {
  if (press?.id === e.pointerId) pressFeedback(press.el, withinPress(e, press.el));
 }, {passive:true});
 document.addEventListener('pointerup', e => {
  if (press?.id !== e.pointerId) return;
  if (!withinPress(e, press.el)) canceledTap = press.el;
  endPress();
 }, {passive:true});
 document.addEventListener('pointercancel', endPress, {passive:true});
 document.addEventListener('click', e => {
  if (canceledTap && e.detail !== 0 && canceledTap.contains(e.target)) {
   e.preventDefault(); e.stopImmediatePropagation(); canceledTap = null;
  }
 }, true);
 document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
   const el = e.target.closest(pressSelector);
   if (el) { endPress(); press = {el, id:'keyboard'}; pressFeedback(el, true); }
  }
 });
 document.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') endPress(); });
 document.addEventListener('focusout', () => { if (press?.id === 'keyboard') endPress(); });
 window.addEventListener('blur', endPress);

 const project = velocity => (velocity / 1000) * .998 / (1 - .998);
 const rubberband = (distance, dimension) => distance * dimension * .55 / (dimension + .55 * Math.abs(distance));
 const strip = document.querySelector('#date-strip');
 const rail = document.createElement('div');
 rail.className = 'date-rail';
 while (strip.firstChild) rail.append(strip.firstChild);
 strip.append(rail);
 strip.classList.add('fluid-strip');
 let maximum = 0, snapPoints = [], gesture = null, suppressClick = false;
 const scroll = new Spring(0, value => {
  rail.style.transform = `translate3d(${-value}px,0,0)`;
  rail.style.willChange = scroll.running || gesture?.dragging ? 'transform' : '';
  strip.dataset.edge = value < 1 ? 'start' : value > maximum - 1 ? 'end' : 'middle';
 }, .38);
 const buttons = () => [...rail.querySelectorAll('[data-day]')];
 function dayPosition(button) { return clamp(button.offsetLeft + (button.offsetWidth - strip.clientWidth) / 2, 0, maximum); }
 function measureStrip() {
  if (!strip.clientWidth) return;
  const cards = buttons(), last = cards[cards.length - 1];
  maximum = Math.max(0, last.offsetLeft + last.offsetWidth - strip.clientWidth);
  snapPoints = [...new Set([0, ...cards.map(dayPosition), maximum])];
  if (!gesture) scroll.set(dayPosition(rail.querySelector('[aria-pressed="true"]') || cards[0]));
 }
 function springTo(position, velocity, momentum = false) {
  scroll.to(clamp(position, 0, maximum), {velocity, damping:momentum ? .8 : 1});
 }
 function centerDay(index) {
  const button = rail.querySelector(`[data-day="${index}"]`);
  if (button) springTo(dayPosition(button));
 }
 function sample(position, time) {
  const recent = gesture.history, last = recent[recent.length - 1], previous = recent[recent.length - 2];
  // A last-moment reversal should land in the new direction, not average in the old flick.
  if (previous && (last.position - previous.position) * (position - last.position) < 0) gesture.history = [last];
  gesture.history.push({position, time});
  gesture.history = gesture.history.filter(item => time - item.time <= 100).slice(-8);
 }
 function releaseVelocity(time) {
  const history = gesture.history;
  if (history.length < 2 || time - history[history.length - 1].time > 80) return 0;
  const first = history[0], last = history[history.length - 1];
  return last.time > first.time ? (last.position - first.position) / (last.time - first.time) * 1000 : 0;
 }
 function releaseCapture(id) { if (strip.hasPointerCapture?.(id)) strip.releasePointerCapture(id); }
 function finishGesture(e, canceled = false) {
  if (!gesture || e.pointerId !== gesture.id) return;
  const wasDragging = gesture.dragging;
  const velocity = canceled ? 0 : releaseVelocity(e.timeStamp);
  const id = gesture.id;
  gesture = null;
  strip.classList.remove('is-dragging');
  releaseCapture(id);
  if (wasDragging) {
   suppressClick = true;
   const endpoint = scroll.value + (motionPreference.matches ? 0 : project(velocity));
   const target = snapPoints.reduce((nearest, point) => Math.abs(point - endpoint) < Math.abs(nearest - endpoint) ? point : nearest, snapPoints[0] || 0);
   // A cancellation settles where it is; only an actual flick carries momentum.
   springTo(canceled ? scroll.value : target, velocity, !canceled && Math.abs(velocity) > 40);
  } else springTo(scroll.value, 0);
 }
 strip.addEventListener('pointerdown', e => {
  if (e.isPrimary === false || e.button !== 0 || gesture) return;
  suppressClick = false;
  scroll.stop();
  gesture = {id:e.pointerId, x:e.clientX, y:e.clientY, start:scroll.value, dragging:false, history:[]};
  sample(scroll.value, e.timeStamp);
 }, {passive:true});
 strip.addEventListener('pointermove', e => {
  if (!gesture || e.pointerId !== gesture.id) return;
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  if (!gesture.dragging) {
   if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
   if (Math.abs(dy) >= Math.abs(dx)) { finishGesture(e, true); endPress(); return; }
   gesture.dragging = true;
   strip.setPointerCapture(e.pointerId);
   strip.classList.add('is-dragging');
   endPress();
  }
  e.preventDefault();
  const position = gesture.start - dx;
  const limit = clamp(position, 0, maximum);
  const visible = motionPreference.matches ? limit : limit + rubberband(position - limit, strip.clientWidth);
  scroll.set(visible);
  sample(visible, e.timeStamp);
 }, {passive:false});
 strip.addEventListener('pointerup', e => finishGesture(e));
 strip.addEventListener('pointercancel', e => finishGesture(e, true));
 strip.addEventListener('lostpointercapture', e => {
  // Touch starts with implicit capture on a child. Its bubbling capture-loss
  // event is the handoff to this strip, not a cancellation of the drag.
  if (e.target === strip) finishGesture(e, true);
 });
 // Mouse releases can occur outside the rail before direction recognition/capture.
 window.addEventListener('pointerup', e => finishGesture(e));
 window.addEventListener('pointercancel', e => finishGesture(e, true));
 window.addEventListener('blur', () => { if (gesture) finishGesture({pointerId:gesture.id, timeStamp:performance.now()}, true); });
 strip.addEventListener('click', e => {
  if (suppressClick && e.detail !== 0) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; }
 }, true);
 strip.addEventListener('dragstart', e => e.preventDefault());
 strip.addEventListener('wheel', e => {
  const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
  if (!horizontal || gesture) return;
  e.preventDefault(); endPress();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? strip.clientWidth : 1;
  scroll.set(clamp(scroll.value + (e.deltaX || e.deltaY) * unit, 0, maximum));
 }, {passive:false});
 strip.addEventListener('keydown', e => {
  const button = e.target.closest('[data-day]');
  if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const index = Number(button.dataset.day);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons().length - 1 : clamp(index + (e.key === 'ArrowRight' ? 1 : -1), 0, buttons().length - 1);
  rail.querySelector(`[data-day="${next}"]`).focus({preventScroll:true});
  selectDay(next, true);
 });
 strip.addEventListener('focusin', e => {
  const button = e.target.closest('[data-day]');
  if (button && !gesture) centerDay(Number(button.dataset.day));
 });
 // Keep native focus scrolling from adding a second offset to the translated rail.
 strip.addEventListener('scroll', () => { if (strip.scrollLeft) strip.scrollLeft = 0; }, {passive:true});

 class SelectionPill {
  constructor(group, selected) {
   this.group = group; this.selected = selected;
   this.pill = document.createElement('span');
   this.pill.className = 'selection-pill'; this.pill.setAttribute('aria-hidden', 'true');
   group.prepend(this.pill); group.classList.add('fluid-choice');
   this.x = new Spring(0, () => this.draw());
   this.y = new Spring(0, () => this.draw());
   this.ready = false;
  }
  draw() {
   this.pill.style.transform = `translate3d(${this.x.value}px,${this.y.value}px,0)`;
   this.pill.style.willChange = this.x.running || this.y.running ? 'transform' : '';
  }
  sync(immediate = false) {
   const selected = this.group.querySelector(this.selected);
   if (!selected?.offsetWidth) return;
   this.pill.style.width = `${selected.offsetWidth}px`;
   this.pill.style.height = `${selected.offsetHeight}px`;
   const method = immediate || !this.ready ? 'set' : 'to';
   this.x[method](selected.offsetLeft); this.y[method](selected.offsetTop);
   this.ready = true;
  }
 }
 const choices = [new SelectionPill(document.querySelector('.main-nav'), '[aria-current="page"]'),
  ...[...document.querySelectorAll('.map-app-choice')].map(group => new SelectionPill(group, '[aria-pressed="true"]'))];
 // Day changes are frequent: render their content immediately, without a reveal.
 function syncChoices(immediate = false) { choices.forEach(choice => choice.sync(immediate)); }
 function refreshLayout() { measureStrip(); syncChoices(true); }
 window.tripMotion = {
  centerDay,
  browseDays: direction => springTo(scroll.target + direction * strip.clientWidth * .75),
  finishAnimations: () => {
   endPress();
   [...activeSprings].forEach(spring => spring.set(spring.target));
  },
  syncChoices,
  viewChanged: name => { if (name === 'itinerary') measureStrip(); syncChoices(); }
 };
 refreshLayout();
 if (window.ResizeObserver) {
  const observer = new ResizeObserver(refreshLayout);
  observer.observe(strip);
  choices.forEach(choice => observer.observe(choice.group));
 } else window.addEventListener('resize', refreshLayout, {passive:true});
 document.fonts?.ready.then(refreshLayout);
 motionPreference.addEventListener?.('change', () => {
  endPress();
  if (motionPreference.matches) [...activeSprings].forEach(spring => spring.set(spring.target));
  refreshLayout();
 });
 document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
   endPress();
   if (gesture) finishGesture({pointerId:gesture.id, timeStamp:performance.now()}, true);
   [...activeSprings].forEach(spring => spring.set(spring.target));
  }
 });
})();
