# Crystal Palace · Hyde Park, 1851

A browser-based, interactive architectural study of Joseph Paxton's original Crystal Palace for the Great Exhibition. This app copies the Hello World starter's four-file shape, retains shared theme/UI imports, and adds local rendering, controls and a catalogue entry.

## Features

- Photorealism-oriented Three.js/WebGL reconstruction with perspective orbit, sunlit glass, metal, soft shadows, surrounding parkland, trees and period-scale figures. The existing Canvas drawing remains an offline/WebGL fallback.
- Camera presets: isometric, elevation, roof plan and transept.
- Glass, roof, iron, grid and annotation layers; blueprint/reconstruction drawing modes; inspectable landmarks.
- Pointer drag, scroll-wheel and pinch zoom, right-drag or two-finger pan, arrow keys, +/- zoom, 0 to reset, touch input and PNG export.
- Layout scales from desktop to mobile. Accessible native controls and reduced-motion compatibility.
- No persistent state, credentials or cloud sync. The realistic mode fetches version-pinned Three.js modules from jsDelivr and therefore requires an internet connection; if unavailable, the app uses its original 2D drawing fallback.

## Model accuracy

This is an **interpretive architectural visualization**, not an authenticated photoreal reconstruction. Daylight, parkland, visitor figures and materials are illustrative, and not measured or photo-sourced. This is an **interpretive architectural reconstruction**, not a detailed photogrammetric or survey model. Its footprint uses 1,848 by 408 feet with a north-side 936 by 48 foot extension and an approximately 72-foot wide, 108-foot high transept. A simplified grid of 24-foot structural bays, three stepped roof tiers, facades and barrel-vault profile conveys the historic structure. Glazing density, mullion counts, interior trees and many finishing details are not reconstructed at drawing-level accuracy. Some roof heights are depicted schematically.

Primary historical description: [The Crystal Palace](https://www.gutenberg.org/files/44192/44192-h/44192-h.htm), which provides the main dimensions, roof heights, plan geometry and transept specifications. Also consult [the Crystal Palace module study](https://textbookofarchitecture.com/rule/crystal-palace-module).

The reconstruction depicts **Hyde Park in 1851**, not the enlarged Sydenham building of 1854 that burned in 1936.

## Validation

From the repository root, run `python3 scripts/validate.py` and serve the directory locally with `python3 -m http.server 8000`. Open `/crystal-palace/` and test each preset and layer switch, drag/orbit, shift-pan, wheel zoom, keyboard and save PNG. Check narrow layouts, text enlargement, reduced motion and available graphics rendering. The repository validator covers structure and JS syntax, not browser rendering quality.

## Rendering implementation

`realistic.js` renders the model using Three.js r180 from version-pinned CDN ESM imports. The import map in `index.html` resolves the add-on `OrbitControls` dependency correctly. The `app.js` bootstrap checks WebGL2 and loads `drawing-fallback.js` if the graphics stack or CDN is unavailable. All model geometry and landscape assets are procedural; no licensed photo assets are required.

Review on a physically representative mobile GPU for draw-call and memory performance. The renderer caps device pixel ratio to 1.75 and limits shadow resolution to 2048. Future quality work could add environment maps and detailed facade textures, but this version intentionally does not pretend its invented scene decoration is historically verified.
