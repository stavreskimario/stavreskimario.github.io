# Pennsylvania Station — arrivals lighting checkpoint

The arrivals lighting checkpoint is live. A fresh 4K/256-sample bake and denser tread/landing lighting improve the existing arrivals stairs while preserving geometry, surface materials and walking routes. Source/pixel checks, both decoded variants and the 34-leg local native loop pass. Public Pages verification matches 19 actual response bodies and eight native stair/gallery walking legs, with all six zones continuously loaded. Walk remains default. Broader photographic fidelity and arrivals construction remain in progress.

[Open the live arrivals checkpoint](https://stavreskimario.github.io/penn-station-1935/?preview=ed4e00b). [Matching deployment and public evidence](../authoring/penn-station-1935/review/phase9/arrivals-lighting-priority/final-publication.json) binds the delivered files to immutable `ed4e00b`; [Validation](VALIDATION.md) retains the source, physical, local and public results.

An evidence-led reconstruction of the original Pennsylvania Station for Mario's GitHub Pages collection. Exterior, waiting room, concourse, neighbourhood and railway share one continuously loaded world. Sixteen independent arrival staircases connect eight ordinary platform correspondences to the lower Exit gallery. The first eight platforms now have source-controlled concrete overhangs, coved undersides, continuous supporting walls and a finer granolithic finish, with fresh illumination from the current station geometry.

The intended period is 1935–1940, using opening-era plans and photographs as anchors. Minor dimensions, later alterations, finishes and major unfinished areas remain qualified. This is a phased reconstruction with further photographic fidelity work ahead. See the [research register](RESEARCH.md), [source catalogue](sources.json), [arrivals evidence](model/arrivals-evidence.md) and [validation](VALIDATION.md).

| Before | After | Why |
| --- | --- | --- |
| Provisional narrow Exit deck without separate arrival stairs | A source-width gallery and sixteen stairs with two flights and a flat intermediate landing each | Reconstruct the separate arrival circulation |
| Old deck and lamp positions conflict with the new stairs | Exact old-cell removal, closed northern retained portions and sixteen complete relocated lamp assemblies | Coordinate the floor, access and actual fixture supports |
| Missing lower frame and lift enclosures | Individually traced supports and eight distinct lift enclosures, with unresolved transfers held | Add source-backed structure without cloning a regular generic grid |
| Uniform lighting allocation on arrival stairs | Denser tread/landing charts, fresh 4K/256-sample illumination and AO on the existing geometry | Resolve stair lighting while preserving source circulation |

## Explore

Choose **Enter Station**. **Walk is the default**: drag to look, use **WASD/arrows** to walk and **Shift** for speed. Eye height follows actual floors and stairs. Shift walking is 15% faster than the previous checkpoint; ordinary walking and free-flight speeds are unchanged. Open **Station plan → The lower arrivals gallery** to reach the new viewpoint. **Environment → Orbit** enables free flight, with **Q/E** for height; switching back to Walk retains the arrivals viewpoint.

The large location card has been removed so the architecture stays visible; viewpoint names remain in navigation. The main viewpoints move the camera around the same station. Daylight, field of view, shadows, quality, annotations, approximate archive comparisons and optional ambience remain available. Fields, dialogs and blur guard movement input. Fuller Manhattan and further mobile optimization are deferred.

## Platform construction and rendering

Blender authors the architecture. React, React Three Fiber, Drei and Three.js render glTF 2.0 with Meshopt and shared KTX2 textures. WebGL 2 is the default; native WebGPU parity remains experimental. GitHub Pages requires no backend or visitor build step.

Ten illumination records include the new 4096 px platform atlas baked with 64 samples, a 512 px fallback and 2048 px contact AO. The platform addition uses two material batches and lossless Meshopt compression of the original floating-point geometry, preserving thin surfaces and stair contacts. Existing northern platform lighting and static reflection captures remain retained. Stone, glass and historical colour remain appearance interpretations.

The delivered arrivals lighting checkpoint records 219,408,187 referenced model/texture/light/probe bytes across both variants. All 12 GLBs pass with zero errors, 438 recorded warnings and 89 shared KTX2 textures. [Platform evidence](model/platform-section-evidence.md) distinguishes documented construction from interpreted depths, flat tops, end closures and finishes. Current decoded arrivals routes, tread/guard/support contacts and the local 34-leg native loop pass; [Validation](VALIDATION.md) keeps those functional results separate from sustained performance and publication.

The [core editable-source history](../authoring/penn-station-1935/review/phase8/arrivals/canonical-history.md) and [platform source/replay](../authoring/penn-station-1935/review/phase9/platform-sections/README.md) preserves the new scene, exact earlier-source recovery and a standalone CLI replay that reproduces the raw geometry byte for byte. Required lighting sources remain retained or recoverable through immutable Git identities and verified backups. [Asset rights](ASSET_RIGHTS.md) identify the references.

The arrivals public stage fits the measured 240 MB internal allowance, preserving full-resolution maps. Exact file/byte counts are retained in the lighting review; the separate complete legacy-root limit stays 1 GB. Hosting settings are unchanged; Engineering Journal and Crystal Palace remain removed.

## Remaining work

The next geometry milestone is a coordinated **first eight gallery-edge, stair and underside finish**, starting with one P5 review bay. Primary photographs support open metal guards and exposed framing beside the tracks. Finish actual fascia, landing/stringer seats and guard/newel joins while retaining those open views; add no generic opaque side walls. The [qualified source plan](../authoring/penn-station-1935/review/phase9/arrivals-lighting-priority/next-checkpoint-v2.md) requires registered bearing and train-clearance checks before repeating the bay. The general 5 in beam-top rule does not establish a universal slab or gallery soffit datum.

Northern P9/LIRR arrivals, streetward exits, western Main-floor openings/supports and the broader platform enclosure remain unfinished. Twenty-six upper transfer cases and two lower support positions remain held. Lift enclosures are visual models, not functioning elevators or authenticated assignments of the three Main-reaching lifts. Absolute placement retains at least ±1 m source-registration uncertainty.

Further stone/glass realism, waiting-room ceiling and concourse/track/arcade detail, five murals and realistic period passengers remain open. Fuller Manhattan/mobile work is deferred. Exterior roof flicker stays last. [PR11](https://github.com/stavreskimario/stavreskimario.github.io/pull/11) remains draft and unmerged.
