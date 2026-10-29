# Pennsylvania Station — Phase 3

An evidence-led architectural exhibition for Mario’s GitHub Pages collection. This revision joins the exterior and interiors into one persistent world, closes the lower roof wings, repairs structural contacts, extends the railway, and revises stone, glass and lighting. All architectural, urban and rolling-stock geometry is authored in Blender; the browser loads exported assets.

**This remains a phased reconstruction, not the completed photorealistic replica requested in the brief.** The target is 1935–1940. Opening-era drawings establish much of the station; later evidence qualifies alterations and vehicle types. Ornament, exact material colour, complete neighbourhood parcels and operational details retain specific uncertainties. No 1:1 or fully verified 1935 claim is made.

## Visit and explore

Serve the repository as static files and open `penn-station-1935/`. The committed bundle and relative assets work on GitHub Pages, including under a project path, without a backend or a visitor build step. Deployment evidence belongs in [VALIDATION.md](VALIDATION.md); an open pull request alone does not establish a live deployment.

- **Enter Station** clears the introduction. Drag to orbit, scroll or pinch to approach, and right-drag or use two fingers to pan.
- All six architectural and railway chunks load behind one progress cover. Exterior, waiting-room and concourse controls move the camera through the same persistent world. The navigation map adds Hotel Pennsylvania across Seventh Avenue, the General Post Office across Eighth Avenue, and a platform viewpoint.
- **Environment → Walk** uses a 1.68 m eye height, smooth WASD/arrow movement, drag to look, collision checks and actual floor/step intersections. Held direction buttons support touch and keyboard input. The central street-level arcade, reconstructed main stair, waiting room and axial concourse passage form a connected route.
- The working street-to-main-floor drop is 14 ft. Nine nonuniform east stair heads, exit landings, lower flights and waiting-room end stairs are modelled. The opening-era railway reconstruction now contains 21 tracks and 11 asymmetric platform envelopes. The switch throats are truncated, and a verified 1935 track inventory remains outstanding. An unnumbered early-production GG1 and two P70 coaches occupy a registered track; no timetable or train assignment is invented.
- Environment controls offer three daylight interpretations, FOV, shadows, quality, annotations and opt-in synthesized atmosphere. The guided tour advances through the principal viewpoints; choosing a view or pressing Escape stops it. Preferences last for the visit.
- **Archive view** presents opening-era photographs and approximate interior framing controls. The cameras are not calibrated matches, and the photographs are not verified 1935 records. **Sources & accuracy** separates evidence, interpretation and outstanding work.

## Geometry, materials and lighting

The stack is React 19, React Three Fiber 9, Drei and Three.js, with Blender 4.3 authoring. Geometry Nodes retain the repetitive Doric colonnades in the editable station scene. The waiting room has relief coffers, dimensioned colossal and smaller orders, recessed mural fields and articulated windows. The concourse uses intersecting vaults, lattice piers, paired arch webs and glazing members interpreted from the engineers’ published drawings. See the [core model ledger](model/README.md) for dimensions and reconstruction limits.

The separate [context source and ledger](model/context-research.md) reconstruct Hotel Pennsylvania’s four south-facing upper wings, limestone base and buff-brick storeys, and Farley’s twenty-column front and raised stair approach. Exact parcel registration, Farley’s working envelope and its western annex remain qualified. Streetlights and rounded 1930s-style cars are generic period interpretations, with no asserted brand or documented placement. The [rolling-stock ledger](model/rolling-stock-research.md) records the original July 1935 GG1 drawing, museum P70 evidence and remaining coach-drawing uncertainties. No specific locomotive identity, train assignment or timetable is invented.

Granite, travertine and marble use modern CC0 **ambientCG Granite005A, Travertine009 and Marble018** colour, roughness and OpenGL normal maps. Physical texture scales and restrained normal strengths are defined in [material_library.py](model/material_library.py). These are appearance interpretations, not scans or calibrated samples from the station. Waiting/subwaiting rooms, the arcade and vestibules have documented marble floors without a verified variety; ticket-booth exteriors are documented as Botticino. The concourse finish remains an interpretation, and its documented glass-prism vault-light flooring is an unfinished architectural layer. Credits and source hashes are in [ASSET_RIGHTS.md](ASSET_RIGHTS.md) and [material-provenance.json](material-provenance.json).

