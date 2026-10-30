# Pennsylvania Station — concourse circulation checkpoint

An evidence-led reconstruction of the original Pennsylvania Station for Mario's GitHub Pages collection. Exterior, waiting room, concourse, neighbourhood and railway share one continuously loaded world. Two restored southern passage bays now connect the Main court to the outer departure stairs; the principal steel angle sections and all nine rear stair-well guards are corrected.

The intended period is1935–1940, using opening-era plans and photographs as anchors. Minor dimensions, later alterations, material appearance and several major unfinished areas remain qualified. This is a phased reconstruction with further photographic fidelity work ahead. See the [research register](RESEARCH.md), [source catalogue](sources.json), [circulation evidence](model/circulation-evidence.md) and [validation](VALIDATION.md).

| Before | After | Why |
| --- | --- | --- |
| Southern masonry blocks two outer stair entrances | Two source-supported lower passage bays between retained piers | Connect the Main court to the peripheral departures |
| Outward corner angles enlarge the principal columns |32principal and144isolated minor angle legs corrected around fixed anchors | Recover the documented principal envelope while retaining bases/lattice |
| Rear stair-well edges have no visible barrier | Nine grounded rear closures joined to existing side guards | Complete the visible well perimeter; dimensions remain reconstructed |

Sixteen legs at four ambiguous secondary joints remain exact pending joint reconstruction. The existing departure flights, gate indicators, Main/Exit/platform datums and provisional arrivals deck retain their geometry. The approximately1.6m gate/pier registration difference remains unresolved. Western Main-floor openings and the separate arrivals stairs require coordinated reconstruction.

## Explore

Choose **Enter Station**. **Walk is the default**: drag to look, use **WASD/arrows** to walk and **Shift** for speed. Eye height follows actual floors/stairs. **Environment → Orbit** enables free flight, with **Q/E** for height. The three main viewpoints move the camera around the same loaded station. Fields, dialogs and blur guard movement input.

Daylight, field of view, shadows, quality, annotations, approximate archive comparisons and optional ambience are available. Existing touch/low-quality fallbacks remain; fuller Manhattan and further mobile optimization are deferred.

## Rendering and evidence

Blender authors the architecture. React, React Three Fiber, Drei and Three.js render glTF2.0 with Meshopt and shared KTX2 textures. WebGL2 is the default; native WebGPU parity remains experimental. GitHub Pages requires no backend or visitor build step.

Eight illumination records are retained: the six original room/architecture atlases, the separate departure-access atlas and a new2048px/64-sample atlas for the closed southern wall residual. Existing room/floor lighting and static probes remain unchanged. Stone roughness refinements and two photograph-supported waiting-room brackets carry forward. The separately saved ceiling finish is still under review. Glass/stone optics, historic colours and static probes remain interpretations.

Runtime model, unique texture, light and probe transfer totals **174,008,834bytes**. All12GLBs validate with zero errors,330recorded warnings and75shared KTX2 textures. Actual compressed-geometry checks cover all27flights, the restored Main/P1/P2 route, P3body clearance and rear barriers. The published browser completes both outer platform roundtrips with six persistent zones. Request events and hardware limits remain in the [validation record](VALIDATION.md); no fresh FPS or physical-phone certification is claimed.

Custom staging omits Blender/build tools and unbundled frontend sources while retaining runtime assets, licences and research documents. The complete legacy-root site remains below1GB. Source history is public and recoverable through immutable Git identities and verified backups; [asset rights](ASSET_RIGHTS.md) identify the references. Hosting settings remain unchanged. Engineering Journal and Crystal Palace remain removed.

## Remaining work

Separate arrivals stairs, western floor openings, platform enclosure, further concourse/track/arcade detail, waiting-room ceiling/material finish, five murals and realistic passengers remain unfinished. Fuller Manhattan/mobile work is deferred. Exterior roof flicker stays last in this iteration. [PR11](https://github.com/stavreskimario/stavreskimario.github.io/pull/11) remains draft and unmerged.
