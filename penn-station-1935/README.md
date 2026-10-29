# Pennsylvania Station — Phase 2

An evidence-led architectural exhibition for Mario’s GitHub Pages collection. This revision adds dimensional and sculptural detail to the waiting room, source-based concourse steelwork, connected entrance circulation, documented neighbouring buildings, and a period electric train interpretation. All architectural, urban and rolling-stock geometry is authored in Blender; the browser loads exported assets.

**This remains a phased reconstruction, not the completed photorealistic replica requested in the brief.** The target is 1935–1940. Opening-era drawings establish much of the station; later evidence qualifies alterations and vehicle types. Ornament, exact material colour, complete neighbourhood parcels and operational details retain specific uncertainties. No 1:1 or fully verified 1935 claim is made.

## Visit and explore

Serve the repository as static files and open `penn-station-1935/`. The committed bundle and relative assets work on GitHub Pages, including under a project path, without a backend or a visitor build step. Deployment evidence belongs in [VALIDATION.md](VALIDATION.md); an open pull request alone does not establish a live deployment.

- **Enter Station** clears the introduction. Drag to orbit, scroll or pinch to approach, and right-drag or use two fingers to pan.
- Exterior, waiting-room and concourse viewpoints load their required chunks behind a progress cover. The navigation map adds Hotel Pennsylvania across Seventh Avenue, the General Post Office across Eighth Avenue, and a representative platform view.
- **Environment → Walk** uses a 1.68 m eye height, smooth WASD/arrow movement, drag to look, collision checks and actual floor/step intersections. Held direction buttons support touch and keyboard input. The central street-level arcade, reconstructed main stair, waiting room and axial concourse passage form a connected route.
- The working street-to-main-floor drop is 14 ft. Nine traced east stair heads, exit landings and lower flights are modelled. A representative platform bay and an unnumbered early-production GG1 with two P70 coaches can be inspected; the complete 21-track/11-platform railway is not reconstructed.
- Environment controls offer three daylight interpretations, FOV, shadows, quality, annotations and opt-in synthesized atmosphere. The guided tour advances through the principal viewpoints; choosing a view or pressing Escape stops it. Preferences last for the visit.
- **Archive view** presents opening-era photographs and approximate interior framing controls. The cameras are not calibrated matches, and the photographs are not verified 1935 records. **Sources & accuracy** separates evidence, interpretation and outstanding work.

## Geometry, materials and lighting

The stack is React 19, React Three Fiber 9, Drei and Three.js, with Blender 4.3 authoring. Geometry Nodes retain the repetitive Doric colonnades in the editable station scene. The waiting room has relief coffers, dimensioned colossal and smaller orders, recessed mural fields and articulated windows. The concourse uses intersecting vaults, lattice piers, paired arch webs and glazing members interpreted from the engineers’ published drawings. See the [core model ledger](model/README.md) for dimensions and reconstruction limits.

The separate [context source and ledger](model/context-research.md) reconstruct Hotel Pennsylvania’s four south-facing upper wings, limestone base and buff-brick storeys, and Farley’s twenty-column front and raised stair approach. Exact parcel registration, Farley’s working envelope and its western annex remain qualified. Streetlights and rounded 1930s-style cars are generic period interpretations, with no asserted brand or documented placement. The [rolling-stock ledger](model/rolling-stock-research.md) records the original July 1935 GG1 drawing, museum P70 evidence and remaining coach-drawing uncertainties. No specific locomotive identity, train assignment or timetable is invented.

Granite and travertine use modern CC0 **ambientCG Granite005A and Travertine009** colour, roughness and OpenGL normal maps. They interpret the intended stone; they are not scans, sampled historic colours or verified materials from the demolished station. Other surfaces retain original procedural maps and authored PBR values. Credits and source hashes are in [ASSET_RIGHTS.md](ASSET_RIGHTS.md) and [material-provenance.json](material-provenance.json).

The exterior, waiting room and concourse receive **2048 px, 64-sample Cycles** neutral-sky illumination with diffuse bounce and a separate ambient-occlusion atlas. Original surface UVs are preserved; lighting uses an independent atlas channel. The bounded illumination is encoded as Standard/sRGB 8-bit PNG, then lossless WebP with the same RGB pixels; the browser decodes sRGB back to linear lighting. Original HDR and AO PNG bakes remain in the authoring archive. The bake excludes directional sun and adjacent city occluders. The separate platform uses unbaked PBR materials and runtime point lights. Browser sunlight and shadows remain adjustable, so this is not a calibrated historical lighting simulation. A modern CC0 HDR environment supplies reflections; it is not a photograph of period Manhattan. Glass response, photographic exposure, complete reflection treatment and final visual fidelity still need review.

## Runtime delivery

