# Arcade completion: current-source ownership and evidence

2 November 2026. External, read-only construction handoff. Canonical source SHA256 remains`c96fb37215d4ebfc7bbbba9154fe7f96a8daf8500e9c61778136e286c4a03739` before/after the audit. No canonical save, asset export or runtime edit was performed.

## Coordinates and actual route

All bounds here are **Blender world**: X east, Y north, Z up, streetZ0 and MainZ-4.2672. They are not rawMain0/glTF coordinates. glTF world maps `(X,Y,Z)` here to `(X,Z,-Y)`.

| Segment | Existing X interval (m) | Current source condition | Treatment |
| --- | --- | --- | --- |
| Main stair | 16.5-24.9 | 28 interpreted risers from Main to street;39ft6in width | Retain accepted walking interface until the photographed small arcade/loggia threshold steps are resolved. |
| Western loggia |24.9-32.71|15.5m-wide street-level landing; no side hit within20m at sampled heights | Add the actual framed loggia, side dining/lunch openings and backed adjoining spaces. Keep axial passage open. |
| Arcade |32.71-101.29|68.58m-long floor, two flat walls, fourteen narrow storefront/pilaster repeats per side, flat roof | Replace the owned envelope with source-based connected wall/shopfront/clerestory/vault family. |
| Interior vestibule |101.29-111.1816|Paving only at centre, broad side gaps; upper wing roof exists | Follow the widened vestibule plan, preserve doors/axial route and distinguish it from the outdoor portico. |
| Exterior portico |111.1816-119.4816|Backset entrance and Doric portico; actual entablature undersideZ10.668 beginsX113.9816 | Remain open to street. Do not extend a high internal barrel vault through the entablature. |

The true requested connection is X24.9-119.4816, but the formal arcade itself is only the middle interval. One new long tunnel from24.9to119.48 would invent the vestibule/loggia/portico relationships.

## Exact existing components

`arcade-source-audit.json` records38 Exterior/Main-room mesh objects,2,048 relevant connected components and270 rays. The companion `arcade-ownership-controls.json` contains exact per-component vertex/polygon indices, bounds, position hashes and expected counts. Source objects are batched by material, so the original names below survive in`build_station.py`, not in the `.blend` object tree.

| Source concept | Canonical batched object / component ordinals | Bounds and defect | Ownership |
| --- | --- | --- | --- |
|`Arcade shop wall` pair|`01 Exterior and context — MilfordGranite`,4355/4357|X32.71-101.29, absoluteY6.7-7.7,Z0-11.4|Replace whole owned components, not the entire granite object.|
|`Arcade shop lower ceiling` pair|same,4356/4358|X32.71-101.29,absoluteY7.5-8.5,Z10.3-11.5|Replace with coordinated real shop/clerestory backing and ceiling.|
|`Arcade roof`|same,4359|X32.71-101.29,Y+/-7.35,Z11.5-12.5|The flat underface erases the documented barrel vault; remove only after replacement shell is complete.|
|`Arcade pilaster`,28 pieces|same,4360-4387|X32.725-99.575,absoluteY5.9-6.5,Z0-9.6|**All28 have a200mm gap behind them**: outerface6.5 versus receiving wallinnerface6.7. Replace/reseat positively into real masonry.|
|`Arcade storefront`,28 pieces|`01 Exterior and context — ContextWindow`,492-519|First pairX33.45-36.55,last pair99.75-102.85,absoluteY6.61-6.69,Z0.9-5.9|Opaque panes are surface cladding on solid walls. Last pair extends1.56m beyond the wall end, an uncoordinated transition. Replace with actual recessed shop bays/frames/glass/backing.|
|`Arcade paving` and`Seventh Avenue vestibule paving`|`01 Exterior and context — PublicFloorMarble`,0/1|X32.71-101.29 and101.29-119.4816,Y+/-7,Z-0.2-0|Retain in first enclosure proof; end bevels create only~7.5mm edge depression, not the large wall gaps.|
|`Street-level loggia landing`|`02 Main waiting room — PublicFloorMarble`,12|X24.9-32.71,Y+/-7.75,Z-0.2-0|Retain initially; exact level requires threshold-step coordination.|
|Two courtyard-side spine walls|`01 Exterior and context — Travertine`,547/1090|X43-89.5455,absoluteY8.2-8.8,Z0-19.2024|Coordinate real clerestory light paths. New bright internal glass backed by these opaque walls is not daylight. Do not remove the whole court enclosure.|
|Upper roof pieces|`01 Exterior and context — FlatRoofTile`,8/9/10|X18.1356-43,43-89.5455,89.5455-101.29; underside18.9224|Retain unless a source-height review justifies a coordinated roof correction. This underside is an existing integration bound, not a measured historical ceiling.|

