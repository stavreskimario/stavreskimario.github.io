'use strict';
(() => {
 const status=document.getElementById('model-status');
 const loadFallback=()=>{
  const script=document.createElement('script');
  script.src='./drawing-fallback.js?v=2';
  script.onerror=()=>{status.textContent='Neither 3D rendering nor the fallback drawing could load.'};
  document.body.append(script);
 };
 if(!document.createElement('canvas').getContext('webgl2')){
  status.textContent='WebGL unavailable. Displaying the architectural drawing instead.';
  loadFallback();return;
 }
 import('./sydenham.js?v=3').catch(error=>{
  console.error('Crystal Palace 3D renderer:',error);
  status.textContent='Sydenham 3D needs WebGL2 and a CDN connection. Loading a simplified Sydenham elevation.';
  loadFallback();
 });
})();