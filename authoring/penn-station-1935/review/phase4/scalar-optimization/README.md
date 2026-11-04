# Scalar texture preparation review

These authoring checks cover `prepare-scalars.mjs`, not final delivery size or final visual acceptance. They use existing pinned tools and do not resize textures. The masonry input was separately resized by the existing desktop 2K policy; `masonry-desktop-policy.json` records that step.

The helper preserves AO red and roughness green exactly before UASTC, retains all material factors, dimensions, UV coordinates/transforms, samplers and geometry, and leaves base colour, normal, extension maps and nonzero-metal MR images unchanged. Stone MR carriers use `[255, G, 255]` only when the metallic factor is exactly zero. Already-canonical images retain their encoded bytes. An entirely unchanged document passes through verbatim.

- `fixture-proof.json`: 23 roles, including shared images, different UV/sampler settings, texture transforms, base colour/normal reuse, nonzero metal and extension-map controls.
- `fixture-repeat-proof.json`: no new scalar images; input and output SHA-256 are identical on a repeated canonical input.
- `fixture-codec-proof.json`: UASTC comparison for the fixture. Shared packed images must remain for its colour, normal and metal controls, so adding separate scalar carriers increases this deliberately adversarial fixture's image count. This is a preservation check, not a size-saving result.
- `masonry-constant-proof.json`: all 44 actual masonry roles preserved. Five references share existing exact scalar images; no new scalar images. The uncompressed GLB changes from 91,100,216 to 89,371,936 bytes by removing duplicate image data.
- `masonry-codec-proof.json`: all 44 source images and compressed pixel blocks unchanged; AO-red and MR-green differences from the codec baseline are zero. Unique compressed image bytes are **24,900,680 before and after**, across 11 images.

The earlier grayscale MR carrier proposal was rejected. Copying G into all RGB channels increased this same masonry input's compressed images by **540,569 bytes**, despite preserving the sampled scalar. `rejected-grayscale-masonry-codec-proof.json` retains that finding. The corrected helper keeps the exporter's already-canonical constant unused channels, avoiding that regression. No additional compressed storage saving is claimed.

All codec comparisons use UASTC level 1, Zstandard 6 and two workers with KTX 4.4.2; the proofs record source hashes and helper/tool provenance. These measurements precede final Meshopt packaging, merging and runtime gzip. Final model metrics and browser acceptance belong to their own reports.