The two existing wall topsZ11.4 and roof undersideZ11.5 leave a100mm opening. Capping that seam alone fixes a technical gap while retaining the historically wrong flat ceiling. The large loggia/vestibule voids are separate missing architecture.

Raw-mesh rays do not evaluate Geometry Nodes. They diagnose these wall/roof/floor components; they do not certify front-colonnade collisions.

## Authentic plan and photographic vocabulary

S2, the architects' monograph, **plate300** (cached PDF7) supplies the street-level plan. Mechanical `mmw-plate300-arcade-crop.png` contains the arcade, service transition, shops, western loggia and eastern vestibule. A qualified manual reading finds seven broad structural intervals, with different lower shop subdivisions on north/south sides. It does not support fourteen identical narrow bays.

The external JSON keeps the crop's native reading controls: west/eastY245/1048px, intermediate dividerY380/492/600/711/820/930px, at least+/-5px reading uncertainty. An inherited32.71-101.29m X registration maps those to approximately32.71,44.24,53.80,63.03,72.51,81.82,91.21,101.29m. The first interval includes the service transition; this is **not a certified equal bay schedule**, exact finished pier-face survey or tenant inventory.

S2 **plate305** (PDF17), captioned`Arcade from Main Entrance to Waiting Room`, directly shows continuous masonry/cast-composition facing, articulated engaged pilasters, deep shopfront frames, high arched lights, and a plain longitudinal vault with side lunettes. No repeated coffer/rib pattern is visible in the long arcade ceiling. Mechanical source images are`mmw-plate305.png` and`mmw-plate305-arcade-crop.png`.

Francis/O'Brien, printedp193/PDF355, explicitly describes the Seventh Avenue vestibule and arcade ceilings as vaulted, with suspended angle framing and compound intersections of lunettes with the main longitudinal vault. This is stronger evidence than treating the current flat-roof block as a historical section.

