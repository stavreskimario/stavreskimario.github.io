// Combine the independently authored station and railway navigation contracts.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const [coreFile, railwayFile, output] = process.argv.slice(2);
if (!coreFile || !railwayFile || !output) throw new Error('Pass core manifest, railway manifest and output filename');
if ([coreFile, railwayFile].some(input => path.resolve(input) === path.resolve(output))) throw new Error('Preserve source manifests; choose a separate output');
const core = JSON.parse(await readFile(coreFile, 'utf8'));
const railway = JSON.parse(await readFile(railwayFile, 'utf8'));
if (core.revision !== 3 || railway.trackCount !== 21 || railway.platformCount !== 11) throw new Error('Expected the reviewed Phase 3 source contracts');
if (Math.abs(core.levels.mainWorld - railway.chunkWorldOffset[1]) > .000001) throw new Error('Station and railway floor datums disagree');
const track = railway.tracks.find(track => track.number === 10);
if (!track || !Number.isFinite(track.centreZAtStation)) throw new Error('Missing rolling-stock track registration');
core.railway = railway;
core.chunkOffsets.context = [0, 0, 0];
core.chunkOffsets.platform = railway.chunkWorldOffset;
core.chunkOffsets.trains = [0, railway.railWorldY, track.centreZAtStation];
core.runtimeZones = ['exterior', 'waiting', 'concourse', 'context', 'platform', 'trains'];
core.assets = ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains'].map(zone => ({
  file: `model-${zone}.glb`, transportFile: `model-${zone}.glb.gz`, zone: zone === 'waiting-room' ? 'waiting' : zone,
}));
await writeFile(output, JSON.stringify(core, null, 2) + '\n');
console.log('Assembled six-zone world manifest with traced railway polygons and registered train position.');
