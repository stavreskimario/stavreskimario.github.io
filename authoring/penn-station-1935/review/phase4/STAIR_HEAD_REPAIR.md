# Main-floor stair-head maintenance

This corrective geometry pass closes a gap in the earlier reconstruction. It does not establish new historical stair dimensions or certify the complete railway route.

The main-concourse stair head is X −42.2563 m. The old floor opening ended at X −42.1363 m, 120 mm east of that datum, while the first tread extended only about 2 mm east of it. The resulting 118 mm unsupported slot could trigger the walking system’s leading-foot protection.

The revised opening meets the head datum. The actual tread positions, 19 reconstructed steps, floor levels and gate spacing remain unchanged. All nine openings receive the same correction. The saved main-floor slab and axial-passage floor boundaries receive the corresponding source change.

`model/repair_stair_heads.mjs` applies the change to the full and mobile delivered geometry by decoding and re-encoding one POSITION buffer view. Each version changes 233 X coordinates. Every unaffected compressed payload is compared byte-for-byte; the modified positions pass an exact Meshopt roundtrip. Normals, indices, both UV channels, materials and lighting metadata remain unchanged. `model/repair_stair_heads.py` applies the matching correction to the editable Blender scene, changing 408 raw floor vertices. The canonical `build_station.py` uses the corrected boundary for subsequent rebuilds.

`tests/penn-stair-geometry.mjs` independently samples actual decoded upward-facing triangles across the seam, including three lanes at each of the nine heads. The corrected full and mobile geometry passes 2,754 support samples. A negative control using the committed Phase 3 geometry reproduces 675 unsupported samples out of 1,377 in each quality version. This demonstrates the former discontinuity and its repair; it does not replace the separate browser walking test through the lower stair doglegs and onto a train platform.

The retained Phase 3 global-illumination atlases and reflection captures predate this local floor extension. Their original source hashes remain in the provenance record. No new bake or capture is claimed for this maintenance patch. Exact stair step counts and minor landing profiles remain reconstruction choices under the existing dimensional qualifications.

## Indicator clearance

The continuous browser route exposed a second obstruction. The eastern aisle lies between the stair head at X −42.2563 m and the subsidiary-room wall at X −41.5 m. The former interpreted indicator placement at X −41.8563 m blocked that aisle. The browser collision report identified the actual painted-iron post, rather than a navigation permission or a missing-floor check.

Complete post assemblies now stand at X −42.9563 m and ±2.15 m from each stair centre. This places their 310 mm radius bases on solid floor beside the ±1.75 m stair fences. The gate pairs and 16 ft height follow Gibbs p. 266; these exact placement offsets are reconstructed to provide coherent supported geometry and circulation. They are not presented as surveyed historical dimensions. No body radius, step limit or missing-floor protection was relaxed.

`model/repair_gate_clearance.mjs` selects whole connected components inside each post envelope, including positional seams. This excludes nearby structural beams that a simple bounding box could split. It translates the iron posts/cabinets and their white fields/numbers together, preserving all indexed triangles, normals, UVs and materials. All 18 assemblies are included in each quality version. The two position views use Float32 within their original node transforms because moving the terminal posts beyond their former quantization frame would otherwise require rescaling the surrounding architecture. Unmoved coordinates are rounded once from normalized short values to Float32, with a maximum scale-dependent error of a few micrometres. Every other compressed payload remains byte-identical. This adds about 3.77 MB across the two compressed delivery models.

The corresponding editable source patch, `model/repair_gate_clearance.py`, moves 4,752 iron vertices, 576 white-field vertices and all 72 native number FONT objects. The resulting `penn-station-phase4-maintenance.blend` also contains the floor-seam and waiting-room office-sign repairs. Detailed source/output hashes, per-post counts and payload proofs are retained in [stairs/](stairs/).

The full and mobile post candidates each pass glTF validation with zero errors and the 23 existing compressed-format warnings. Their decoded stair-head support checks still pass all 2,754 samples. Complete route results belong in the final browser report. Two north/south-facing indicator numeral orientations remain a separately identified correction for a later pass; this translation does not claim to repair those faces.
