# Connected arcade, loggia and vestibule — external source candidate

This continues formal candidate-v5 into a physically connected entrance sequence. All changes remain external to the repository source and public assets. The ancestral canonical input is SHA256 `c96fb37215d4ebfc7bbbba9154fe7f96a8daf8500e9c61778136e286c4a03739`.

## Primary controls and qualified reconstruction

The source chain is S2 McKim, Mead & White plates 300, 302 and 305; LOC Detroit negative 071930/digital ID `det.4a23715`; and S1, the railroad's 1910 technical booklet, PDF29, PDF30 and PDF33. Native renders/crops and original receipts are in `../research/`. The source photographs are research references, not proposed runtime textures.

- Plate 300 supplies the seven broad arcade intervals, paired-depth four-column loggia screen, two-column restaurant entrance screens, and widened Seventh Avenue vestibule. World positions remain a qualified manual registration to the existing station envelope. Published 220 × 40 ft and 225 × 45 ft descriptions remain documented alternatives; this does not establish their exact finished-face datums.
- The independent 071930 arch fit supplies the approximate 11.15 m spring and 17.246 m crown above the held arcade floor. Conservative interpretation allowances remain ±0.6 m spring and ±0.8 m crown. It uses neither the old flat wall height nor the old wing roof to choose the historical height.
- The four-column axial screen is reconstructed at X30.40/31.98 and Y±2.55 m. Its abacus is at Z8.72 and entablature top at Z11.15. Positions carry at least ±0.25 m manual registration uncertainty; the lower order height carries ±0.45 m photo interpretation uncertainty. Fine Ionic profiles, volute turns, egg ornament and stone joints are reasoned reconstruction.
- Four further Ionic columns frame the two documented restaurant entrances at X26.55/29.95 and Y±7.36. The finite backed entrance bays are not a reconstruction of all restaurant furnishings or operations.
- The upper terminal field inside the transverse archivolt reads as an opaque recessed sail/lunette in 071930. Independent review agrees that the smaller Main portal should not appear above the screen frieze. The new shallow curved cast-composition sail has an interpreted 0.80 m recess and 0.18 m shell. It seats on the real entablature and contacts the archivolt boundary, leaving the public opening below entirely open.
- The vestibule adopts X101.29–111.1816 and Y±10.5 m from the source plan's widening ratio. Allow ±0.4 m for its finished side faces. Its compound vault, front glazing subdivisions and minor reveals remain qualified reconstruction. Its real lower front doorway admits light from the unchanged portico. Retained exterior attic/clock masonry can obscure high glazing and must not be removed simply to brighten the interior.

The small steps between loggia and arcade visible in S1 PDF33 remain unresolved. The candidate retains the existing street-zero arcade/loggia datum and every original Main staircase tread. The reconstructed floor-level split must stay explicit in historical claims.

## The brown wall correction

The blockage was not the actual monumental arch. It was two flat backing headers starting at street Z6.3328:

| Existing source batch | Component | Exact world bounds |
| --- | --- | --- |
| Exterior MilfordGranite | 5927 | X16.5608–18.1356, Y±6.0198, Z6.3328–26.7328 |
| Main Travertine | 556 | X16.565–17.835, Y±6.4, Z6.3328–26.7328 |

Both now receive a curved aperture behind the existing stone arch. The existing Main arch 722 and jambs 723/724 remain unchanged, with their Z10.5328 spring and Z16.8502 outer crown. The backing aperture uses 6.3374 m radius, providing 20 mm clearance beyond the retained outer arch. No height correction is applied to that original monumental order.

Only the 53 intersecting superficial ashlar components are additionally owned. Portions lying outside the new curved aperture are reconstructed with their original material family; unrelated ashlar remains source exact.

## Ownership, physical bases and frames

The full candidate owns **394** old connected components: the previous 327 formal-arcade components plus two flat headers, 53 crossing ashlar parts and 12 specifically listed foundation cells. Exact selectors and bounds are in `research/arcade-connected-ownership-controls.json` and the candidate's source proof.

All original public floor meshes, the 28 Main treads, stair cheeks, the existing Main arch/jambs, the waiting room's unrelated geometry and the outdoor Doric portico are protected. All unselected corners in affected batches retain their positions, normals and UVs exactly. All unrelated object signatures retain their original values. The canonical file is never saved.

New pedestal feet start at the actual retained or added floor surface. The side rooms and widened vestibule receive 180 mm finish/bearing slabs. Their private foundation tops rebate only inside the recorded finish rectangles, preventing coincident paving surfaces. Rebuilt portions elsewhere in those explicitly owned foundation cells retain their envelope but do not claim original hidden bevels/UVs. A continuous private ledge supports the added grand-stair side returns while preserving all public stair surfaces.

| Output | Frame |
| --- | --- |
| `formal-arcade-module.glb` | Entire new connected geometry: glTF street-zero, X east/Y up/Z south. **Do not apply the Main-room −4.2672 offset.** |
| `old-arcade-owned-exterior-street0.glb` | Old Exterior-owned geometry, glTF street-zero. |
| `old-arcade-owned-main-main0.glb` | Old Main-owned geometry, glTF Main-zero. Apply Y−4.2672 only when placing in street world. |
| `retained-exterior-occluder.glb` | Retained Exterior after ownership removal, glTF street-zero. |
| `retained-main-occluder-main0.glb` | Separately exported retained Main after header/ashlar removal, glTF Main-zero; see its export proof. |

## Runtime metadata

The new glass material has Blender/glTF material extras `walk_collision = "closed-glazing"`. Runtime collision should use these actual pane surfaces. It should not add an invisible barrier across the open central doorway.

The two new vestibule side-floor meshes carry node extras `walkable_bounds`, `walkable_floor = 0`, `walkable_frame = "gltf-world-street0-xz"`, and the source/uncertainty qualification. The new bounds are X101.29–111.1816, Z−10.5–−7.0 and Z7.0–10.5. The source proof repeats them in `walkableAdditions`. Every pre-existing walkable field remains unchanged.

## Review and integration gates

The first connected CPU review checks 579 floor probes, 579 short route probes and 579 headroom probes from the Main threshold to the front vestibule; 21 high-level probes through the previously blocked Main backing; 20 side-enclosure probes; 40 court-daylight probes; 28 lunette-shoulder probes; and 12 front-doorway probes. All pass in v6. The accepted next revision must repeat affected probes after the upper sail/metadata addition and receive the independent architectural contact/ownership review.

All new solids must pass the unchanged directed-edge closure, positive-volume and nondegenerate triangulation gates. Raw authoring objects are not a runtime draw-call budget. Batching, compression, fresh illumination and reflections, collision/navigation integration and native browser acceptance remain required before publication.

Every preview is an explicitly temporary CPU studio-fill geometry review. It is not the final daylight, material calibration or photorealism claim. Existing flat-ceiling lightmaps must not be reused. The geometric candidate is a documented reconstruction, not a certified 1:1 historical replica.
