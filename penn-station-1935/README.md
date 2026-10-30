# Pennsylvania Station — independent arrivals checkpoint

An evidence-led reconstruction of the original Pennsylvania Station for Mario's GitHub Pages collection. Exterior, waiting room, concourse, neighbourhood and railway share one continuously loaded world. Sixteen independent arrival staircases now connect eight ordinary platform correspondences to the lower Exit gallery, alongside the retained Main departure routes and southern passage connections.

The intended period is 1935–1940, using opening-era plans and photographs as anchors. Minor dimensions, later alterations, finishes and major unfinished areas remain qualified. This is a phased reconstruction with further photographic fidelity work ahead. See the [research register](RESEARCH.md), [source catalogue](sources.json), [arrivals evidence](model/arrivals-evidence.md) and [validation](VALIDATION.md).

| Before | After | Why |
| --- | --- | --- |
| Provisional narrow Exit deck without separate arrival stairs | A source-width gallery and sixteen stairs with two flights and a flat intermediate landing each | Reconstruct the separate arrival circulation |
| Old deck and lamp positions conflict with the new stairs | Exact old-cell removal, closed northern retained portions and sixteen complete relocated lamp assemblies | Coordinate the floor, access and actual fixture supports |
| Missing lower frame and lift enclosures | Individually traced supports and eight distinct lift enclosures, with unresolved transfers held | Add source-backed structure without cloning a regular generic grid |
| No lighting for the widened gallery | Independent 4K sky illumination, contact AO and practical lights following actual glowers | Make the new circulation readable in the same loaded world |

## Explore

Choose **Enter Station**. **Walk is the default**: drag to look, use **WASD/arrows** to walk and **Shift** for speed. Eye height follows actual floors and stairs. Open **Station plan → The lower arrivals gallery** to reach the new viewpoint. **Environment → Orbit** enables free flight, with **Q/E** for height; switching back to Walk retains the arrivals viewpoint.

The main viewpoints move the camera around the same station. Daylight, field of view, shadows, quality, annotations, approximate archive comparisons and optional ambience remain available. Fields, dialogs and blur guard movement input. Fuller Manhattan and further mobile optimization are deferred.

## Rendering and evidence

Blender authors the architecture. React, React Three Fiber, Drei and Three.js render glTF 2.0 with Meshopt and shared KTX2 textures. WebGL 2 is the default; native WebGPU parity remains experimental. GitHub Pages requires no backend or visitor build step.

Nine illumination records include the new 4096 px, 64-sample arrivals atlas and its 512 px fallback, with 2048 px runtime contact AO. The addition packages into four mesh batches. Earlier room maps, platform illumination and static reflection captures remain retained; the platform lighting and older probes still need reconciliation with the enlarged gallery. Stone, glass, floor finish and historic colours remain appearance interpretations.

Model, unique texture, light and probe transfer totals **180,772,199 bytes** across both variants. All twelve GLBs validate with zero errors, 362 recorded warnings and 76 shared KTX2 textures. Actual compressed-geometry checks cover all arrival flights, gallery aisles, retained P1/P2/P5 departures, support contacts and complete fixture mounts. Native browser results and publication are recorded separately in [validation](VALIDATION.md); no fresh FPS or physical-phone certification is claimed.

The [editable-source history](../authoring/penn-station-1935/review/phase8/arrivals/canonical-history.md) preserves the new scene, exact earlier-source recovery and a standalone CLI replay that reproduces the raw geometry byte for byte. Required lighting sources remain retained or recoverable through immutable Git identities and verified backups. [Asset rights](ASSET_RIGHTS.md) identify the references.

Custom staging measures approximately 186.77 MB under its revised 200 MB internal allowance. The complete legacy-root site remains below 1 GB. Hosting settings are unchanged; Engineering Journal and Crystal Palace remain removed.

## Remaining work

Northern P9/LIRR arrivals, streetward exits, western Main-floor openings/supports and the broader platform enclosure remain unfinished. Twenty-six upper transfer cases and two lower support positions remain held. Lift enclosures are visual models, not functioning elevators or authenticated assignments of the three Main-reaching lifts. Absolute placement retains at least ±1 m source-registration uncertainty.

Further stone/glass realism, waiting-room ceiling and concourse/track/arcade detail, five murals and realistic period passengers remain open. Fuller Manhattan/mobile work is deferred. Exterior roof flicker stays last. [PR11](https://github.com/stavreskimario/stavreskimario.github.io/pull/11) remains draft and unmerged.