Primary Detroit negative**071930**, captioned`Arcade Entrance to Loggia and Main Waiting Room`, was independently retrieved from the [LOC service derivative](https://cdn.loc.gov/service/pnp/det/4a20000/4a23000/4a23700/4a23715v.jpg) and [original TIFF](https://tile.loc.gov/storage-services/master/pnp/det/4a20000/4a23000/4a23700/4a23715u.tif), digitalID`det.4a23715`. The5059x4061 original is now external`loc-det-4a23715u.tif`; the caption/negative number is visible on the image. It shows the actual arcade-to-loggia entablature, four Ionic columns in paired depth, decorated terminal transverse arch, plainer continuing vault, high glazing and grounded pilaster bases. It is not a flat end wall with a window: the distant window/clock are seen **through the loggia into the waiting room and onward toward the concourse**. Do not seal that axial view.

The source's1911 copyright registration is corroborated by S27 printedp80:16January1911,J151597,copies6February1911. It is opening-era evidence. The present direct catalog request returned403, so do not invent an item number or claim its complete fresh catalog review; existing collection/right evidence and pre1931US publication are separately identified.

## Ceiling height: unresolved dimensional control

**No printed arcade ceiling height was found.** Gibbs p252's table lists100ft concourse and11ft Exit heights; its arcade entry is only220x40ft plan dimensions. Those height rows must not be misassigned to the arcade. Plate302 is the waiting-room north/south section, not an arcade section.

The currentZ11.4 walltop is a script approximation and **must not become the source anchor** for a new vault. A rough frontal reading of071930 puts the terminal spring at previewY~240-245px, crownnearY55-60px and the corresponding floor transitionnearY580-595px; the visible intrados/moulding span is roughly360-390px. That suggests a semicircular family, with crown-to-floor / span roughly1.33-1.50 and spring-to-floor / span~0.86-0.99. Using40ft versus45ft as the span changes an inferred crown materially, approximately16.2-20.6m. Cornice projection, plane correspondence, perspective correction and exact clear-width datum remain unresolved. **These unrectified ratios are sensitivity evidence, not an accepted measured height.**

The current upper spine-roof underside18.9224m falls inside that broad sensitivity range; it cannot choose the height on the evidence's behalf. Hold a final spring/crown until a proportionally registered photo or original section supplies a tighter control. A candidate must record its selected interpretation and compare a matching camera view; it must not silently squash the vault to fit the old roof.

An original longitudinal section is catalogued as Hagley2471_01_03_01. The public archive endpoint currently serves a human-verification challenge, so no source drawing was retrieved and no workaround was attempted. It remains a useful next primary target. The newly downloaded existing S1 technical booklet has authentic loggia photographs but no retrieved dimensional arcade section.

## Important threshold-level discrepancy

S1, the railroad's technical booklet, PDF33, captioned`Corner of Loggia at the head of Grand Stairway, looking through the Arcade to Seventh Avenue`, visibly shows several shallow steps up from the loggia to the arcade and to the side restaurant-screen entrance. The current model gives arcade and loggia a single flatstreet0floor and puts the whole14ft drop into28Main risers. These photos do **not** substantiate that exact distribution.

Do not modify the accepted Main staircase merely from counting blurred photo lines. Trace the small flights, recover a level section, and coordinate the split of the adopted street/Main drop before changing surfaces. At first, source architecture can be reviewed around retained route datums with this flat-threshold simplification explicitly labelled. It should not be called completed historical loggia geometry.

## Bounded authoring order

1. Freeze the ownershipJSON and source SHA. Work in a new external module directory. Remove/replace only the33 granite and28 window components after their replacements exist; retain all unselected batch attributes/UV/normals and floor/stair interfaces.
2. Build engaged source-plan piers/pilasters, backed shop openings and loggia side entrance frames as an external proof. UseTravertine/Denivelle facing vocabulary rather than exteriorMilfordGranite. No speculative shop names or identically repeated window stickers.
3. Resolve/register the barrel/lunette heights and actual outer light paths, then close the ceiling continuously. Coordinate both courtyard spine walls at real light openings; do not bake bright glass on opaque backing.
4. Finish the widened vestibule and keep the outdoor portico separate. Close unintentional seams and back the side rooms while retaining documented restaurant doors and central access.
5. Reconcile the small arcade/loggia step levels with Main. Then run walk/headroom/contact checks across allX24.9-119.4816, below the new vault and through both real side entries; rebake affected illumination and verify the actual public module.

## Useful1939 shop reference, not yet positioned

**Architectural Record, April1939, printedp114/PDF70**, [original journal scan](https://usmodernist.org/AR/AR-1939-04.pdf), documents the`Doubleday-Doran Pennsylvania Station Arcade Bookshop`, architectsDawsonandOliver. It contains a scaled circular plan, concentric shelves, central three-way display, wrapping/cashier zone, plaster dome and direct/indirect lighting. The source authenticates a tenant/interior by1939, not its particular arcade bay or storefront lettering. The floorplan needs matching to the station plan before placement. Reference scans/photos stay external because reproduction rights have not been established; no book cover artwork or journal photograph is proposed as a runtime texture.

This handoff provides source-owned replacement selectors and identifies real defects. It deliberately distinguishes documented architecture from missing dimensional/level controls rather than presenting a complete build-ready historical survey.
