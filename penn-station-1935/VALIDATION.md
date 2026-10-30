# Concourse floor and shadow maintenance checkpoint

Checked 30 October 2026. This smaller checkpoint repairs the reported motion-related gray floor patches before the broader Phase5 visual pass.

- Exact bundle SHA256: `2c361aa0705b8f179848efb32a3a48f24f3b05f16a846ff2fb5a2f89d8b8deb7`.
- Full/fallback concourse model hashes and complete GLB evidence: [checkpoint identity](../authoring/penn-station-1935/review/phase5/floor-checkpoint/identity.json).
- Corrected Blender concrete remains beneath the existing 200/220mm marble finishes; no stair aperture is filled. The same78-point grid per variant changes from52 competing finishes to zero, retaining four true voids. All2,754 stair-head support samples pass.
- Existing baked AO/GI coordinates are transferred per original face chart; geometry/normal corner bytes remain exact. The 12 decoded models validate with zero glTF errors and256 retained warnings.
- A separate shadow-cache initialization and bias-sign repair preserves the supported reversed-depth projection, forward fallback and existing static-cache performance strategy.
- Actual same-camera movement controls retain all6zones, unchanged marble height, separated concrete and no page errors. Final live identity is checked separately in the PR publication record.

The stone, ceiling and new bracket sources are backed up on this feature branch; they are not part of this runtime checkpoint. The full Phase4 record below applies to its explicitly named earlier bundle and measurements.

## Previous full Phase 4 visual validation

