# Pennsylvania Station — material and interior checkpoint

An evidence-led reconstruction of the original Pennsylvania Station for Mario's GitHub Pages collection. This checkpoint refines three stone finishes and adds two photograph-supported waiting-room wall fixtures. Exterior, waiting room, concourse, neighbourhood and railway remain one continuously loaded world.

The corrected ceiling charts and fresh vault bake are saved; their browser finish remains under review. This delivery retains the existing vault geometry and all six Phase 4 illumination atlases, AO bindings and static reflection probes. It does not complete the broader Phase 5 ceiling pass or the final photographic target.

The intended period is 1935–1940, with opening-era drawings and photographs as architectural anchors. Minor dimensions, later alterations and appearance remain qualified; this is not a certified 1:1 replica. See the [research register](RESEARCH.md), [source catalog](sources.json) and [model ledger](model/README.md).

## This checkpoint

| Before | After | Why |
| --- | --- | --- |
| Very low effective roughness produces harsh stone highlights | Bounded linear roughness profiles for interior granite, exterior granite and travertine, each with a unit multiplier | Give the modern CC0 references a restrained interpreted finish without multiplying dark source values again |
| Two photographed foreground wall fixtures are absent | A supported twin-globe bracket on each documented long-wall panel, with finer radial sampling on the existing cup/finial profiles | Recover a specific missing fitting without inventing a complete lighting inventory |
| The earlier movement/floor repair needs to carry forward | Default Walk, supported street eye height, corrected floor layers and synchronized cached shadows remain | Preserve the verified navigation and floor checkpoint while changing the finish/fixture layer |

[The roughness provenance](../authoring/penn-station-1935/materials/phase5/roughness-provenance.json) records the selected B profiles: InteriorGranite 0.30–0.48, MilfordGranite 0.55–0.78 and Travertine 0.60–0.78. These are authored ranges in linear data, not measurements of historic stone. All nine original ambientCG maps, the four existing colour profiles, normal strengths, architectural surface UVs and marble-family roughness remain intact. The separate authored Bedford grain and existing opal-glass response remain interpreted materials.

[The wall-fixture ledger](../authoring/penn-station-1935/review/phase5/wall-brackets/README.md) and [radial refinement](../authoring/penn-station-1935/review/phase5/wall-brackets/silhouette-refinement/README.md) distinguish photographed form from inferred size, placement and optics. Both credited reference crops come from the same opening-era LOC photograph. Only two foreground fixtures are added; exact 1935 retention and the complete fixture inventory remain unverified. No live lights or new lighting bake are added.

The broad prism court, repaired capital shells, roof, furnishings and railway retain their previous geometry, apart from the two appended fixtures. Exact prism boundaries/pitch and minor ornament remain inferred. The authenticated north mural remains its native 728×260 monochrome recovery; five other mural fields remain neutral.

## Explore

Choose **Enter Station**. **Walk is the default**, with a 1.68m street eye height and existing collision/floor support. Drag to look, use **WASD/arrows** to walk and **Shift** for speed. **Environment → Orbit** provides free flight, including **Q/E** for height. Ordinary viewpoints preserve the selected movement mode; archive comparisons and the guided tour use their cinematic framing. Exterior and interiors share the same loaded station. Fields, dialogs and blur guard camera input.

Daylight, field of view, shadows, quality, annotations, approximate archive comparisons and optional synthesized ambience remain available. Existing touch/low-quality fallbacks remain; further mobile optimization and the fuller Manhattan environment are deferred while desktop architecture takes priority.

## Rendering and source evidence

Blender authors the station and fixtures. React, React Three Fiber, Drei and Three.js render glTF 2.0 using Meshopt and shared KTX2 textures. WebGL 2 remains the default; native WebGPU parity is experimental. GitHub Pages needs no backend or visitor build step.

All six retained Phase 4 GI atlases remain unchanged: 8192px vault, 4096px masonry/order and 2048px exterior/concourse/platform. The order uses 512 Metal samples; the other atlases use 128, with six diffuse bounces. Desktop order AO remains 4K. The retained static probes use 2048×1024 HDR at 64 samples, with existing low derivatives. Their source/denoise archives remain under `authoring/penn-station-1935/lighting/phase4/`. The new 25-degree ceiling charts and their separate bake are not part of this checkpoint.

Static probes have no positional parallax or time-specific indirect relighting. Historic colour, polish, lighting output and weather remain uncalibrated. Original maps, current editable sources and review files are public under repository-root `authoring/penn-station-1935/`; historical versions use the recorded immutable Git recovery paths. Exclusion from custom staging does not make those files private. See [asset rights](ASSET_RIGHTS.md) and [authoring instructions](model/README.md).

## Validation and remaining work

[VALIDATION.md](VALIDATION.md) identifies this checkpoint's exact bundle, model identities and scoped tests. The [actual production browser receipt](../authoring/penn-station-1935/review/phase5/stone-checkpoint/production-browser-summary.json) passes default walking, supported movement, all three main views, six persistent zones and the three linear roughness-map bindings. [Actual published verification](../authoring/penn-station-1935/review/phase5/stone-checkpoint/final-publication.json) matches the bundle and six models, with supported walking and no page, HTTP or network failures. All eight checks and the matching Pages deployment pass; PR11 remains draft and unmerged.

Runtime model, unique texture and lighting bytes: **161,327,896 bytes** across both variants. The asset check passes 12 decoded GLBs with zero errors, 280 retained warnings and 76 shared KTX2 files. The internal custom-stage allowance is **180,000,000 bytes**; the complete legacy-root public tree must remain below its separate 1GB limit. Hosting settings are unchanged. The registry retains three apps; Engineering Journal and Crystal Palace remain removed.

The preceding [floor](../authoring/penn-station-1935/review/phase5/floor-checkpoint/final-publication.json) and [default-walking](../authoring/penn-station-1935/review/phase5/default-walking/final-publication.json) receipts establish those published checkpoints. Current asset and browser evidence identifies the new material/fixture bytes separately. No new FPS result is claimed here.

Ceiling mottling and its fresh bake remain unfinished, alongside distant prism-grid moiré, fine ornament/furnishing details, five murals, realistic period passengers, exact late-1930s operations and the fuller Manhattan environment. The PR remains unmerged pending owner authorization.
