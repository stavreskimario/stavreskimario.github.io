# Desktop rendering diagnosis

The narrow recommended fix is to cache the static shadow maps and render only the verified closed `SquareVaultLightGlass` prisms with `FrontSide`. Keep their transmission, all thin window glass and full refraction-buffer resolution. All six zones remain loaded and connected. Root/navigation agents own production implementation; these measurements changed scratch viewers only.

The quiet-GPU Chrome Metal comparison locally served exact commit `b86a591` and the promoted visual candidate. It counted actual renderer calls and draw submissions, including shadow passes, rather than counting empty animation callbacks. The usual Three.js render counters reset after the shadow pass, so the diagnostic additionally counted every `renderBufferDirect` submission. GPU elapsed-time queries were available. Results are short headless movement windows on this M5 Max, not a general device frame-rate guarantee.

At a 1280×816 CSS viewport with a 2560×1632 drawing buffer, the published checkpoint rendered about 60frames/s in exterior, waiting-room and concourse movement. The new candidate's expensive case was the concourse: about 47.5frames/s,49.99million submitted triangles/frame and 41.0ms mean GPU elapsed interval. Disabling transmission in a scratch control restored 60frames/s and 11.3ms. This identifies the glass workload as the main regression; turning collision off was not necessary to reproduce or fix it.

A matched follow-up concourse run measured:

| Control | Actual rendered frames/s | Submitted triangles/frame | Draw submissions/frame |
| --- | ---: | ---: | ---: |
| Original candidate, DoubleSide prisms/dynamic shadows | 40.6 | 49.93 million | 443.1 |
| Static shadow cache + FrontSide closed prisms | 59.3 | 20.13 million | 146.1 |

The extra backside refraction pass is visible in the installed Three.js renderer: it redraws every `DoubleSide` transmissive mesh into the transmission target. The floor prisms are closed solids with checked outward winding, so the exact material can use front faces from above or below. Thin two-sided window sheets retain their existing setting. The silhouette, transmission parameter and physical navigation geometry remain present.

Caching shadows alone removed about 25million triangles and 300draws per moving frame. It substantially reduces unnecessary work, but did not resolve the entire concourse regression until combined with the closed-prism setting. Lowering refraction-buffer resolution alone did not consistently help; the recommended pair restored responsiveness without that tradeoff. Solo-zone, shadows-off and transmission-off cases were diagnostics only and are not proposed production behavior.

A separate real Walk-mode run crossed the prism field with all zones loaded: navigation CPU averaged 0.264ms/frame, with 0.4ms at the 95th percentile, while rendering about 60frames/s. The camera moved from `[-67,-2.5872,33]` to `[-67.5378,-2.5907,29.1006]`;203actual glass support hits and 1,152collision queries were recorded. This separates the observed rendering bottleneck from collision cost. An earlier walk-labelled trial had been reset to Orbit by the viewpoint button and is excluded from walking evidence.

Full JSON results and source/asset hashes are in `report.json`, `../render-performance-prism/report.json`, `../render-performance-final-control/report.json` and `../render-performance-retina/report.json`. The concise comparison is `performance-summary.json`.

Native-retina screenshots are retained at `../render-performance-retina/baseline.png` and `cache-front.png` (2560×1800 full page,2560×1632 actual viewport). Production source gained the prism FrontSide fix concurrently before this last screenshot run, so its baseline already has FrontSide; those images compare FrontSide with dynamic shadows against FrontSide with cached shadows. The earlier `render-performance-final-control` screenshots preserve the original DoubleSide baseline/pair comparison at CSS-sized PNG output while recording the same retina-size drawing buffer.

Active Metal authoring jobs were stopped for the causal measurements. Their prior contention can affect same-host interactive use, but this report does not assign a numeric slowdown to an unmeasured concurrent bake. All diagnostic browser processes were closed before releasing the GPU window for cache lifecycle controls and the next sequential bake.
