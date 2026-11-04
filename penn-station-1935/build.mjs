import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, copyFile, writeFile, readFile, readdir, unlink } from 'node:fs/promises';

const root = path.dirname(fileURLToPath(import.meta.url));
const tools = process.env.PENN_TOOLS || '/private/tmp/penn-station-tools';
const requireTools = createRequire(path.join(tools, 'package.json'));
const { build } = requireTools('esbuild');
const bundledPackages = new Set();
await mkdir(path.join(root, 'dist'), { recursive: true });
await mkdir(path.join(root, 'assets/basis'), { recursive: true });
for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) await copyFile(path.join(tools, 'node_modules/three/examples/jsm/libs/basis', name), path.join(root, 'assets/basis', name));
await build({ entryPoints: [path.join(root, 'src/app.jsx')], bundle: true, splitting: true, format: 'esm', target: ['es2022'], minify: true, outdir: path.join(root, 'dist'), entryNames: 'app', chunkNames: 'chunks/[name]-[hash]', nodePaths: [path.join(tools, 'node_modules')], legalComments: 'linked', define: { 'process.env.NODE_ENV': '"production"' }, metafile: true }).then(async result => {
  const sizes = Object.fromEntries(Object.entries(result.metafile.outputs).map(([name, output]) => [path.relative(root, name), output.bytes]));
  for (const input of Object.keys(result.metafile.inputs)) { const match = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/); if (match) bundledPackages.add(match[1]); }
  const active = new Set(Object.keys(sizes).map(name => path.basename(name)));
  for (const file of await readdir(path.join(root, 'dist/chunks'))) {
    if (/^(chunk|three\.webgpu|hls|vision_bundle)-[A-Z0-9]+\.js(?:\.LEGAL\.txt)?$/.test(file) && !active.has(file)) await unlink(path.join(root, 'dist/chunks', file));
  }
  await writeFile(path.join(root, 'dist/build-sizes.json'), JSON.stringify(sizes, null, 2));
});
const packages = [...bundledPackages].sort();
let notices = '# Bundled software licences\n\n';
for (const name of packages) {
  const base = path.join(tools, 'node_modules', name);
  for (const license of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    try { notices += `\n## ${name}\n\n${await readFile(path.join(base, license), 'utf8')}\n`; break; } catch {}
  }
}
await writeFile(path.join(root, 'THIRD_PARTY.md'), notices);
console.log('Built relative, self-contained Penn Station browser assets.');
