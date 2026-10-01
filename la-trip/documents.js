'use strict';

// Files stay in this origin's IndexedDB, never in the public repository or an API.
window.TripDocuments = (() => {
 const MAX_FILE = 5 * 1024 * 1024, MAX_TOTAL = 20 * 1024 * 1024, MAX_COUNT = 40;
 let database;
 const allowed = ['application/pdf','image/png','image/jpeg','image/webp','text/plain'];
 const extensions = {'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain'};
 function uploadType(file) {
  // Some file pickers leave File.type empty or generic. Infer only at upload;
  // validate still checks binary signatures and backup records remain strict.
  if (file.type && file.type !== 'application/octet-stream' && file.type !== 'binary/octet-stream') return file.type;
  return extensions[file.name.slice(file.name.lastIndexOf('.')).toLowerCase()] || '';
 }
 function open() {
  if (database) return database;
  database = new Promise((resolve,reject) => {
   if (!window.indexedDB) { reject(new Error('File storage is unavailable in this browser.')); return; }
   const request = indexedDB.open('mario-la-dec2026-documents',1);
   request.onupgradeneeded = () => request.result.createObjectStore('files',{keyPath:'id'});
   request.onerror = () => reject(new Error('File storage is unavailable. Keep the original file.'));
   request.onblocked = () => reject(new Error('Close other trip tabs and try file storage again.'));
   request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); database = null; }; resolve(db); };
  }).catch(error => { database = null; throw error; });
  return database;
 }
 async function all() {
  const db = await open();
  return new Promise((resolve,reject) => {
   const tx = db.transaction('files','readonly'); const request = tx.objectStore('files').getAll();
   tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(new Error('Could not read your stored files.'));
  });
 }
 function bytes(data) { const binary = atob(data); return Uint8Array.from(binary, c => c.charCodeAt(0)); }
 function validate(record) {
  const r = {id:TripCore.id(record.id),name:TripCore.text(record.name,180,true),event:record.event ? TripCore.id(record.event) : '',eventTitle:TripCore.text(record.eventTitle || '',160),type:record.type,size:record.size,data:record.data};
  if (!allowed.includes(r.type) || !Number.isInteger(r.size) || r.size < 1 || r.size > MAX_FILE || typeof r.data !== 'string' || r.data.length > Math.ceil(MAX_FILE/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(r.data)) throw new Error('Use a PDF, PNG, JPEG, WebP or text file, up to 5 MB each.');
  let content; try { content = bytes(r.data); } catch { throw new Error('Invalid file contents in backup.'); }
  if (content.length !== r.size) throw new Error('File size does not match the backup.');
  const head = new TextDecoder('latin1').decode(content.slice(0,12));
  const valid = r.type === 'application/pdf' ? head.startsWith('%PDF-') : r.type === 'image/png' ? content.slice(0,8).join(',') === '137,80,78,71,13,10,26,10' : r.type === 'image/jpeg' ? content[0] === 255 && content[1] === 216 && content[2] === 255 : r.type === 'image/webp' ? head.startsWith('RIFF') && head.slice(8,12) === 'WEBP' : true;
  if (!valid) throw new Error('This file does not match its declared format.');
  return r;
 }
 function validateList(records) {
  if (!Array.isArray(records) || records.length > MAX_COUNT) throw new Error('Keep up to 40 documents.');
  const clean = records.map(validate);
  if (new Set(clean.map(r=>r.id)).size !== clean.length || clean.reduce((n,r)=>n+r.size,0) > MAX_TOTAL) throw new Error('Documents must have unique IDs and total at most 20 MB.');
  return clean;
 }
 async function merge(records) {
  const clean = validateList(records), db = await open();
  return new Promise((resolve,reject) => {
   const tx = db.transaction('files','readwrite'), store = tx.objectStore('files'), request = store.getAll();
   let issue = '', added = 0;
   request.onsuccess = () => {
    try {
     const existing = request.result, combined = [...existing];
     for (const item of clean) {
      const same = combined.find(r=>r.id===item.id);
      if (same && JSON.stringify(same) === JSON.stringify(item)) continue;
      // Imports never overwrite a different file that happens to have the same ID.
      const next = {...item,id:same ? `file-${crypto.randomUUID()}` : item.id};
      combined.push(next); added++;
     }
     validateList(combined);
     combined.forEach(file=>store.put(file));
    } catch (error) { issue = error.message; tx.abort(); }
   };
   tx.oncomplete = () => resolve(added);
   tx.onabort = tx.onerror = () => reject(new Error(issue || 'Could not save files. Storage may be full; keep your originals.'));
  });
 }
 async function add(file,event = '',eventTitle = '') {
  if (!file || file.size > MAX_FILE || file.size < 1) throw new Error('Choose a file between 1 byte and 5 MB.');
  const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read this file.')); reader.readAsDataURL(file); });
  const record = validate({id:`file-${crypto.randomUUID()}`,name:file.name,event,eventTitle,type:uploadType(file),size:file.size,data});
  await merge([record]); return record;
 }
 async function remove(id) {
  const db = await open();
  return new Promise((resolve,reject) => {
   const tx = db.transaction('files','readwrite'), store = tx.objectStore('files'), request = store.get(id);
   request.onsuccess = () => store.delete(id);
   tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(new Error('Could not remove this file.'));
  });
 }
 function download(record) {
  const r = validate(record), object = URL.createObjectURL(new Blob([bytes(r.data)],{type:r.type}));
  const a = document.createElement('a'); a.href = object; a.download = r.name; a.rel = 'noopener'; a.click();
  setTimeout(()=>URL.revokeObjectURL(object),30000);
 }
 return {all,add,merge,remove,download,validateList};
})();
