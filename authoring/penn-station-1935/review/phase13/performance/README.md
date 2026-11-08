# Prism visibility: desktop rendering checkpoint

The renderer keeps the two original prism-floor visual batches and submits only panels that can reach the camera. Every source vertex, normal, UV and material is retained. A separate complete concrete-web shadow companion submits zero camera/color geometry. Walking support reads the immutable full instance matrices, including panels outside the current view.

Actual full/fallback CPU checks preserve all 4,976 source instances, geometry/material references, complete shadow matrices and collision transforms. Independent box/frustum controls cover ordinary and reversed depth, an empty view and return to the earlier view. No extra visual draw calls are introduced.

Actual Chrome/Metal comparisons use the same cameras, fixed afternoon exposure, 1600×1000 viewport and DPR1. Each view has eight warm-up renders and 24 GPU timer samples. The local profiler appends a read-only renderer/camera/scene getter to both otherwise pinned bundles; original bodies and observer suffixes are hashed separately. This is a fixed-camera render test, not a native walking or sustained movement/FPS benchmark.

| View | Submitted triangles, before → after | Median GPU time, before → after |
| --- | --- | --- |
| Waiting room | 22,243,072 → 10,061,536 | 7.09 → 5.88 ms |
| Concourse | 21,509,978 → 18,498,922 | 13.44 → 12.95 ms |
| Arrivals | 21,027,610 → 17,236,818 | 10.27 → 10.39 ms |

Draw-call counts are unchanged. Viewport RGB pixels match exactly in all three paired captures; collision and vault-light collider counts also match. The first spatial-batch prototype remains held externally because it increased calls without enough benefit. This implementation changes visibility packing instead.

The gain is targeted: arrivals timing did not improve in this run, and the wider platform view retains most visible prism panels. Camera changes incur a small CPU frustum-test cost; stable views reuse the prior packed buffer. Further floor, material and scene work remains separate. WebGPU keeps its existing path. No physical-mobile result is claimed.
