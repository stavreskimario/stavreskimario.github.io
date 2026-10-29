# Concourse grid anti-aliasing comparison

Scratch-only captures of the same actual concourse preset compare balanced/high quality at device pixel ratios 1 and 2. All use the recorded current visual-checkpoint bundle and observed M5 Max Metal renderer; no scene or runtime source was changed. Canvas dimensions and clear/render intervals are recorded in `report.json`.

| Device pixel ratio | Quality | CSS canvas | Actual render canvas | MSAA |
| --- | --- | --- | --- | --- |
| 1 | Balanced | 1440 × 916 | 1440 × 916 | 4 samples |
| 1 | High | 1440 × 916 | 1440 × 916 | 4 samples |
| 2 | Balanced | 1440 × 916 | 2160 × 1374 | 4 samples |
| 2 | High | 1440 × 916 | 2880 × 1832 | 4 samples |

Visual inspection finds smoother beams and foreground grid at higher pixel density, but visible wavy bands remain in the distant floor at both retina settings. Supersampling alone does not fully resolve the fine prism geometry's minification, and high retina renders four times the pixels of DPR 1.

Timing is **contended**, not a quiet or causal performance comparison: earlier DPR 1 samples overlapped other GPU jobs, which explains why their measured intervals were slower than the later DPR 2 samples. The report retains actual default-framebuffer clear intervals and browser animation-frame intervals while real flight input requests continuous renders. These observations are not a hardware performance certification. This browser exited before the separate quiet-window profiling began.

The screenshots and findings apply to the recorded visual-checkpoint candidate, before the later capital-shell repair and any subsequent performance or floor anti-aliasing work.

Native PNGs remain byte-identical in the persistent work paths listed in native-image-records.json. Only the compact comparison records are included in the published repository; the final release screenshots are archived separately.
