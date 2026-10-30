# Pennsylvania Station — Phase 4

An evidence-led reconstruction of the original Pennsylvania Station for Mario's GitHub Pages collection. This iteration rebuilds the waiting-room roof and ceiling, refines supported interiors and materials, and reduces desktop rendering cost. Exterior, waiting room, concourse, streets and railway share one continuously loaded world.

A smaller subsequent maintenance checkpoint repairs competing concourse floor surfaces and initializes cached shadows consistently. [Its validation](VALIDATION.md) identifies the exact runtime. The broader Phase5 stone/ceiling/bracket visual pass remains under review.

The final photographic target remains in progress. This is a phased reconstruction aimed at 1935–1940, anchored in original drawings, engineering records and photographs; later alterations and minor profiles remain qualified. It is not a certified 1:1 replica. See the [research register](RESEARCH.md), [source catalog](sources.json) and [model ledger](model/README.md).

## This iteration

| Before | After | Why |
| --- | --- | --- |
| Warped coffers, inward dark ribs and overlapping roof valleys | Continuous curved relief, corrected arch faces and shared roof boundaries | Repair the known roof geometry defects |
| Capital carving receives too little lighting coverage; hidden leaf returns intersect | Dedicated 4K order maps and 128 repaired closed shells | Preserve visible detail and remove false self-occlusion |
| Concourse windows/floor fields are incomplete | Separate sash bodies and arched heads, ticket frontage and broad square-prism court | Restore documented construction with inferred dimensions recorded |
| Coarse booths, benches and lamps | Refined grilles/vents, slatted benches and photographed five-globe standards | Improve supported interior details |
| Repeated static shadow and glass-back rendering | Cached shadows and front faces for closed prisms | Improve responsiveness while retaining transmission and all six zones |
| Distant Hotel pavement bands and roof striping | Feature-detected reversed depth in WebGL | Remove verified depth-precision artifacts |

Stone uses the original nine CC0 granite/travertine/marble maps, interpreted colour profiles and restrained normal strengths. Separately authored seamless Bedford grain and opal lamp glass remain material interpretations. The authenticated north mural retains its native 728×260 monochrome crop; the other five fields remain neutral. No invented clock placement or generic passenger crowd is presented as completed work.

The prism court contains 2,488 linked panels and 248,800 square units, with solid bearing cells and opaque circulation retained. Original photographs and Gibbs document the construction; exact field edges, pitch, module and small mouldings remain inferred. The [interior ledger](model/concourse-detail-evidence.md) records those limits.

## Explore

Open this folder on a static server or GitHub Pages and choose **Enter Station**. **Walk is the default**, with human eye height, body collision and real floor/tread support. Drag to look, use **WASD/arrows** to walk and **Shift** for speed. Choose **Environment → Orbit** for free flight, including **Q/E** for height. Ordinary station viewpoints preserve your selected movement mode; archive comparisons and the guided tour use their cinematic framing. Viewpoints, the map and tour move through the same loaded station. Native fields, dialogs and blur guard camera input.

Daylight, FOV, shadows, quality, annotations, archive comparisons and opt-in synthesized ambience remain available. Historical camera matches are approximate. Existing touch/low-quality fallbacks remain; further mobile optimization is deferred in this desktop-focused iteration.

## Rendering and authoring

Blender 4.3 authors the geometry, including Geometry Nodes for repeated Doric components. React, React Three Fiber, Drei and Three.js render glTF 2.0 with Meshopt, shared KTX2 surfaces and progressive loading. WebGL 2 is the default; optional WebGPU and visual parity remain experimental. The site requires no backend or visitor build step.

Illumination uses 8192px vault, 4096px masonry/order and 2048px exterior/concourse/platform atlases, with six diffuse bounces. The order uses 512 Metal samples; other atlases 128. Desktop order AO stays 4K. Static HDR captures use 2048×1024 at 64 samples. Explicit linear transfer, lossless WebP and decoded HDR archive hashes preserve the source radiance. These static approximations have no positional parallax or time-specific indirect relighting. Historic colour, polish and photometry are not calibrated.

Current editable sources, original maps, retained HDRs and reviews are public under repository-root authoring/penn-station-1935/. Superseded scenes remain recoverable through immutable Git references; older HDR compression is lossless. Exclusion from custom staging does not make authoring private under legacy root Pages. See [asset rights](ASSET_RIGHTS.md) and [authoring instructions](model/README.md).

## Validation and remaining work

[VALIDATION.md](VALIDATION.md) identifies exact bundle/assets, source audits, actual browser screenshots, navigation and recovery checks, measured rendering and publication evidence. On the tested Chrome/Apple M5 Max, four production views measured approximately 60 render updates/second; this is not a universal hardware guarantee.

Runtime models, unique textures and lighting total 149,469,306 bytes across both geometry variants. The internal whole-site staging allowance is 160MB; the complete legacy-root public site also stays below its separate 1 GB limit. Hosting settings are unchanged. Engineering Journal and Crystal Palace were removed from the collection with their journal-specific collection/scheduling support.

Plaster mottling, some shaft specks, a residual dark curl sample and distant prism-grid moire remain visible. Fine ornament, some furnishing/sign details, five murals, realistic period passengers, exact late-1930s operations and fuller Manhattan surroundings remain future work. This iteration improves the reconstruction without declaring the final photographic target achieved. The PR remains unmerged pending owner authorization.
