# Crystal Palace · Hyde Park, 1851

A browser-based, interactive architectural study of Joseph Paxton's original Crystal Palace for the Great Exhibition. This app copies the Hello World starter's four-file shape, retains shared theme/UI imports, and adds local rendering, controls and a catalogue entry.

## Features

- Rotatable, zoomable, orthographic Canvas reconstruction with no runtime dependencies, image downloads or account.
- Camera presets: isometric, elevation, roof plan and transept.
- Glass, roof, iron, grid and annotation layers; blueprint/reconstruction drawing modes; inspectable landmarks.
- Pointer drag, scroll-wheel zoom, Shift-drag pan, Arrow keys, +/- zoom, 0 to reset, touch input and PNG export.
- Layout scales from desktop to mobile. Accessible native controls and reduced-motion compatibility.
- No persistent state, credentials, networking or cloud sync.

## Model accuracy

This is an **interpretive architectural reconstruction**, not a detailed photogrammetric or survey model. Its footprint uses 1,848 by 408 feet with a north-side 936 by 48 foot extension and an approximately 72-foot wide, 108-foot high transept. A simplified grid of 24-foot structural bays, three stepped roof tiers, facades and barrel-vault profile conveys the historic structure. Glazing density, mullion counts, interior trees and many finishing details are not reconstructed at drawing-level accuracy. Some roof heights are depicted schematically.

Primary historical description: [The Crystal Palace](https://www.gutenberg.org/files/44192/44192-h/44192-h.htm), which provides the main dimensions, roof heights, plan geometry and transept specifications. Also consult [the Crystal Palace module study](https://textbookofarchitecture.com/rule/crystal-palace-module).

The reconstruction depicts **Hyde Park in 1851**, not the enlarged Sydenham building of 1854 that burned in 1936.

## Validation

From the repository root, run `python3 scripts/validate.py` and serve the directory locally with `python3 -m http.server 8000`. Open `/crystal-palace/` and test each preset and layer switch, drag/orbit, shift-pan, wheel zoom, keyboard and save PNG. Check narrow layouts, text enlargement, reduced motion and available graphics rendering. The repository validator covers structure and JS syntax, not browser rendering quality.
