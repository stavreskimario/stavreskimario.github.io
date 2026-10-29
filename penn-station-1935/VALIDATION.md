# Phase 2 preview validation — 29 October 2026

This release advances the explorable architectural study. It does **not** meet the brief's final photographic-fidelity or fully authenticated 1935–1940 acceptance gates. Detailed ornament, murals, complete circulation and railway layout, neighbouring parcels and calibrated appearance remain unfinished. The [research register](RESEARCH.md), [architecture ledger](model/README.md), [context ledger](model/context-research.md) and [rolling-stock ledger](model/rolling-stock-research.md) distinguish evidence from interpretation.

Evidence is retained outside the app at [authoring/penn-station-1935/review/phase2](../authoring/penn-station-1935/review/phase2/). The previous [Phase 1 evidence](../authoring/penn-station-1935/review/phase1/) and editable scene remain available.

## Delivered architecture and geometry checks

The authored Blender scene now includes relief coffers, articulated column orders and individual imposts, five-light thermal windows, granite shafts, concourse lattice piers and unequal intersecting vaults, lower perimeter arcades, a connected axial route and actual stair openings. Separate authored chunks provide Hotel Pennsylvania, the General Post Office, generic period street furnishings/cars, a representative platform, an early GG1 interpretation and two P70 coaches. These remain reconstructions rather than surveyed reproductions.

| Anchor or check | Implemented result and qualification |
| --- | --- |
| Station envelope | Nominal 784 × 430 ft / 238.9632 × 131.064 m. Conflicting published outside extents remain documented. |
| Waiting hall | 103 × 277 ft clear-floor anchor. Other reported room, frame and lantern dimensions are separate datums. |
| Waiting-room height | **150 ft model envelope remains provisional.** Francis and O'Brien give 143 ft to the highest ceiling and 167 ft to the roof; the PRR booklet's 150 ft figure describes floor to roof. Decoding confirms the implemented envelope, not its historical correctness. |
| World levels | Street 0; main floor −4.2672 m; working exit floor −7.4676 m; rail −13.154025 m; representative platform −11.985625 m. Local slopes and dated drawing differences remain unresolved. |
| Main stair | 28 risers of 6 in; 39 ft 6 in working width. Source floor/doorway sweeps report no missing samples along the axial route. |
| Nine lower stair groups | Source audit reports no missing floor samples along the inspected paths and maximum first-dogleg riser below 0.141 m. This is a geometry audit, not proof of every browser route. |
| Platform | Working 46 in above rail and 5 ft 3 in from track centre to edge. Only one representative bay is supplied; the complete 21-track/11-platform layout is absent. |
| Export integrity | All twelve full/mobile GLBs decode with Meshopt, retain KTX2 textures and produce **zero Khronos glTF validation errors**. Some validator warnings/notices are retained in the report. |

The [source route audit](../authoring/penn-station-1935/review/phase2/route-audit.json), [final lower-stair audit](../authoring/penn-station-1935/review/phase2/route-audit-final.json), [geometry notes](../authoring/penn-station-1935/review/phase2/geometry-notes.md) and [decoded-asset report](../authoring/penn-station-1935/review/phase2/asset-validation.json) preserve the actual checks and their limits. Source stills use Blender review lighting and must not be confused with browser screenshots.

## Materials, lighting and transfer

Exterior, waiting room and concourse have separate 2048 px, 64-sample Cycles neutral-sky diffuse-illumination and AO bakes. The browser samples the exported atlas channel, including channels renumbered during optimization. Directional sun stays dynamic. Glazing does not act as an opaque blocker in the ordinary shadow pass. Painted structural iron uses a dielectric painted surface.

The bake excludes adjacent city occluders. Glass, exposure, roughness, close-range stone appearance and reference sunlight are not photographically calibrated. Concourse thin-member atlas coverage is limited; baking alone is not a final visual-quality certification. The separate platform, neighbourhood and rolling stock use unbaked PBR materials and runtime lighting.

Modern CC0 ambientCG granite/travertine maps interpret the stone; they are not scans of the station. Original HDR/AO maps and actual bake reports are retained in [authoring lighting](../authoring/penn-station-1935/lighting/). Bounded sky illumination is encoded to sRGB and then lossless WebP; the pipeline verifies unchanged decoded RGB pixels. Surface/AO maps use shared KTX2/UASTC files. See [asset rights](ASSET_RIGHTS.md).

| Chunk | Full model transfer | Mobile model transfer |
| --- | ---: | ---: |
| Exterior | 0.55 MB | 0.82 MB |
| Waiting room | 3.45 MB | 3.52 MB |
| Concourse | 4.14 MB | 4.15 MB |
| Neighbourhood | 0.49 MB | 0.65 MB |
| Platform | 0.019 MB | 0.041 MB |
| Trains | 0.12 MB | 0.16 MB |

These are decimal **GZip model transfer sizes**, excluding shared textures, illumination, environment and decoder. Low variants can have larger GZip files despite fewer decoded vertices. The complete twelve-model set plus 57 unique KTX2 textures and six illumination WebPs is **69,274,219 bytes**. Files load progressively by view; Walk loads the connected world. Exact decoded and transferred sizes are in [asset metrics](assets/asset-metrics.json). GZip wrapping is checked byte-identical on decompression and requires no special response headers.