The exterior, waiting room, concourse and platform floors receive Cycles neutral-sky illumination with six diffuse bounces and a separate ambient-occlusion atlas. Registered neighbouring chunks participate in light transport. Fine ironwork remains outside the masonry atlas, improving its useful coverage. Directional sunlight stays dynamic.

The lighting pipeline corrects two Phase 2 errors: Non-Color images bypassed the intended sRGB encoding, and outgoing diffuse radiance was being used directly where Three.js expects irradiance. Linear Rec.709 bake pixels now pass through Standard/sRGB encoding; a per-atlas scale preserves radiance above one. Lossless WebP retains the encoded RGB pixels. The browser decodes sRGB, restores that scale and multiplies by π. A shader adjustment prevents unoccluded environment diffuse from being added again to the baked materials, while preserving specular reflections. [The calibration test](../tests/penn-lighting.cjs) checks the actual Blender transfer image and browser pixels against a unit-hemisphere Lambert reference.

Separate HDR panoramas captured inside the assembled waiting room, concourse and platform supply architectural reflections. A fourth elevated Seventh Avenue capture supplies the exterior environment. They approximate static local radiance, with no positional parallax correction, moving-passenger reflections or time-specific rebaking. The former modern field environment is retained only in the authoring archive. Thin clear glass, material colours, exposure and sun presets remain physically informed interpretations, not a calibrated historical photograph. Native WebGPU does not use the WebGL lighting shader adjustment; its visual parity remains experimental.

The north Guérin mural uses a rectified grayscale Library of Congress photograph with documented provenance. Five other mural fields remain neutral; original colours and complete artwork are unverified. The [interior evidence ledger](model/interior-evidence.md) records furnishings, lighting and signage anchors. Rejected procedural passengers are excluded from the released scene; a scanned replacement must pass both visual and period-dress review before population.

## Runtime delivery

Six chunks cover exterior, waiting room, concourse, neighbourhood, platform and trains, each with full and mobile GLBs. The twelve Meshopt GLBs are delivered as `.glb.gz` files and decompressed in the browser, without backend services or special response headers. GZip transport preserves decoded geometry and materials. Deduplication, material batching and `EXT_mesh_gpu_instancing` reduce repeated-object overhead. KTX2/UASTC surface and AO textures use shared content-hashed relative URIs, with desktop maps capped at 2K and mobile derivatives at 512 px. Runtime illumination uses lossless WebP atlases; full and mobile HDR reflections are delivered separately. Mobile geometry variants use bounded simplification. Frustum culling and rendering on demand are enabled. These quality variants do not constitute a complete distance-LOD or occlusion system.

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
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/build_railway.py --out /tmp/penn-railway

mkdir -p /tmp/penn-raw /tmp/penn-baked
cp /tmp/penn-core/model-exterior.glb /tmp/penn-core/model-waiting-room.glb /tmp/penn-core/model-concourse.glb /tmp/penn-raw/
cp /tmp/penn-railway/model-railway.glb /tmp/penn-raw/model-platform.glb
cp /tmp/penn-context/context-neighbourhood.glb /tmp/penn-raw/model-context.glb
cp /tmp/penn-trains/model-trains.glb /tmp/penn-raw/model-trains.glb
for penn_zone in exterior waiting-room concourse platform; do
  set --
  for penn_neighbour in exterior waiting-room concourse platform context trains; do
    if [ "$penn_neighbour" != "$penn_zone" ]; then
      set -- "$@" --occluder "$penn_neighbour=/tmp/penn-raw/model-$penn_neighbour.glb"
    fi
  done
  uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/bake_lighting.py "/tmp/penn-raw/model-$penn_zone.glb" --out /tmp/penn-baked --zone "$penn_zone" --resolution 2048 --samples 64 --materials authoring/penn-station-1935/materials "$@"
done
cp /tmp/penn-context/context-neighbourhood.glb /tmp/penn-baked/model-context.glb
cp /tmp/penn-trains/model-trains.glb /tmp/penn-baked/model-trains.glb
for penn_zone in exterior waiting-room concourse platform; do
  uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' --with pillow==13.0.0 python penn-station-1935/model/denoise_lighting.py "/tmp/penn-baked/lighting-$penn_zone-sky.hdr" --input-transfer linear --out /tmp/penn-denoised --zone "$penn_zone" --radiance-scale 1
