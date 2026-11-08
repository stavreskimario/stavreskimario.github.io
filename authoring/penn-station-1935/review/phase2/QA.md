# Phase 2 browser review

The final promoted model set was checked in Chrome **156.0.8078.48**, headless with software ANGLE/SwiftShader, under the relative project prefix `/exhibition/`. Desktop was 1440 × 1000; mobile emulation was 390 × 844 with touch and reduced motion. These are functional browser checks, not physical-device or production-hosting performance measurements.

**Eleven integration groups are covered across two runs.** The original full run passed seven desktop groups, then found a mobile Sources-dialog overflow at 200% text. After a phone-only CSS correction, a targeted run passed all four mobile/recovery groups. This is split-run coverage, not a single uninterrupted full-suite pass.

## Evidence

- [Combined result](combined-validation.json) and [current validation record](validation.json): seven desktop plus four mobile/recovery groups, with explicit source-run attribution.
- [Original full run and retained failure](validation-before-text-fix.json), plus [original log](browser-run-before-text-fix.log).
- [Targeted passing report](mobile-recovery-after-text-fix/validation.json), plus [targeted log](browser-run-after-text-fix.log). Default test execution still runs the full suite; `PENN_SECTION=mobile-recovery` selects this narrower rerun.
- [Runtime changes](runtime-changes-for-text-fix.json): only `styles.css` changed among the 97 fingerprinted runtime/source files. Model assets and the browser bundle remained unchanged. [Before](runtime-fingerprint-before-text-fix.json) and [final](runtime-fingerprint.json) fingerprints preserve SHA-256 evidence.

## Text enlargement correction

The renderer-disabled CSS diagnosis used the actual Sources dialog at the same mobile width and 200% root text. Its grid children expanded to 293 px inside a 228 px content column. The full mobile rerun subsequently confirmed the corrected layout while the actual 3D viewer and walking controls were active.

| Before | After | Why |
| --- | --- | --- |
| Dialog inner width 318 px, scroll width 338 px; grid min-content sizing and a long footer word overflowed. Body overflow was 0. | Phone-only zero-minimum grid sizing and safe text wrapping give 318 px inner/scroll width, body overflow 0 and no overflowing descendants in the diagnostic. The full mobile rerun also measures 318/318/0 and verifies the close control remains reachable. | Enlarged text remains readable without shrinking it or hiding overflow. |

Measurements and screenshots: [before JSON](text-overflow-before.json), [after JSON](text-overflow-after.json), [before image](text-overflow-before.png), [after image](text-overflow-after.png), and [actual mobile 200% viewer](mobile-sources-200-percent-text.png).

## Covered interactions

Desktop checks exercised real exterior/interior rendering, six decoded geometry chunks, baked illumination/AO channels, unbaked platform materials, orbit drag, exact Hotel/Farley presets after dragging, walking eye height and the chamber boundary, the live map position, repeated quality switching, lighting/FOV/shadows, annotations, approximate archive framing, modal focus/Tab/Escape and tour cancellation.

The targeted rerun exercised mobile model variants, touch walking, reduced-motion keyboard navigation, text enlargement and modal close reachability; model HTTP 503 recovery; HDR-environment recovery; and unavailable-graphics fallback with usable historical sources. No required local-resource errors or unexpected uncaught browser errors remained in the accepted contexts.

Principal screenshots are retained beside this note: `desktop-intro.png`, `desktop-waiting.png`, `desktop-concourse.png`, `desktop-hotel.png`, `desktop-farley.png`, `desktop-archive-comparison.png`, `mobile-intro.png`, `mobile-concourse.png`, `mobile-walking.png`, the 200% text view, and the recovery/fallback views.

The screenshots document a detailed authored reconstruction study. They do not establish completed photographic fidelity, calibrated historical camera matching, a complete 1935 inventory, WebGPU certification or acceptable performance on physical mobile hardware. Historical dimensions and residual reconstruction choices remain in the separate model/research ledgers.