Checked 30 October 2026. This iteration improves the roof, interiors and desktop rendering. It does not certify final photographic fidelity or a 1:1 replica. The earlier maintenance results remain in [their implementation commit](https://github.com/stavreskimario/stavreskimario.github.io/blob/b86a59177e65461f5eb71c0593cab5b53fd4e5f6/penn-station-1935/VALIDATION.md).

### Exact identity

- Browser bundle SHA256: `67be7080829be131857745192d7f08af499b43396f601ee3240c2e70d220e1e4`.
- World manifest SHA256: `2198c77988f86d73944425e4a6195653d904b1e503660a8467c93dedeab10c6c`.
- Repaired raw waiting-room source: `4dbd4da6f1bb75761fc525781580e113e4c4e2c142191496fe2a881eb2705945`.
- Current editable scene: `48e1a7c53b883b68b709e61e37d38f1a66288682466d3969a41579454d61406d`.

Implementation `03f2cc9e6ac03a0c7c9c168aa4dbd4ea2d5e215a` passed all eight GitHub checks and its [Pages deployment](https://github.com/stavreskimario/stavreskimario.github.io/actions/runs/40967933621). The [actual live-browser receipt](../authoring/penn-station-1935/review/phase4/final-publication.json) matches the served bundle and all six decoded models with the local identities, retains all six zone identities through the exterior and interiors, and records advancing render frames with no page or resource errors. Publication was checked in Chrome156 on Apple M5 Max Metal. [PR11](https://github.com/stavreskimario/stavreskimario.github.io/pull/11) remains draft and unmerged.

### Architecture and historical evidence

| Before | After | Why |
| --- | --- | --- |
| Warped coffer faces and inward arch bands | Continuous curved relief, corrected winding and dedicated ceiling lighting | Remove known roof defects and retain useful detail |
| Carving receives too few lighting texels; leaf backs intersect their fronts | Separate 4K order atlas/AO and closed repaired returns | Resolve sampling and false self-occlusion |
| Incomplete concourse windows and prism fields | Sash bodies, arched heads/spandrels, ticket frontage and broad square-prism court | Restore documented construction with inferred dimensions qualified |
| Coarse furnishings and exaggerated grain | Refined booths, benches, five-globe lamps and restrained stone maps | Improve supported detail and material response |
| Repeated shadow and glass-back rendering | Cached static shadows and front faces for closed prisms | Reduce frame cost while retaining transmission and six loaded zones |
| Distant paving and roof interference | Feature-detected reversed depth in WebGL | Remove verified precision artifacts in the matched aerial view |

The [leaf-shell audit](../authoring/penn-station-1935/review/phase4/leaf-shell/README.md) verifies 128 closed shells: zero nonadjacent intersections, consistent winding and positive volume. All 110,208 visible front vertices remain exact; only hidden returns change. Unrelated geometry, normals and surface UVs retain their recorded identity. The 55mm return is interpreted.

The broad court contains 2,488 linked panels and 248,800 square glass units, with 3,582.72m² active panel area and 20 retained concrete cells around six pier bases. Raw audits pass glass/web/bearing support, empty-under-glass, boundaries, stairs and passage checks; the whole-core audit records 2,490 contacts with zero failures. These source checks do not replace final browser walking.

The [photograph comparison](../authoring/penn-station-1935/review/phase4/architecture/historical-limitations-review.md) separates primary evidence from reconstruction. Exact panel edges/pitch, minor profiles, capital carving and coffer arrangement remain inferred. The 143ft/150ft ceiling conflict remains explicit. The north mural retains its native 728×260 monochrome recovery; five other fields remain neutral. No unverified clock placement or generic passenger crowd is claimed as complete.

### Assets and lighting

[Final asset validation](../authoring/penn-station-1935/review/phase4/final-assets.json) passes all 12 full/fallback GLBs with **zero glTF errors**, 70 shared KTX2 textures and 256 retained warnings. Exact notices, decoded bounds and hashes are preserved.

| Atlas | Resolution | Metal samples |
| --- | --- | --- |
| Waiting-room vault | 8192² | 128 |
| Waiting-room masonry | 4096² | 128 |
| Colossal order | 4096², including desktop AO | 512 |
| Exterior, concourse, platform | 2048² each | 128 |

All six atlases include final registered occluders and six diffuse bounces. Positive-radiance checks, explicit linear transfer, per-atlas 0.18 controls and PNG/WebP pixel identity pass. Full original/denoised HDR bytes remain losslessly gzip archived with decoded SHA checks. [Denoising evidence](../authoring/penn-station-1935/review/phase4/final-denoise-summary.json) retains statistics and clipping.

Four repaired-source HDR captures use 2048×1024 at 64 Metal samples, with 512×256 low captures, Non-Color resizing and zero dither. They approximate static architectural reflections; no positional parallax, time-specific indirect relighting or calibrated historical weather is claimed. Newly repackaged architectural models use 16-bit position/UV and 12-bit normals; unchanged rolling stock retains earlier compressed data. [Scalar](../authoring/penn-station-1935/review/phase4/scalar-optimization/README.md) and [order-AO](../authoring/penn-station-1935/review/phase4/order-ao/README.md) controls preserve sampled values, original 4K AO bytes and unrelated geometry/bindings.

### Desktop rendering and interaction

The [production capture](../authoring/penn-station-1935/review/phase4/final-production/README.md) serves the unchanged bundle under a relative project prefix in Chrome156 on observed Apple M5 Max Metal. Six zone identities persist across four views, recording approximately 60.1–60.4 render updates/second at a 1920×1224 balanced buffer. A real 3.42m walk records approximately 60.2. These short windows do not certify all devices. Material checks confirm prism front faces with transmission 0.90 intact, 4K order maps and 8K ceiling illumination. The [visual assessment](../authoring/penn-station-1935/review/phase4/final-production/ASSESSMENT.md) records remaining defects.

The [causal performance investigation](../authoring/penn-station-1935/review/phase4/render-performance/README.md) measures the preceding candidate: cached shadows plus prism front faces improve 40.6 to 59.3 render submissions/second and approximately 49.93M to 20.13M submitted triangles/frame. Refraction resolution and all six loaded zones remain intact. GPU queries and render submission rate are reported separately; offline authoring jobs were stopped for quiet measurements.

Six [shadow-cache groups](../authoring/penn-station-1935/review/phase4/shadow-cache/README.md) pass camera reuse, light changes, on/off, actual 4096↔2048 target resizing, stable practical maps and recovery after an injected model failure. Projection matrices refresh explicitly; the automatic/cached controls share their projection and initial image. Experimental WebGPU retains its existing path.

The [depth comparison](../authoring/penn-station-1935/review/phase4/depth-precision/RESULT.md) removes Hotel paving bands and roof striping at the same camera. An unsuitable cross-browser UUID assertion is documented; camera values and zone names/counts match. Production verifies reversed depth on this driver; unsupported drivers keep normal depth.

The [final navigation sequence](../authoring/penn-station-1935/review/phase4/final-navigation/final-visual-2/README.md) passes on the exact frozen asset and bundle hashes: 17 real-keyboard train legs and 4,936 samples without shortcuts or arrival corrections; both prism crossings and the disabled-glass aperture control; WASD, Q/E, Shift, damping, field/dialog/blur and existing touch guards. The first flight attempt sent input before the selected pose committed; its failed receipt is preserved. Only that case was rerun after actual rendered-frame/camera readiness, with unchanged movement assertions and no production edits.

All 13 [final interface/recovery groups](../authoring/penn-station-1935/review/phase4/final-ui/README.md) pass against the same bundle. These include relative-prefix asset loading, persistent zones, views/walking, controls, native dialog/tour behavior, existing touch fallback and intentional model/HDR/graphics failure and retry. Full evidence retains expected injected failures and actual driver observations.

### Site, size and publication

Engineering Journal and Crystal Palace were removed in commit `1519918`. The [removal check](../docs/SITE_APP_REMOVAL_VALIDATION.json) verifies three retained cards/entrypoints, removed paths returning 404 and no page exceptions. Journal collection/scheduling is removed; shared staging is now scripts/site-publishing/stage.py. The three-app validator and six shared publishing tests pass; Pages settings are unchanged.

Model, unique texture and lighting transfer is **149,469,306 bytes** across both variants. The internal custom-stage allowance is 160,000,000 bytes; the separate complete legacy-root site must remain below 1 GB. [Final staging measurements](../authoring/penn-station-1935/review/phase4/final-public-staging.json) record the custom artifact and conservative legacy-root upper bound. Historical source scenes remain recoverable through verified immutable Git references and persistent backups; HDR archival is lossless.

The PR stays draft and unmerged. The live publication receipt above is separate from local rendering; a documentation-only follow-up preserves it without changing the tested runtime assets.

### Remaining visual work

Plaster mottling, some shaft highlight specks and one residual dark curl sample remain. Distant prism grids can show moiré; platform ends and the fuller Manhattan setting are unfinished. Fine ornament, some furnishings/signage, five murals, realistic period passengers and exact late-1930s operations remain open. Further mobile optimization is deferred; basic fallback checks do not certify physical-phone performance. This checkpoint advances the reconstruction without closing the final photographic target.