Six chunks cover exterior, waiting room, concourse, neighbourhood, platform and trains, each with full and mobile GLBs. The twelve Meshopt GLBs are delivered as `.glb.gz` files and decompressed in the browser, without backend services or special response headers. GZip transport is lossless: decoded geometry, materials and texture references are unchanged. Walk mode loads the connected set. Deduplication, material batching and `EXT_mesh_gpu_instancing` reduce repeated-object overhead. KTX2/UASTC surface and AO textures use shared content-hashed relative URIs, with desktop maps capped at 2K and mobile derivatives at 512 px. Runtime illumination uses 2K/512 px lossless WebP atlases. Mobile geometry variants use bounded simplification. Frustum culling and rendering on demand are enabled. These quality variants are not automatic distance LOD or a surveyed occlusion system.

WebGL 2 is the default. `?renderer=webgpu` opts into the available Three.js WebGPU path with a WebGL fallback. Experimental WebGPU and physical mobile performance are not certified. Transfer sizes, screenshots, browser checks and observed limitations must be taken from the actual delivered [validation record](VALIDATION.md), rather than inferred from compression settings.

Editable `.blend` files and original material maps live under repository-root `authoring/penn-station-1935/`, outside the GitHub Pages staging tree. Runtime assets and the local Basis decoder remain in this application’s `assets/` directory. The viewer requires no external script CDN or analytics; the collection’s shared Google Fonts are optional external font requests.

## Reproduce

Run commands from the repository root. Install pinned authoring dependencies outside the site tree, with install scripts disabled:

```sh
mkdir -p /tmp/penn-tools
cp penn-station-1935/package.json penn-station-1935/package-lock.json /tmp/penn-tools/
npm --prefix /tmp/penn-tools ci --ignore-scripts
PENN_TOOLS=/tmp/penn-tools node penn-station-1935/build.mjs
```

Use `uv` and the official Blender Python module. Each `--out` directory is a scratch export, preserving the delivered assets during authoring:

```sh
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/build_station.py --out /tmp/penn-core --no-context
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/build_context.py --out /tmp/penn-context
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/build_rolling_stock.py --out /tmp/penn-trains

for penn_zone in exterior waiting-room concourse; do
  uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/bake_lighting.py "/tmp/penn-core/model-${penn_zone}.glb" --out /tmp/penn-baked --zone "$penn_zone" --resolution 2048 --samples 64 --materials authoring/penn-station-1935/materials
done
cp /tmp/penn-context/context-neighbourhood.glb /tmp/penn-baked/model-context.glb
cp /tmp/penn-core/model-platform.glb /tmp/penn-baked/model-platform.glb
cp /tmp/penn-trains/model-trains.glb /tmp/penn-baked/model-trains.glb
```

Set `KTX_BIN` to the binary directory of official Khronos KTX-Software 4.4.2 for the local platform. Produce runtime derivatives in a review folder:

```sh
PENN_TOOLS=/tmp/penn-tools PENN_RAW_DIR=/tmp/penn-baked PENN_ASSET_OUT=/tmp/penn-runtime PENN_ASSET_WORK=/tmp/penn-asset-work node penn-station-1935/optimise.mjs exterior waiting-room concourse context platform trains
cp /tmp/penn-baked/lighting-*.json /tmp/penn-runtime/
cp /tmp/penn-core/scene-manifest.json /tmp/penn-runtime/
```

The optimizer converts and copies the illumination WebPs, verifies Meshopt/BasisU declarations and writes `asset-metrics.json`; its texture subdirectory must accompany the GLBs. After reviewing dimensions, materials and images, promote the scratch set:

```sh
node penn-station-1935/promote-assets.mjs /tmp/penn-runtime
cp /tmp/penn-runtime/scene-manifest.json penn-station-1935/assets/scene-manifest.json
```

Promotion verifies all twelve models, shared texture hashes and a byte-identical GZip round trip, then writes only `.glb.gz` model files to app assets. It preserves existing photographs, environment and decoder files. Original GLBs remain in the review directory; retain reviewed `.blend` files, original maps, HDR bakes and AO PNGs under `authoring/penn-station-1935/`. Optimization and compression do not certify historical accuracy.

## Validation and remaining work

```sh
uv run --no-project python scripts/validate.py
PLAYWRIGHT_MODULE=/tmp/penn-tools/node_modules/playwright node tests/penn-station.cjs
```

The browser runner mounts the site under a project prefix, checks decoded assets and lighting metadata, exercises viewpoints, walking, quality, dialogs, touch emulation and recovery from failed assets, and saves screenshots outside the repository. `CHROME_PATH` selects a local browser executable. Desktop and mobile emulation are distinct from measurements on physical devices. Record the actual results in [VALIDATION.md](VALIDATION.md) after each delivered build.

Further work includes authenticated reproductions of the six Guérin map murals, surveyed sculpture and ornamental profiles, full period ticketing/furnishing/signage changes, complete platform and circulation mapping, date-checked surrounding parcels, station wire-height and coach-drawing reconciliation, calibrated materials/cameras/lighting, and performance on physical desktop and mobile hardware. The final photographic and historical acceptance target remains the user’s brief.
