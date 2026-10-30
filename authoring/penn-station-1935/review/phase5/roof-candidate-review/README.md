# Roof candidate review — NOT DELIVERED

**The production site still uses the previous roof geometry, AO and lighting.** The published stone/fixture checkpoint is `9079583`, with live verification recorded in `79a730b`. None of the roof maps, filtering candidates or diagnostic shaders in this review was promoted. Fine breakup on narrow coffer mouldings remains unresolved, so this record does not certify a clean or photorealistic ceiling.

This is a compact review archive. Full source scenes, raw GLBs, HDRs, normal-guide arrays, browser captures and failed candidates remain in `/Users/stavreskimario/Desktop/penn-station-work/phase5-materials/`. `retained-work-payloads.json` records their full paths, verified hashes and sizes; none of those large payloads is copied here. `source-report-origins.json` identifies the full original reports behind the compact summaries.

## Source and UV repair

The rejected 75 degree pack grouped distant coffer surfaces into one projection. Its strict 8K raster had 302,229 multiply covered pixels. A representative pair of valid surfaces was about 0.71 m apart but shared atlas coordinates. Winding-only and atlas-area checks did not detect that fold.

The selected 25 degree pack passes both the strict 8K raster and an independent analytical triangle-intersection test: zero interior overlaps and zero collapsed UV triangles across all 150,832 triangles. The optimized desktop module also has zero overlaps after Meshopt/UV quantization. Median density changes from 68.12 to 62.17 px/m; the weakest p1/p5 densities improve from 52.14/52.83 to 60.61/61.15 px/m.

Welding is used only as a UV workspace. Packed UV1 transfers by exact integer face-corner IDs onto an untouched source mesh copy. Original vertex positions, topology, architectural UV0 and authored split-normal storage remain exact. Independent comparison also found zero positional difference against the original source GLB. The immutable helper used for this bake is archived here; the later canonical helper adds a guard-only loop-index assertion. Dimensions and historical uncertainty, including the 143/150 ft ceiling-source conflict and interpreted coffer relief, remain unchanged.

The selected raw vault artifact is `07e15f4c1cc811cfba37a26bda25526341dcaf43460de540b98a1774d4aa0eb8`. The original waiting-room geometry input is `43cdf1cf76c6c7c3222d1a4e3c31fa6a604e2705e5f09133cbd8cc8ef2cead0b`. Full source, diffuse, guide, optimized-module and helper hash links are retained in the receipts.

## Actual mapped review

The single new vault bake used full 8192 resolution and 128 sky samples, with fresh AO for its changed UV mapping. Other zones were retained. The central flat-pocket defect is visibly removed, but narrow mouldings still show fine breakup.

A fresh one-sample OBJECT normal guide was generated on the **new 25 degree UVs**. The old V2 guide was never reused. RGB normals were converted to signed unit vectors; empty background remained zero. Active OIDN used a full-resolution white albedo image. This matters because Blender 4.3 ignores both auxiliary inputs when albedo is a single-element RGB node. A changed-normal sensitivity control proves the new guide is active. Constant 0.18, nonuniform and synthetic-edge controls pass; whole-atlas mean changes by −0.2704%, with no display clipping. Geometry-mask energy changes by −0.7737%; these figures include hidden surfaces and are not a visibility certification.

Actual Chrome captures use the same camera, native DPR2 canvas of 2560 × 1632, all six zones and fixed exposure 4.15. Guided filtering gives modest improvement. Correctly chained derivative mip sampling, capped at LOD2, reduces fine grain further but does not establish a fully clean ceiling. Its near-view, complete gutter and energy acceptance remains pending; the helper is an unpromoted candidate.

**The first mip comparison is invalid.** It overwrote the existing material hook and restored diffuse IBL that the bake path intentionally suppresses. Its brighter standard result must not be treated as a sampling improvement. The later corrected pair calls the previous hook first and changes only its atlas sample. The attempted close-view pair is also incomplete: a structural arch obstructed the chosen camera and the material-ray assertion stopped the run.

The final radius-two joint-normal/chart/radiance patch proof preserves constant, indirect-edge and chart-edge controls exactly and changes patch energy by only −0.0021% to +0.0282%. Only one of four patches improves clearly; a whole-atlas pass was not justified or applied. No further filter or GI bake followed.

## Material attribution and hidden-zero correction

The literal control changes **only PaleVaultPlaster** to unlit MeshBasic. Travertine and other materials retain their original lighting. Exact closest-material classification of five 13 × 13 native-pixel windows found **726 Pale hits and 119 Travertine hits**. Three windows are entirely Pale, so the literal control is valid for their coffer bands. The rib-intersection window is 55% Travertine and is not a Travertine GI-only control. Do not apply the Pale-only conclusion to every moulding or rib.

The preliminary target-vault-only report also overstated visibility. An all-source follow-up, using the exact registered frames and every primary material, shows that **all 39 zero/near-zero samples in the suspect 81-sample window are hidden behind opaque Travertine**. Camera segments exit the rib 1.68–3.89 cm ahead of the zero points; nearby lit points have no local camera blocker. The other five 81-sample windows contain no near-zero values. These zeros are **not evidence of a visible Metal black-texel, reversed-face or authored-normal failure** and must not be filled as missing light. Short probes do not establish global sky visibility.

## Previews and reading order

The three WebP previews retain the original native 900 × 620 pixels losslessly. `preview-sources.json` records full original PNG paths/hashes, preview hashes, decoded RGB hashes and pixel-equality checks. They are diagnostic candidate images, not screenshots of the delivered roof.

- `previews/guided-standard.webp`: selected UVs and active guided GI, standard lighting.
- `previews/pale-only-literal-gi.webp`: the same candidate with the Pale-only literal control.
- `previews/corrected-capped-mip-standard.webp`: corrected hook chaining and capped derivative sampling.

Start with `reports/browser-comparisons-summary.json`, `reports/closest-visible-materials-summary.json` and `reports/all-source-hidden-zero-correction.json`. The older Pale-only zero report is retained explicitly as incomplete chronology. All browser, GPU and CPU diagnostic jobs were closed when this archive was finalized. No FPS claim is made.
