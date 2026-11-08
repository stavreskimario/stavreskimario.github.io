import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { HDRLoader } from '/Users/stavreskimario/Desktop/penn-station-work/tools/node_modules/three/examples/jsm/loaders/HDRLoader.js';
import { FloatType } from '/Users/stavreskimario/Desktop/penn-station-work/tools/node_modules/three/build/three.module.js';
const [input, output] = process.argv.slice(2);
assert(input && output);
const bytes = await fs.readFile(input);
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const parsed = new HDRLoader().setDataType(FloatType).parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
assert.equal(parsed.width, 4096); assert.equal(parsed.height, 4096);
assert.equal(parsed.data.length, 4096 * 4096 * 4);
let minimum = Infinity, maximum = -Infinity, sum = 0, positive = 0;
for (let i = 0; i < parsed.data.length; i += 4) for (let k = 0; k < 3; k++) {
  const value = parsed.data[i + k]; assert(Number.isFinite(value) && value >= 0);
  minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); sum += value; positive += Number(value > 0);
}
assert(sum > 0 && maximum > 0);
assert.equal(digest(await fs.readFile(input)), digest(bytes));
const report = { schema: 1, status: 'PASS', input, inputSha256: digest(bytes), bytes: bytes.length,
  decoder: 'Official pinned Three.js0.180 HDRLoader FloatType parse; no renderer/GPU/browser',
  width: parsed.width, height: parsed.height, rgb: { minimum, maximum, mean: sum / (4096 * 4096 * 3), positiveSamples: positive },
  inputUnchanged: true };
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
