// Offline metadata only. Permissions never supply a physical floor or collision.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const parse = bytes => JSON.parse(Buffer.from(bytes).toString('utf8'));

export function patchArcadeManifest({baseBytes, baseSha256, proofBytes, freezeBytes}) {
  assert(digest(baseSha256) && sha(baseBytes) === baseSha256, 'Exact frozen input manifest');
  const base = parse(baseBytes), proof = parse(proofBytes), freeze = parse(freezeBytes);
  assert.equal(proof.schema, 1); assert.equal(freeze.schema, 1);
  assert.equal(freeze.files['source-proof.json'].sha256, sha(proofBytes), 'Freeze pins source proof');
  assert.equal(proof.sourceSha256, proof.sourceSha256After, 'Existing core source preserved');
  assert.equal(freeze.sourceCanonicalSha256, proof.sourceSha256);
  assert.equal(freeze.sourceCanonicalSha256After, proof.sourceSha256);
  assert(digest(proof.sourceSha256));
  assert.equal(proof.allRetainedMaterialNamesNodesPropertiesAndExtrasExact, true);
  assert(Number.isInteger(proof.unrelatedSourceObjectSignaturesExact) && proof.unrelatedSourceObjectSignaturesExact > 0, 'Retained source-object comparison completed');
  assert.equal(freeze.frames.module, 'street0');
  assert.equal(freeze.frames.ownedMain, 'Main0');
  assert.equal(freeze.frames.ownedExterior, 'street0');
  assert.equal(freeze.frames.protectedExterior, 'street0');
  assert.equal(freeze.frames.protectedMain, 'Main0; place at street Y\u22124.2672');
  assert(Array.isArray(proof.newMaterialNames) && proof.newMaterialNames.every(name => typeof name === 'string' && name.length > 0), 'Named new material array');
  assert.deepEqual(freeze.newMaterialNames, proof.newMaterialNames);
  assert.equal(proof.newMaterialNames.length, 13);
  assert.equal(new Set(proof.newMaterialNames).size, 13);
  assert.equal(proof.closedGlazingCollisionMaterial, 'ArcadeShopAndClerestoryGlass');
  for (const name of ['formal-arcade-module.glb', 'old-arcade-owned-exterior-street0.glb', 'old-arcade-owned-main-main0.glb']) {
    assert.deepEqual(freeze.files[name], proof.outputs[name], `Exact frozen ${name}`);
    assert(digest(freeze.files[name].sha256));
  }
  assert(!base.arcadeInteriorDetails, 'Do not apply arcade permissions twice');
  assert.equal(base.levels.mainWorld, -4.2672, 'Preserve existing Main datum');
  assert(Array.isArray(base.walkable));
  const additions = proof.walkableAdditions;
  assert.equal(additions?.length, 5, 'Exactly five authored landing/side-floor permissions');
  const expectedAreas = [
    ['Existing street-level loggia landing', [24.9, 32.71, -7.75, 7.75], true],
    ['Loggia restaurant entrance bay', [24.9, 32.71, 7.75, 14], false],
    ['Loggia restaurant entrance bay', [24.9, 32.71, -14, -7.75], false],
    ['Seventh Avenue vestibule side circulation', [101.29, 111.1816, 7, 10.5], false],
    ['Seventh Avenue vestibule side circulation', [101.29, 111.1816, -10.5, -7], false]
  ];
  assert.deepEqual(additions.map(area => [area.label, area.bounds, area.existingMeshUntouched]), expectedAreas, 'Exact reviewed landing and four side-floor footprints');
  const unique = new Set();
  for (const area of additions) {
    assert.equal(area.frame, 'gltf-world-street0-xz'); assert.equal(area.floor, 0);
    assert(typeof area.label === 'string' && area.label.length > 0);
    assert(typeof area.source === 'string' && area.source.length > 0);
    const b = area.bounds;
    assert(Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] < b[1] && b[2] < b[3], 'Finite ordered authored bounds');
    assert(b[0] >= 24.9 && b[1] <= 111.1816 && b[2] >= -14 && b[3] <= 14, 'Bounded connected entrance only');
    const key = JSON.stringify(b); assert(!unique.has(key), 'No duplicate permission'); unique.add(key);
    assert(typeof area.existingMeshUntouched === 'boolean');
  }
  assert.equal(additions.filter(area => area.existingMeshUntouched).length, 1, 'One retained landing, four new side slabs');
  const result = structuredClone(base);
  result.walkable.push(...additions.map(area => ({label: area.label, bounds: [...area.bounds], floor: area.floor,
    geometryBasedFloorRayRequired: true, surface: 'Permission bounds only; support and collision require actual authored mesh intersections.'})));
  result.arcadeInteriorDetails = {
    revision: 'phase9-connected-entrance-1', sourceManifestSha256: baseSha256,
    sourceProofSha256: sha(proofBytes), sourceFreezeSha256: sha(freezeBytes),
    sourceSceneSha256: proof.sourceSha256, moduleSha256: proof.outputs['formal-arcade-module.glb'].sha256,
    frame: 'Street0; existing Main-floor/stair geometry and datum retained',
    walkableAdditions: structuredClone(additions),
    closedGlazingCollisionMaterial: proof.closedGlazingCollisionMaterial,
    heightSource: structuredClone(proof.heightSource), limits: structuredClone(proof.limits),
    status: 'Evidence-led opening-era reconstruction with qualified photographic registration; geometry, lighting and browser acceptance are separate records.'
  };
  for (const key of Object.keys(base)) if (key !== 'walkable') assert.deepEqual(result[key], base[key], `Preserve existing ${key}`);
  assert.deepEqual(result.walkable.slice(0, base.walkable.length), base.walkable, 'Exact prior permission prefix');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = {}, allowed = ['base', 'base-sha', 'proof', 'freeze', 'out'];
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, '');
    assert(allowed.includes(key) && process.argv[i].startsWith('--') && process.argv[i + 1] && !args[key], 'Unique paired options'); args[key] = process.argv[i + 1];
  }
  for (const key of allowed) assert(args[key], `Missing --${key}`);
  const repo = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  assert(!fs.existsSync(args.out), 'Never overwrite candidate output');
  let parent = path.dirname(path.resolve(args.out));
  const tail = [];
  while (!fs.existsSync(parent)) { tail.unshift(path.basename(parent)); parent = path.dirname(parent); }
  parent = path.join(fs.realpathSync(parent), ...tail);
  assert(parent !== repo && !parent.startsWith(repo + path.sep), 'External candidate output only');
  const result = patchArcadeManifest({baseBytes: fs.readFileSync(args.base), baseSha256: args['base-sha'], proofBytes: fs.readFileSync(args.proof), freezeBytes: fs.readFileSync(args.freeze)});
  fs.mkdirSync(parent, {recursive: true});
  fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
}
