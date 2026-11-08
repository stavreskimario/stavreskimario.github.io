# Matched reversed-depth comparison

The two actual Chrome Metal aerial captures use the current final repository assets and identical camera position/quaternion/FOV. The scratch source differs only by `reversedDepthBuffer: true` in both WebGL constructors. Camera near/far, materials, refraction, lighting and geometry are unchanged.

- `baseline.png` reproduces the large Hotel pavement bands and broad roof striping.
- `reversed.png` removes those artifacts. Opaque geometry, cast shading and the visible glass/roof structure remain present in this view.

The one-pixel capability control confirms EXT_clip_control and active Three r180 reversed-depth support on this M5 Max Metal browser. This is renderer depth evidence; the planar overlap audit alone could not establish the distant raster result.

The capture runner saved both images and printed identical camera values, then failed an invalid comparison of random scene UUIDs across independent loads. Zone names, counts and visibility matched. Its assertion is corrected for future use; no extra full-scene run was made. `comparison-summary.json` preserves the observed facts and that limitation. Final production interiors, shadows, transmission and navigation remain separate acceptance checks. No production source was edited.
