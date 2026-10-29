# Pennsylvania Station — Phase 1

An evidence-led architectural exhibition for Mario’s GitHub Pages collection. This first phase establishes a Blender-authored exterior, main waiting room and lower-confidence glass concourse, with an interactive browser viewer and the original architectural evidence.

**This is not the completed photorealistic reconstruction requested in the brief.** Published plans and room dimensions anchor the study, but ornamental profiles, structural details, furnishing locations and neighbouring blocks require archival calibration and substantial further modelling. The target period is 1935–1940; principal geometry and bundled photographs describe the opening-era station. No 1:1 or fully verified 1935 claim is made.

## Visit

Serve the repository as static files and open `penn-station-1935/`. The committed `dist/` bundle and local assets work directly on GitHub Pages, including under a project path. Review changes through the feature-branch PR. The observed publishing source and verified live deployment are recorded in [VALIDATION.md](VALIDATION.md); an open PR alone is not proof of deployment.

- **Enter Station** clears the introduction. Orbit by dragging; scroll/pinch to approach; right-drag or two fingers to pan.
- Three viewpoints load the exterior, waiting room and concourse separately. They transfer between spaces; a fully connected circulation route and accurate changes in floor level remain future work.
- **Environment → Walk** uses a 1.68 m eye height, WASD/arrows, smooth movement, geometry ray checks and bounded navigation. Drag to look. Held direction buttons provide touch and keyboard alternatives. Platform wells are not a navigable track level.
- Environment also offers three daylight interpretations, FOV, quality, shadows, source annotations and opt-in synthesized atmosphere. Preferences last for this visit.
- **Guided tour** advances through three viewpoints at 12-second intervals; choosing a view or pressing Escape stops it. Transfers are immediate, including for reduced motion.
- **Archive view** shows the corresponding opening-era photograph with camera-matching and date limitations. **Sources & accuracy** explains documented, interpreted and outstanding features.

## Architecture and assets

React 19 / React Three Fiber 9 / Drei / Three.js render GLB geometry authored in Blender 4.3. Repeating colonnades retain Geometry Nodes in the editable `.blend`. The browser does not create the architectural model from basic JavaScript shapes. Each room streams and decodes before its loading cover is removed. Meshopt geometry, material batching, KTX2 textures and mobile variants reduce transfer/rendering cost. Frustum culling and rendering on demand are enabled. Automatic distance LOD and surveyed occlusion remain future work.

WebGL 2 is the tested default. `?renderer=webgpu` opts into Three.js’s experimental WebGPU path where available, with a WebGL compatibility fallback. The optional path is not certified on physical browsers. Local HDR reflections, PBR materials and dynamic sun shadows are implemented. **Baked global illumination, calibrated glass transmission, production reflections/post-processing and final photographic fidelity remain outstanding.**

Research and dimensional conflicts: [RESEARCH.md](RESEARCH.md). Model and uncertainty ledger: [model/README.md](model/README.md). Asset rights: [ASSET_RIGHTS.md](ASSET_RIGHTS.md). Machine-readable records: `sources.json` and `assets/scene-manifest.json`.

## Reproduce

The public site needs no build step. Authoring tools are isolated outside the served repository so the whole-site validator does not crawl installed packages:

```sh
mkdir -p /tmp/penn-tools
cp penn-station-1935/package.json penn-station-1935/package-lock.json /tmp/penn-tools/
npm --prefix /tmp/penn-tools ci --ignore-scripts
PENN_TOOLS=/tmp/penn-tools node penn-station-1935/build.mjs
```

Install scripts are disabled. `package-lock.json` pins dependencies. The bundle contains its libraries, local texture decoder and licence notices. The only optional external runtime requests are the collection’s shared Google Fonts.

The Blender pipeline uses `uv`; see [model/README.md](model/README.md). Process raw exports using `optimise.mjs`: set `PENN_TOOLS` to the isolated tools folder and `KTX_BIN` to the official Khronos KTX-Software 4.4.2 binary directory. It writes full/mobile variants, verifies Meshopt/BasisU extension declarations and records sizes in `assets/asset-metrics.json`. It retains raw exports in a temporary folder. Re-export from Blender before rebuilding on a clean machine. Optimisation does not certify architectural accuracy.

## Validation and subsequent phases

Run `uv run --no-project python scripts/validate.py`, then `PLAYWRIGHT_MODULE=/tmp/penn-tools/node_modules/playwright node tests/penn-station.cjs`. The browser runner mounts the site under a project prefix, checks geometry/interactions, captures comparisons, exercises desktop/mobile emulation and asset/graphics failures, and writes a report outside the repository. Delivered checks and hardware limits are recorded in [VALIDATION.md](VALIDATION.md).

Further acceptance phases: reconcile approved plans/levels; model surveyed ornament and period furniture; engineer the concourse/platform level; replace context massing with documented 1930s parcels, traffic and people; bake calibrated lighting and profile real devices; compare photographs with calibrated cameras. The finished-photorealism claim is reserved until these gates are satisfied.
