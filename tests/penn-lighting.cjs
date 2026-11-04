/* Physical lighting calibration, independent of the architectural scene.
 * First run model/calibrate_diffuse.py; PENN_CALIBRATION selects its output.
 * Checks actual rendered pixels and the actual Blender PNG transfer function.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const { chromium } = requireTools('playwright');
const { build } = requireTools('esbuild');
const calibration = process.env.PENN_CALIBRATION || '/private/tmp/penn-phase3-calibration';

(async () => {
  const cycles = JSON.parse(await fs.readFile(path.join(calibration, 'cycles-diffuse-calibration.json'), 'utf8'));
  assert(cycles.passed && Math.abs(cycles.measuredBakeMean - 1) < .025);
  assert(Math.abs(cycles.retainedHdr018Mean - .18) < .002, 'Retained HDR preserves linear0.18 radiance');
  const patch = 'data:image/png;base64,' + (await fs.readFile(path.join(calibration, 'linear-018-standard-srgb.png'))).toString('base64');
  const modulePath = path.resolve(__dirname, '../penn-station-1935/src/lighting.mjs');
  const source = `
    import * as THREE from 'three';
    import {configureBakedDiffuse} from ${JSON.stringify(modulePath)};
    (async()=>{
      const gl=new THREE.WebGLRenderer({antialias:false}); gl.setSize(32,32);
      gl.toneMapping=THREE.NoToneMapping; gl.outputColorSpace=THREE.LinearSRGBColorSpace;
      const target=new THREE.WebGLRenderTarget(32,32); target.texture.colorSpace=THREE.LinearSRGBColorSpace;
      const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10); camera.position.z=2;
      const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
      white.colorSpace=THREE.LinearSRGBColorSpace;white.needsUpdate=true;
      const material=new THREE.MeshStandardMaterial({color:new THREE.Color(.5,.5,.5),metalness:0,roughness:1,lightMap:white});
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
      function read(){gl.setRenderTarget(target);gl.render(scene,camera);const bytes=new Uint8Array(4);gl.readRenderTargetPixels(target,16,16,1,1,bytes);return [...bytes].slice(0,3);}
      material.lightMapIntensity=1;const unconverted=read();
      configureBakedDiffuse(material,gl,1);const calibrated=read();
      const encoded=await new THREE.TextureLoader().loadAsync(${JSON.stringify(patch)});
      encoded.colorSpace=THREE.SRGBColorSpace;encoded.needsUpdate=true;material.lightMap=encoded;material.needsUpdate=true;
      configureBakedDiffuse(material,gl,1);const gray18=read();
      configureBakedDiffuse(material,gl,8);const hdrScale8=read();
      const env=new THREE.DataTexture(new Float32Array(64*32*4).fill(1),64,32,THREE.RGBAFormat,THREE.FloatType);
      env.colorSpace=THREE.LinearSRGBColorSpace;env.mapping=THREE.EquirectangularReflectionMapping;env.needsUpdate=true;
      material.lightMap=white;material.envMap=env;material.roughness=.35;configureBakedDiffuse(material,gl,1);const withSpecularProbe=read();
      window.calibration={unconverted,calibrated,gray18,hdrScale8,withSpecularProbe};
      target.dispose();material.dispose();white.dispose();encoded.dispose();env.dispose();gl.dispose();
    })().catch(error=>window.calibrationError=error.stack);
  `;
  const bundled = await build({stdin:{contents:source,resolveDir:path.resolve(__dirname,'..'),loader:'js'},bundle:true,format:'iife',write:false,nodePaths:[path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','node_modules')],logLevel:'silent'});
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>Measured lighting calibration</title>');
    await page.addScriptTag({content:bundled.outputFiles[0].text});
    await page.waitForFunction(()=>window.calibration || window.calibrationError);
    const error = await page.evaluate(()=>window.calibrationError);
    assert(!error,error);
    const pixels = await page.evaluate(()=>window.calibration);
    const near = (rgb,value,label)=>rgb.forEach(channel=>assert(Math.abs(channel-value)<=2,`${label}: expected${value}, measured${rgb}`));
    near(pixels.unconverted,41,'Control: missing pi factor');
    near(pixels.calibrated,128,'Unit hemisphere and50% Lambert albedo');
    near(pixels.gray18,23,'Actual Blender0.18 linear→sRGB PNG→browser decode');
    near(pixels.hdrScale8,184,'Per-atlas normalization restores radiance above1');
    assert(pixels.withSpecularProbe.every(channel=>channel>128 && channel<153),'Probe supplies visible specular without adding the baked diffuse hemisphere twice');
    const report={created:new Date().toISOString(),browser:browser.version(),cycles,pixels,scope:'32px physical reference scene, linear rendered pixels; not model appearance or hardware performance',passed:true};
    await fs.writeFile(path.join(calibration,'browser-lighting-calibration.json'),JSON.stringify(report,null,2)+'\n');
    console.log('PASS measured Cycles/browser radiance units, sRGB transfer, HDR scale and specular-only probe behavior',pixels);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
