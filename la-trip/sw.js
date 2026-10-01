'use strict';
// Scope and cache names are LA-specific. Never cache maps, APIs, or other apps.
const BASE = new URL('./',self.location.href);
const PREFIX = 'la-trip-' + encodeURIComponent(BASE.pathname) + '-';
const VERSION = PREFIX + 'travel-1';
const CORE = ['./','./index.html','./styles.css?v=travel-1','./travel.css?v=travel-1','./travel-core.js?v=travel-1','./app.js?v=travel-1','./fluid.js?v=travel-1','./editor.js?v=travel-1','./documents.js?v=travel-1','./companion.js?v=travel-1','./manifest.webmanifest','./assets/la-skyline.jpg','./assets/westin-bonaventure.jpg','./assets/golden-gate-sunset.jpg'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(VERSION);await cache.addAll(CORE.map(path=>new Request(new URL(path,BASE),{cache:'reload'})));})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==VERSION)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='activate-update')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Navigation requests can retain the hash (for example #tools).
 url.hash='';
 if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 const known=(request.mode==='navigate'&&[BASE.pathname,BASE.pathname+'index.html'].includes(url.pathname))||CORE.some(path=>new URL(path,BASE).href===url.href);
 if(!known)return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  if(request.mode==='navigate'){
   try{const response=await fetch(request);if(response.ok)return response;throw new Error('offline');}
   catch{return await cache.match(new URL('./index.html',BASE)) || Response.error();}
  }
  return await cache.match(request) || fetch(request);
 })());
});
