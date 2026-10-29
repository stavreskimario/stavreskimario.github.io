# Phase 1 validation — 29 October 2026

The deliverable is an explorable architectural study. It passes the functional checks below; it does **not** pass the project brief’s final photorealism or fully authenticated 1935–1940 acceptance gates. The concourse, ornament, streetscape and lighting need substantial further work. Read the [research ledger](RESEARCH.md) and [model ledger](model/README.md) before assessing historical fidelity.

## Completed checks

`uv run --no-project --python 3.11 python scripts/validate.py` passes for all five registered apps. Relative HTML assets/links, JavaScript syntax, manifest entries and `.nojekyll` are valid. `git diff --check` passes. The existing app/shared files were preserved.

The browser runner passed **nine integration groups** in Chromium Headless Shell **141.0.7390.37**, with software ANGLE/SwiftShader. The entire site was served under `/exhibition/`, with external requests blocked. Thus core rendering does not require an external script/asset CDN; shared Google Fonts use their normal fallback when blocked. Full evidence is in [review/browser-validation.json](review/browser-validation.json).

| Check | Result |
| --- | --- |
| Exterior, waiting room, concourse | Actual decoded geometry renders; loading completes; all six full/mobile GLBs load locally |
| Enter Station, orbit, viewpoints | Introduction dismisses; drag changes the camera; presets reach the three spaces |
| Walking | WASD moves after the human-height preset is established; eye remains 1.68m; movement stops at the room envelope |
| Graphics and environment | Three light presets, FOV, shadow switch and repeated full/mobile quality changes work; cached geometry does not accumulate over repeated switches |
| Historical exploration | Hotspot dialog, decoded archival photograph, sources, focus return, Tab containment and Escape work |
| Tour | Starts and cancels through the controls/Escape; automatic viewpoint sequence is implemented but was not timed end-to-end in this run |
| Mobile emulation | 390 × 844, touch direction buttons, lower-detail assets, reduced motion and keyboard alternatives work |
| Enlarged text | Sources panel remains reachable without horizontal overflow at 200% root text size |
| Recovery | An injected model 503 and an injected HDR 503 recover with Try again; unavailable WebGL clears the loading screen and keeps research available |

Normal rendering contexts had no uncaught browser errors. The injected HDR failure deliberately produces a loader error before recovery; this expected fault is retained in the report. Blocked optional font requests are recorded separately.

A separate smoke check in the installed **Chrome156.0.8078.48** requested `?renderer=webgpu` and successfully rendered through the **WebGL2 compatibility fallback**. It did not establish that native WebGPU works on a supported physical GPU; see [review/current-chrome-fallback.json](review/current-chrome-fallback.json).

## Geometry and rendering budget

The Blender source was checked before compression: nominal exterior stylobate **238.9632 × 131.064m** (784 × 430ft); main waiting-room floor **31.3944 × 84.4296m** (103 × 277ft); vault apex **45.720001m** (150ft within float precision). Plate310 dimensions corrected the colossal order and entablature. These are checks of implemented anchors, not certification of every architectural detail. Published outside measurements conflict, as the research ledger explains.

Decoding the optimised waiting-room asset gives a highest world-space point of about **45.7208m**: less than 1mm difference from the source height after mesh quantisation. KTX2/BasisU and Meshopt declarations were checked in all six runtime assets. Source images remain 1024²; mobile textures are 512².

| View | Full asset | Mobile asset | Observed full draw calls / triangles |
| --- | ---: | ---: | ---: |
| Exterior | 6.74MB | 2.13MB | 16 / 156,184 |
| Waiting room | 8.98MB | 2.47MB | 11 / 113,528 |
| Concourse | 8.76MB | 2.39MB | 10 / 96,792 |

These are decimal file sizes and observed renderer counters, not throughput or FPS guarantees. Each view loads separately. [Asset metrics](assets/asset-metrics.json) retain exact byte counts and extension lists. Repeated quality changes kept geometry/texture counts stable in the measured cache test. The frame-interval sample records browser scheduling, including an outlier, and must not be presented as rendered FPS. Physical GPU memory, frame time under movement, thermal behaviour and real mobile performance remain unmeasured.

## Visual review

Rendered reviews corrected hollow exterior walls, interior wall/ceiling gaps, wrong column proportions, camera elevation, repeated stone patterns, capital leaf silhouettes and the opening camera’s obstruction by neighbouring masses. These fixes improve the first phase; the remaining abstract ornament, uniform lighting and unverified context are visible limitations.

- [Exterior and introduction](review/desktop-intro.png)
- [Waiting room](review/desktop-waiting.png)
- [Concourse](review/desktop-concourse.png)
- [Historical reference beside the model](review/desktop-archive-comparison.png)
- [Touch walking controls](review/mobile-walking.png)
- [Sources at 200% text](review/mobile-sources-200-percent-text.png)

The archival comparison is an opening-era photograph from the architects’ monograph. It is explicitly **not** a calibrated matching camera or proof of 1935 furnishings. The site’s annotation and accuracy panels distinguish sourced anchors from interpretation.

## Limits and publication

No physical phone, Safari, Firefox, assistive-technology user study or calibrated architectural survey was completed. Optional WebGPU remains experimental; WebGL2 is the tested main path. Audio is synthesized room tone, not a historic recording. Seamless inter-room circulation, accurate stair levels, full platforms/trains, authenticated surrounding parcels, baked GI and final photorealism remain later phases.

The feature branch and pull request do not publish the application. GitHub Pages remains on `main`; no publishing settings changed and the PR must not be merged without the owner’s authorisation. Live asset/deployment verification must follow an authorised merge.