Whole-site public staging passed at **75,424,983 bytes across 148 files**, below the repository's 100,000,000-byte gate. Later documentation-only changes can slightly alter that total. Original Blender files, source maps and review images are outside the custom public staging tree; all repository contents are nevertheless public, and legacy root Pages may serve the authoring directory.

## Repository and browser checks

The whole-site validator passes for five apps. The existing catalogue validates 182 articles, all nine engineering-feed unit tests pass, and public staging rejects hidden files/symlinks while retaining the existing applications. The existing engineering-journal browser regression passed during this phase. The production bundle was rebuilt from pinned dependencies; all runtime paths remain relative. No shared app implementation was changed.

The Phase 2 browser and real-keyboard route reports are recorded with their final results in the review directory. Tests serve the repository under `/exhibition/` with external requests blocked. They inspect decoded geometry and lighting, rather than treating a completed network request as proof of a rendered scene. Browser frame scheduling under ANGLE/SwiftShader must not be presented as physical GPU performance.

Chrome **156.0.8078.48** passed seven desktop integration groups: all authored views and baked maps; orbit; exact neighbouring-landmark presets; human-height walking, live map projection and a measured wall stop; daylight/FOV/shadows and repeated quality changes without accumulating geometry; annotations; archival framing, modal focus/Tab/Escape and tour start/cancel. The [initial full-run report](../authoring/penn-station-1935/review/phase2/validation-before-text-fix.json) then correctly failed on mobile Sources overflow at 200% text.

The phone-only CSS fix removes min-content grid overflow and wraps long copy. Measured Sources width changed from **318 px client / 338 px scroll** to **318 / 318**, with no body overflow. A [targeted rerun](../authoring/penn-station-1935/review/phase2/mobile-recovery-after-text-fix/validation.json) passed the remaining four groups: 390 × 844 touch walking, reduced motion and enlarged text with reachable close control; model 503 retry; HDR retry; and unavailable-graphics fallback with usable research. Only CSS changed among fingerprinted runtime files. These are combined results from the desktop run and corrected mobile/recovery run, not a claim that the original full run passed. The default runner still executes every group; `PENN_SECTION=mobile-recovery` selects the targeted subset.

The separate [real-keyboard route](../authoring/penn-station-1935/review/phase2/penn-route-validation.json) **passed outward and return journeys**: Seventh Avenue → arcade → 28-riser descent → waiting hall → sidestep around the stair well → concourse → hall → upward main stair. The camera retained its original pose sequence and changed location labels automatically. The return reached street eye height at approximately `[28.66, 1.68, 0]`. This run used low quality and a 320 × 240 drawing area inside a 640 × 480 viewport to limit software-renderer cost; all connected geometry and collision surfaces remained present. No uncaught errors or failed local resources occurred. It does not validate every lower stair or real-device frame rate.

A separate smoke run in installed **Chrome 156.0.8078.48** requested `?renderer=webgpu` and rendered the updated exterior through **WebGL 2 compatibility**. This verifies the observed fallback, not native WebGPU on a physical GPU. The [fallback report](../authoring/penn-station-1935/review/phase2/current-chrome-fallback.json) retains the actual browser result.

## Visual comparison and remaining acceptance work

The Archive view uses opening-era public-domain monograph photographs with **approximate** model-framing controls. These are neither calibrated matching cameras nor verified 1935 exposures. Neutral fields reserve the six known Guérin mural positions without inventing their paintings. Source photographs and drawings guided review of column/impost arrangements, windows, vault framing, arcades and stair openings; the ledgers retain unresolved discrepancies.

Final acceptance still requires reconciled ceiling/roof sections, surveyed sculpture and ornament, authentic murals and later-period furnishings/signage, complete tracks and adjoining passenger spaces, date-checked Manhattan parcels, passengers, calibrated photographic materials/light/reflections, and reliable distance LOD/occlusion and performance measurements on physical hardware. No physical phone, Safari/Firefox coverage, assistive-technology user study or native-WebGPU hardware certification is claimed.

## Publication

The pull request remains a draft and unmerged. A read-only GitHub settings check confirms that Pages currently publishes `feature/penn-station-1935-reconstruction` at `/`, despite the repository documentation describing `main`. This task has not changed that setting. Under the observed configuration, a feature-branch push updates the public preview. Any merge still requires the owner's explicit authorization.

GitHub Pages successfully built implementation commit `c1bce96f91fe278c7349cf36255eea2525c72fc3`. All eight reported GitHub checks were green, including Pages, the existing engineering-journal check and CodeQL for Actions, JavaScript/TypeScript and Python. The published [Phase 2 preview](https://stavreskimario.github.io/penn-station-1935/?preview=phase2) was then checked in Chrome **156.0.8078.48**, with external services blocked: exterior, waiting room and concourse rendered; all six full-quality geometry chunks decoded; core illumination/AO loaded; no uncaught browser errors or failed app resources occurred. The [live report](../authoring/penn-station-1935/review/phase2/live-validation.json) records the implementation commit, request results and observed rendering counters. The subsequent evidence-only commit changes this record and adds that report; it does not change the viewer or model files.