done
cp /tmp/penn-denoised/lighting-*.png /tmp/penn-baked/
set -- --exterior /tmp/penn-raw/model-exterior.glb --waiting /tmp/penn-raw/model-waiting-room.glb --concourse /tmp/penn-raw/model-concourse.glb --platform /tmp/penn-raw/model-platform.glb --context /tmp/penn-raw/model-context.glb --trains /tmp/penn-raw/model-trains.glb --materials authoring/penn-station-1935/materials --width 1024 --samples 64
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/capture_reflections.py "$@" --out /tmp/penn-reflections
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/capture_reflections.py "$@" --only exterior --out /tmp/penn-exterior-reflection
```

Use each bake report's `radianceScale` if it exceeds one. Fresh bakes retain linear HDR values. The first Phase 3 retained HDRs unexpectedly stored sRGB numeric values; those archived inputs require `--input-transfer srgb`. The delivered post-processing reports record that recovery explicitly. The current writer uses a separate Non-Color float buffer, and its 0.18-radiance round trip is checked by the calibration script.

Set `KTX_BIN` to the binary directory of official Khronos KTX-Software 4.4.2 for the local platform. Produce runtime derivatives in a review folder:

```sh
PENN_TOOLS=/tmp/penn-tools PENN_RAW_DIR=/tmp/penn-baked PENN_ASSET_OUT=/tmp/penn-runtime PENN_ASSET_WORK=/tmp/penn-asset-work node penn-station-1935/optimise.mjs exterior waiting-room concourse context platform trains
cp /tmp/penn-baked/lighting-*.json /tmp/penn-runtime/
cp /tmp/penn-denoised/lighting-*-denoise.json /tmp/penn-runtime/
cp /tmp/penn-reflections/reflection-*.hdr.gz /tmp/penn-reflections/reflection-probes.json /tmp/penn-runtime/
cp /tmp/penn-exterior-reflection/reflection-exterior.hdr /tmp/penn-runtime/sky.hdr
cp /tmp/penn-exterior-reflection/reflection-exterior-probe.json /tmp/penn-runtime/
node penn-station-1935/assemble-world.mjs /tmp/penn-core/scene-manifest.json /tmp/penn-railway/railway-manifest.json /tmp/penn-runtime/scene-manifest.json
```

The world assembler preserves the core stair registration and merges the railway polygons, floor datums and rolling-stock track placement. These actual polygons drive walking permissions; broad rectangles would incorrectly enable walking over platform taper voids.

The optimizer converts and copies the illumination WebPs, verifies Meshopt/BasisU declarations and writes `asset-metrics.json`; its texture subdirectory must accompany the GLBs. After reviewing dimensions, materials and images, promote the scratch set:

```sh
node penn-station-1935/promote-assets.mjs /tmp/penn-runtime
```

Promotion verifies all twelve models, calibrated light-map metadata, shared texture hashes, the three room captures, the captured exterior environment, the complete world manifest and a byte-identical GZip round trip. It writes `.glb.gz` models and their textures/light maps/probes, replacing the old environment with the reviewed station capture. Existing photographs and decoder files remain. Original GLBs stay in the review directory; retain reviewed `.blend` files, original maps, HDR bakes and AO PNGs under `authoring/penn-station-1935/`. Optimization and compression do not certify historical accuracy.

## Validation and remaining work

```sh
uv run --no-project python scripts/validate.py
PENN_TOOLS=/tmp/penn-tools node tests/penn-assets.cjs
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/calibrate_diffuse.py --out /tmp/penn-calibration
PENN_TOOLS=/tmp/penn-tools PENN_CALIBRATION=/tmp/penn-calibration node tests/penn-lighting.cjs
PLAYWRIGHT_MODULE=/tmp/penn-tools/node_modules/playwright node tests/penn-station.cjs
```

The browser runner mounts the site under a project prefix, checks decoded assets and lighting metadata, exercises viewpoints, walking, quality, dialogs, touch emulation and recovery from failed assets, and saves screenshots outside the repository. `CHROME_PATH` selects a local browser executable. Desktop and mobile emulation are distinct from measurements on physical devices. Record the actual results in [VALIDATION.md](VALIDATION.md) after each delivered build.

Further work includes five mural reproductions and verified colours, surveyed sculpture and ornamental profiles, later-period furnishings and operational signs, photorealistic passengers, complete railway switchwork and peripheral passenger spaces, station wire-height and coach-drawing reconciliation, photographic material/light calibration, and performance on physical hardware. The fuller Manhattan streetscape is deliberately deferred until the station has received these improvements. The final photographic and historical acceptance target remains the user’s brief; this preview does not yet meet it.
