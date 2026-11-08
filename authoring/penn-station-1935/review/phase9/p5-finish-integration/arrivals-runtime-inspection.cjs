// Read-only acceptance helpers. They never alter camera, renderer or materials.
const assert = require('node:assert/strict');
const { gunzipSync } = require('node:zlib');
const comparison = Object.freeze({
  sourceReportSha256: '6ada9285a03eb624829cfd48d515c950578365278347dac457a5621a9c11155a',
  sourceCommit: 'ed4e00b06be3dd6d48db6a7e4537c36e90b4b336',
  sourceReport: '/Users/stavreskimario/Desktop/penn-station-work/phase9-interiors/arrivals-publication-v1/public-final-v2/report.json',
  position: [-82.45260856974649, -10.305624791949164, 12.667763632338174],
  yaw: -Math.PI / 2, pitch: .25, fov: 50, nativePositionToleranceM: .04,
  qualification: 'Same target pose, reached only with native keyboard/pointer input; actual position and angular deltas are retained rather than claiming pixel-identical camera placement.',
});
function readGlb(bytes) {
  const b = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  assert.equal(b.subarray(0, 4).toString(), 'glTF');
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
}
function expectedArrivals(j) {
  const materials = j.materials.filter(m => /Arrivals/.test(m.name || ''));
  assert.equal(materials.length, 7, 'Seven authored ARR materials');
  const lit = materials.filter(m => m.extras?.sky_illumination === 'lighting-concourse-arrivals-sky.webp');
  assert.equal(lit.length, 4, 'Four baked ARR materials');
  const aoUris = [...new Set(lit.map(m => {
    assert(m.occlusionTexture, 'Lit material retains authored AO');
    const texture = j.textures[m.occlusionTexture.index];
    return j.images[texture.extensions?.KHR_texture_basisu?.source ?? texture.source].uri;
  }))];
  assert.equal(aoUris.length, 1, 'One shared full ARR AO texture');
  return {
    names: materials.map(m => m.name).sort(), litNames: lit.map(m => m.name).sort(), aoUri: aoUris[0],
    sourcePbr: materials.map(m => ({ name: m.name, color: (m.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]).slice(0, 3), opacity: m.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1, roughness: m.pbrMetallicRoughness?.roughnessFactor ?? 1, metalness: m.pbrMetallicRoughness?.metallicFactor ?? 1, normalStrength: m.normalTexture ? m.normalTexture.scale ?? 1 : null })),
  };
}
function checkMaterialMaps(actual, expected) {
  assert.deepEqual(actual.map(m => m.name).sort(), expected.names, 'Actual seven mounted ARR names');
  const lit = actual.filter(m => m.skyFile === 'lighting-concourse-arrivals-sky.webp');
  assert.deepEqual(lit.map(m => m.name).sort(), expected.litNames);
  for (const m of lit) {
    assert.deepEqual([m.lightmap?.width, m.lightmap?.height], [4096, 4096], m.name + ': full4KGI');
    assert.deepEqual([m.ao?.width, m.ao?.height], [2048, 2048], m.name + ': full2KAO');
    assert.equal(m.ao.channel, m.lightmap.channel, m.name + ': authoritative exported atlas channel');
    assert.equal(m.skyScale, 2); assert(Math.abs(m.lightIntensity - 2 * Math.PI) < 1e-9);
  }
  for (const m of actual) assert.equal(m.reflectionFile, 'reflection-concourse.hdr.gz', m.name + ': authored room reflection');
}
async function inspectMountedArrivals(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const fn = await cdp.send('Runtime.evaluate', { expression: 'window.pennStation.getScene', objectGroup: 'p5-arrivals-readonly' });
    const props = await cdp.send('Runtime.getProperties', { objectId: fn.result.objectId, ownProperties: true });
    const scope = props.internalProperties?.find(p => p.name === '[[Scopes]]')?.value?.objectId;
    assert(scope, 'Existing scene closure available for read-only material inspection');
    const scopes = await cdp.send('Runtime.getProperties', { objectId: scope, ownProperties: true });
    for (const item of scopes.result.filter(x => x.value?.objectId)) {
      const values = await cdp.send('Runtime.getProperties', { objectId: item.value.objectId, ownProperties: true });
      for (const value of values.result.filter(x => x.value?.type === 'object' && x.value.objectId)) {
        const got = await cdp.send('Runtime.callFunctionOn', {
          objectId: value.value.objectId, returnByValue: true, silent: true,
          functionDeclaration: "function(){if(!this?.isObject3D)return null;let root=this;while(root.parent)root=root.parent;if(!root.isScene)return null;const materials=new Map(),lights=[];root.traverse(o=>{if(o.isSpotLight)lights.push({position:o.position.toArray(),world:[o.matrixWorld.elements[12],o.matrixWorld.elements[13],o.matrixWorld.elements[14]],intensity:o.intensity,target:[o.target.matrixWorld.elements[12],o.target.matrixWorld.elements[13],o.target.matrixWorld.elements[14]]});if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&/Arrivals/.test(m.name||'')&&!materials.has(m.uuid))materials.set(m.uuid,{name:m.name,color:m.color?.toArray()??null,opacity:m.opacity,roughness:m.roughness,metalness:m.metalness,normalScale:m.normalMap?m.normalScale?.toArray()??null:null,normalMapColorSpace:m.normalMap?.colorSpace??null,baseMapColorSpace:m.map?.colorSpace??null,aoMapColorSpace:m.aoMap?.colorSpace??null,lightMapColorSpace:m.lightMap?.colorSpace??null});});return materials.size?{materials:[...materials.values()],lights}:null;}",
        });
        if (got.result.value?.materials?.length) return { ...got.result.value, scope: 'Read-only mounted scene material/color and practical-light values; no setters or matrix/material updates.' };
      }
    }
    throw new Error('Mounted ARR material/color inspection was unavailable');
  } finally { await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'p5-arrivals-readonly' }).catch(() => {}); await cdp.detach(); }
}
function checkMountedPbr(actual, expected) {
  assert.deepEqual(actual.materials.map(m => m.name).sort(), expected.names);
  for (const source of expected.sourcePbr) {
    const m = actual.materials.find(m => m.name === source.name);
    for (const [label, a, b] of [['color', m.color, source.color], ['roughness', [m.roughness], [source.roughness]], ['metalness', [m.metalness], [source.metalness]], ['opacity', [m.opacity], [source.opacity]]]) {
      assert(a && a.length === b.length && a.every((v, i) => Number.isFinite(v) && Math.abs(v - b[i]) < 1e-6), source.name + ': actual ' + label + ' matches served glTF');
    }
    // Pinned GLTFLoader flips Y when deriving tangents. Preserve that convention
    // while checking the source strength magnitude exactly once on each axis.
    if (source.normalStrength !== null) { assert(m.normalScale?.length === 2 && Math.abs(m.normalScale[0] - source.normalStrength) < 1e-6 && Math.abs(Math.abs(m.normalScale[1]) - source.normalStrength) < 1e-6, source.name + ': original normal strength magnitude applied once'); assert.equal(m.normalMapColorSpace, '', source.name + ': linear normal data'); }
    if (expected.litNames.includes(source.name)) { assert.equal(m.aoMapColorSpace, '', source.name + ': linear AO data'); assert.equal(m.lightMapColorSpace, 'srgb', source.name + ': declared encoded GI transfer'); }
  }
}
module.exports = { readGlb, expectedArrivals, checkMaterialMaps, inspectMountedArrivals, checkMountedPbr, comparison };
