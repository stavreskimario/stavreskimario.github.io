# The Crystal Palace · London, 1851

A browser-based architectural study of Joseph Paxton's **original Hyde Park building**, not the expanded 1854 Sydenham Crystal Palace.

## Historical geometry

All world coordinates use feet (1 world unit = 1 foot). The first-pass reconstruction is grounded in the surviving descriptions and structural plans, including the **1,848 × 408 ft** main footprint, **936 × 48 ft** northern projection, **72-ft-wide** central nave, stepped **24 / 44 / 64 ft** roof levels, **24-ft** structural grid, **8-ft** ridge-and-furrow glazing rhythm, and **72-ft-wide** vaulted transept with an authentic **36-ft-radius semicircle** rising to **108 ft**.

The earlier model incorrectly placed the shallow arch along the long axis of the transept and exaggerated the high central roof. This version instead forms the proper semicircle across the transept's 72-ft width, with the long vault extending through the building's 408-ft depth.

Primary sources and cross-checks:

- [Charles Downes and Charles Cowper, *The Building in Hyde Park* (1852)](https://textbookofarchitecture.com/source/downes-crystal-palace)
- [Contemporary Crystal Palace description (1851)](https://www.gutenberg.org/files/44192/44192-h/44192-h.htm)
- [Original Paxton lithograph, Science Museum Group](https://collection.sciencemuseumgroup.org.uk/objects/co8014684/an-authentic-view-of-the-the-great-industrial-exhibition-palace-of-1851)
- [Royal Commission for the Exhibition of 1851 archive](https://www2.calmview.co.uk/RoyalCommission1851/CalmView/)
- [Crystal Palace 24-foot modular design](https://textbookofarchitecture.com/rule/crystal-palace-module)

**Fidelity limitation:** A building at 1:1 dimensional scale is not automatically an *exact 1:1 historical replica*. The main envelope, proportions and structural rhythm are historically supported. Ornamental ironwork, individual glazed joints, timber sash profiles, weathered finishes, entrance detailing, park tree placements and visitor figures are interpretive. No complete authenticated 3D as-built survey was used. Do not mistake these artistic elements for exact 1851 evidence.

## Rendering and controls

- Three.js r180, WebGL2, physically based iron/glass, warm daylight, perspective camera, shadows and sparse scenery for scale.
- Camera presets: isometric, elevation, plan, transept; orbit/pan/zoom by mouse and touch, keyboard navigation, PNG export and a technical blueprint view.
- App controls remain semantic and keyboard-accessible; reduced-motion users get no ornamental camera animations.
- `app.js` checks WebGL2 and loads `realistic.js` from a version-pinned external CDN import map. If the CDN or GPU is unavailable, the original `drawing-fallback.js` renderer loads. The 3D view therefore requires connectivity to the JavaScript CDN.
- No saved state, tracking, login or credentials.

## Code and validation

The implementation lives at `apps/crystal-palace/`. The old `/crystal-palace/` URL is a redirect to the canonical `/apps/crystal-palace/`.

Validate from repository root:

```sh
python3 scripts/validate.py
python3 -m unittest discover -s tests -p 'test_engineering_feed.py'
python3 -m http.server 8000
```

Test camera presets, layered rendering, keyboard orbit, mouse/touch zoom and pan, PNG export, narrow mobile viewport, reduced motion and a blocked-CDN fallback in a real WebGL2 browser. Structural/static tests cannot certify historical visual accuracy or physically representative mobile GPU performance.
