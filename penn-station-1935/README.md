# Pennsylvania Station — platform construction checkpoint

Current checkpoint: the connected Seventh Avenue vestibule, arcade and Ionic loggia are now explorable through to the waiting room. [Validation](VALIDATION.md) records the21-leg native roundtrip, source accuracy and remaining lighting/finish limitations. All six zones load together; Walk remains default.

An evidence-led reconstruction of the original Pennsylvania Station for Mario's GitHub Pages collection. Exterior, waiting room, concourse, neighbourhood and railway share one continuously loaded world. Sixteen independent arrival staircases connect eight ordinary platform correspondences to the lower Exit gallery. The first eight platforms now have source-controlled concrete overhangs, coved undersides, continuous supporting walls and a finer granolithic finish, with fresh illumination from the current station geometry.

The intended period is 1935–1940, using opening-era plans and photographs as anchors. Minor dimensions, later alterations, finishes and major unfinished areas remain qualified. This is a phased reconstruction with further photographic fidelity work ahead. See the [research register](RESEARCH.md), [source catalogue](sources.json), [arrivals evidence](model/arrivals-evidence.md) and [validation](VALIDATION.md).

| Before | After | Why |
| --- | --- | --- |
| Provisional narrow Exit deck without separate arrival stairs | A source-width gallery and sixteen stairs with two flights and a flat intermediate landing each | Reconstruct the separate arrival circulation |
| Old deck and lamp positions conflict with the new stairs | Exact old-cell removal, closed northern retained portions and sixteen complete relocated lamp assemblies | Coordinate the floor, access and actual fixture supports |
| Missing lower frame and lift enclosures | Individually traced supports and eight distinct lift enclosures, with unresolved transfers held | Add source-backed structure without cloning a regular generic grid |
| No lighting for the widened gallery | Independent 4K sky illumination, contact AO and practical lights following actual glowers | Make the new circulation readable in the same loaded world |

## Explore

Choose **Enter Station**. **Walk is the default**: drag to look, use **WASD/arrows** to walk and **Shift** for speed. Eye height follows actual floors and stairs. Shift walking is 15% faster than the previous checkpoint; ordinary walking and free-flight speeds are unchanged. Open **Station plan → The lower arrivals gallery** to reach the new viewpoint. **Environment → Orbit** enables free flight, with **Q/E** for height; switching back to Walk retains the arrivals viewpoint.

The large location card has been removed so the architecture stays visible; viewpoint names remain in navigation. The main viewpoints move the camera around the same station. Daylight, field of view, shadows, quality, annotations, approximate archive comparisons and optional ambience remain available. Fields, dialogs and blur guard movement input. Fuller Manhattan and further mobile optimization are deferred.

## Platform construction and rendering

Blender authors the architecture. React, React Three Fiber, Drei and Three.js render glTF 2.0 with Meshopt and shared KTX2 textures. WebGL 2 is the default; native WebGPU parity remains experimental. GitHub Pages requires no backend or visitor build step.

Ten illumination records include the new 4096 px platform atlas baked with 64 samples, a 512 px fallback and 2048 px contact AO. The platform addition uses two material batches and lossless Meshopt compression of the original floating-point geometry, preserving thin surfaces and stair contacts. Existing northern platform lighting and static reflection captures remain retained. Stone, glass and historical colour remain appearance interpretations.

Model, unique texture, light and probe transfer totals **190,675,029 bytes** across both variants. All 12 GLBs validate with zero errors,380 recorded warnings and 80 shared KTX2 textures. The [platform evidence](model/platform-section-evidence.md) distinguishes documented construction from interpreted centre depth, flat tops, end closures and finish values. Actual compressed geometry passes all 25 stair-foot seams, source-based floor/cove/foundation contacts and scoped arrival/departure routes. The native 34-leg connected walking loop passes with both new materials and 4K lightmaps bound and six persistent zones. [Validation](VALIDATION.md) keeps functional acceptance separate from sustained performance.

The [core editable-source history](../authoring/penn-station-1935/review/phase8/arrivals/canonical-history.md) and [platform source/replay](../authoring/penn-station-1935/review/phase9/platform-sections/README.md) preserves the new scene, exact earlier-source recovery and a standalone CLI replay that reproduces the raw geometry byte for byte. Required lighting sources remain retained or recoverable through immutable Git identities and verified backups. [Asset rights](ASSET_RIGHTS.md) identify the references.

Custom staging uses a bounded220 MB allowance for the added entrance lighting/reflections; the current stage measures212.96 MB. The conservative complete legacy tree is approximately992.2 MB, below 1 GB. Hosting settings are unchanged; Engineering Journal and Crystal Palace remain removed.

## Remaining work

Northern P9/LIRR arrivals, streetward exits, western Main-floor openings/supports and the broader platform enclosure remain unfinished. Twenty-six upper transfer cases and two lower support positions remain held. Lift enclosures are visual models, not functioning elevators or authenticated assignments of the three Main-reaching lifts. Absolute placement retains at least ±1 m source-registration uncertainty.

Further stone/glass realism, waiting-room ceiling and concourse/track/arcade detail, five murals and realistic period passengers remain open. Fuller Manhattan/mobile work is deferred. Exterior roof flicker stays last. [PR11](https://github.com/stavreskimario/stavreskimario.github.io/pull/11) remains draft and unmerged.
