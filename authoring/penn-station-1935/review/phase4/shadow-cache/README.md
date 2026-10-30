# Static shadow cache lifecycle

`src/shadow-cache.mjs` freezes native WebGL shadow maps between explicit changes. Renderer initialization enables caching. Mounted/retried models and changes to daylight, shadow enablement or quality request a refresh. Camera movement, exposure adjustment and viewpoint changes reuse the maps. All six station zones remain loaded. The experimental WebGPU/node renderer keeps its previous behavior.

Pinned Three r180 reallocates shadow targets only when the target is null or the shadow type changes. The helper therefore disposes a target only when its actual dimensions differ from the desired map size, accounting for hardware limits and point-light atlas extents. Unchanged practical targets remain allocated. Every refresh explicitly updates the shadow camera projection so configured orthographic bounds are honored.

CPU controls in `tests/penn-shadow-cache.mjs` pass for projection changes, unchanged targets, both quality-resize directions, hardware/atlas clamps and untouched experimental rendering. A separate read-only review found no actionable correctness issue.

`report.json` records six browser groups on current production source compiled in scratch with read-only map/draw instrumentation. The browser used native Chrome with Metal. No delivered assets or bundle were changed by the harness.

- Initial map generation submits 297 shadow depth draws. Real viewpoint and flight movement leave that count at 297, with the complete six-zone scene retained.
- Morning changes actual 2048² sun-map pixels from the afternoon image while preserving the same render target.
- Shadows off/on disable rendering and then refresh existing targets.
- High/balanced changes create actual 4096²/2048² sun targets; unchanged 1024² practical targets retain their original identities.
- An automatic-shadow control uses the same refreshed camera projection and produces the exact same initial shadow image. Movement then adds shadow draws, while the cached variant adds none. This is a correctness comparison, not a general FPS benchmark.
- A controlled one-shot model 503 followed by the real Try again control mounts all six zones and rebuilds populated shadow maps. Its recovered afternoon image matches the successful initial load.

Source/helper hashes, target identities, map-image hashes and the expected single injected 503 are retained in the report. Other page/resource errors are absent. The scratch Chrome process exited before further baking resumed. Final architectural visual acceptance and the complete train route remain separate checks after the waiting-room shell repair.
