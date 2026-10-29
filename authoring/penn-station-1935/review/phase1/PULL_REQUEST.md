## Pennsylvania Station: first phase of an evidence-led reconstruction

Adds `penn-station-1935/` to the existing app collection. The static exhibition loads Blender-authored exterior, waiting-room and concourse assets through React Three Fiber / Three.js, with local Meshopt/KTX2 assets, mobile variants, orbit/walking controls, source annotations and archival comparisons. Existing shared styles, applications and Pages configuration are preserved.

**Scope:** this is Phase1, an architectural study. It is not the completed photorealistic 1935–1940 reconstruction. The included research/model ledgers separate authenticated dimensions, interpreted geometry and outstanding work. Fully surveyed ornament, final concourse engineering, seamless circulation/levels, trains/people, authenticated neighbouring parcels and calibrated baked lighting remain future phases. The target date is not a verified inventory of 1935 furnishings or streetscape.

| Before | After | Why |
| --- | --- | --- |
| No Penn Station app in the collection | A uniquely named, registered architectural exhibition | Establish a bounded, reviewable first delivery without altering other apps |
| No authored station geometry or source ledger | Editable Blender source, three authored spaces and documented dimensional evidence | Anchor reconstruction in the original architectural record and expose uncertainty |
| No exploration, quality or historical controls | Orbit, bounded human-height walking, viewpoints, lighting, mobile quality, sources and photo comparison | Make the initial architecture usable and its evidence inspectable |
| No application-specific browser validation | Prefixed-path tests, desktop/touch screenshots, enlarged text, focus checks and recovery tests | Verify the actual static experience and retain honest coverage limits |

## Validation

- Whole-site validator passes for five apps; JavaScript syntax, relative links/assets, manifest and `.nojekyll` pass. `git diff --check` passes.
- Nine integration groups pass in Chromium Headless Shell141.0.7390.37: actual rendering for all three spaces/six model variants; Enter/orbit/WASD/bounds; light/FOV/shadows/quality-cache switches; hotspots/photos/dialog focus; tour start/cancel;390px touch, reduced motion and200% text; GLB/HDR retry; unavailable-graphics fallback.
- Installed Chrome156.0.8078.48 renders with `?renderer=webgpu` through the WebGL2 compatibility fallback. Native WebGPU on a supported physical GPU remains unverified.
- Source waiting-room floor103×277ft and150ft vault apex checked in Blender. Optimised decoded height differs by less than1mm. Footprint784×430ft is explicitly nominal because primary publications conflict.
- Full GLBs6.74/8.98/8.76MB; mobile2.13/2.47/2.39MB. Observed full draws16/11/10. Rendering on demand and per-space loading are implemented. These are not physical-device FPS guarantees.

See `penn-station-1935/VALIDATION.md`, `review/browser-validation.json`, `review/current-chrome-fallback.json` and the six review PNGs. No physical phone, Safari/Firefox, assistive-technology user study or calibrated matching-camera comparison was performed. Source photographs are opening-era public-domain extracts; rights/credits are recorded. The comparison is explicitly uncalibrated.

**Publication:** keep this PR unmerged pending the owner’s authorisation. A feature-branch push does not publish Pages. After an authorised merge, verify the matching Pages deployment and live app/asset URLs.
