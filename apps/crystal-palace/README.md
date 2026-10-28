# Crystal Palace at Sydenham — late Victorian photographic era

This interactive WebGL reconstruction deliberately represents the **Sydenham Crystal Palace after the northern transept was destroyed in 1866**, as in the user's archival photograph. It is NOT the original Hyde Park Palace of 1851, and is NOT a claim that every ornament, tree or glazed fitting can be recovered exactly.

## Documented dimensional anchors

- Main nave: **1,608 ft** (approximately 490 m) long, with a **72-ft-wide** vaulted central aisle and general body width of **312 ft**.
- Central transept: approximately **120-ft span**, **390-ft length**, with the crown approximately **175 ft above the ground floor**. The end face has a very large semicircular glazed lunette.
- Surviving southern transept: approximately **72-ft span**, rising to roughly **110 ft** above the ground floor.
- Water towers: **282 ft** high; the elaborate terraces, stairs, balustrades and fountain basins occupy the garden side.
- Post-1866 appearance: the burned northern transept is deliberately omitted. Surviving wings, ornamental facades and park geometry are approximated where reconstruction records are incomplete.

The Three.js world uses **one unit per foot**; documented structural dimensions are applied at that scale. This is NOT a verified as-built 1:1 twin. Sash sections, mouldings, exact tower spacing, terrace details, sculpture, planted species, finish colours, transparency, lighting and some damaged wing geometry are interpretive.

## Historical references

1. [F.K.J. Shenton, *The Palace and Park* (1850s contemporary guide)](https://www.gutenberg.org/files/59843/59843-h/59843-h.htm) — measured Sydenham dimensions and layout, barrel nave, column organization and transepts.
2. [London Museum: the rebuilt palace at Sydenham](https://www.londonmuseum.org.uk/collections/v/object-101205/crystal-palace-sydenham/) — opening and reconstruction history.
3. [Historic England: Crystal Palace Park](https://historicengland.org.uk/listing/the-list/list-entry/1000373) — terraces, fountains and formal garden history.
4. [Historic photographic view, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Crystal_Palace,_Sydenham.png) — composition and façade reference.
5. [London Picture Archive: centre transept](https://www.londonpicturearchive.org.uk/view-item?i=322568) — period photographic evidence.
6. [Baedeker's London, Sydenham dimensions](https://archive.org/details/baedekerlondon00karl) — nave, central and southern transept and Brunel towers.

## Model and app implementation

The source lives in `apps/crystal-palace/`. `sydenham.js` builds multi-storey translucent glazing, structural iron instances, an arched nave and two surviving transepts, tracery, slender columns, the two water towers, a formal garden with central stairs and fountain, and refined procedural materials. It uses version-pinned Three.js r180 and OrbitControls via a browser import map. No back-end or site build is required, but **live 3D requires WebGL2 and network access to jsDelivr**.

Accessible native buttons retain camera presets, technical view, layer visibility, zoom, architectural notes and local PNG export. `drawing-fallback.js` provides a Sydenham-specific offline technical elevation if the 3D modules fail to load. It does not accidentally display the 1851 Hyde Park drawing.

The previous `/crystal-palace/` URL redirects to `/apps/crystal-palace/`. Existing other apps stay in `apps/` with legacy redirects. There is no account, persistence, telemetry, or cloud sync.

## Verification

From repo root:

```bash
python3 scripts/validate.py
python3 -m unittest discover -s tests -p 'test_engineering_feed.py'
# With Playwright available via NODE_PATH:
node tests/crystal-palace.cjs
```

Verify the Sydenham 3D scene in desktop Safari/Chromium and a physical mobile browser, using the photograph view and transept, elevation and plan presets. Check visually against the provided historic photograph, and check WebGL fallback, buttons, zoom, mouse/touch gestures and PNG export. Automated static and fallback tests cannot certify photographic realism, GPU performance or archaeological accuracy.
