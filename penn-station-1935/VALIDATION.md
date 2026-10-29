# Phase 4 maintenance checkpoint validation

Checked 29 October 2026. This is a tested navigation, physical repair and material checkpoint. It is **not** the completed photographic reconstruction or the larger ceiling/interior visual pass. The previous release record is preserved in [the Phase 3 archive](../authoring/penn-station-1935/review/phase3/VALIDATION.md).

Browser bundle SHA256: `84633c64d9a7562e6e871ecb340237ca35903e0bf193ae5a6d18037333adca95`.

## Changed behavior

| Before | After | Why |
| --- | --- | --- |
| Orbit mainly rotates around a target | WASD/arrows translate the eye and target together; Q/E change height; Shift increases speed | Explore the connected station freely while retaining mouse orbit |
| Four office labels read backward from the hall | Original glyphs rigidly rotate toward passengers | Correct TELEPHONES, TICKETS and PARCELS without inventing new wording |
| An approximately118mm floor-to-tread slot and gate posts obstruct the train approach | Nine floor openings meet their first treads; complete paired indicators stand on supported stair flanks | Make the physical route traversable without noclip or smaller body clearance |
| A single toe ray rejects a quantized stair-nosing bevel | Bounded finite-foot contact checks actual nearby horizontal tread geometry | Traverse a tiny real bevel while keeping void, body and step guards |
| Strong colour variation and bump dominate the stone | Four linear-light colour derivatives and restrained normal strengths | Calmer interpreted granite, travertine and marble; original maps and geometry retained |

## Desktop navigation and interface

Installed Chrome156 on observed Apple M5 Max Metal. These are measured desktop checks, not universal hardware certification.

- **13 integration groups pass** against the bundle above: persistent six-zone world, four exterior corners, interior/neighbourhood/platform views, walking, lighting/FOV/shadows, modal focus/Escape, archive framing, guided-tour cancellation, existing fallback layout and model/HDR/graphics recovery. [Report and screenshots](../authoring/penn-station-1935/review/phase4/browser-metal/validation.json).
- **Full desktop train round trip passes**:17 real-keyboard legs and4,935 camera samples from the waiting room through the concourse, main stair, exit landing and both doglegs to Platform5, then back. No camera setters, platform shortcut or pose reset. All six scene IDs remain constant; the platform eye height is approximately−10.3061m and the final hall eye approximately−2.5842m. Five bounded contacts use actual geometry10mm from a tread bevel. [Report](../authoring/penn-station-1935/review/phase4/train-route-metal/report.json).
- **10 finite-foot controls and27 authored flight registrations pass**: real bevel support, missing central ray/void, absent tread, wrong-height ledge, too-distant support, non-stair region, outside-flight sample, excessive rise/drop and underside rejection. The20mm search never substitutes a floor plane. Existing body radius,240mm rise and350mm drop limits remain.
- WASD flight, QE/Shift, camera/target coherence, deceleration, native-field/dialog/blur guards and persistent world were also tested. Completed390px held-touch checks remain evidence of the existing fallback; the user deferred further mobile optimization and physical-phone certification.
- The existing seven-leg exterior–hall–concourse–grand-stair regression passed on the earlier maintenance candidate before the final bounded stair-contact helper. Its exact older bundle hash remains in [that report](../authoring/penn-station-1935/review/phase4/hall-route-metal/penn-route-validation.json); it is not represented as an exact-final-bundle test.

## Geometry, materials and delivery

-12 full/fallback GLBs decode with **zero glTF validation errors**,56 shared KTX2 textures and208 existing compressed-format/tangent warnings. [Full asset report](../authoring/penn-station-1935/review/phase4/assets.json).
- Model, unique texture and lighting transfer totals **91,681,299bytes** across both variants. Whole-site custom staging remains below100,000,000bytes; its exact final count is in [public-staging.json](../authoring/penn-station-1935/review/phase4/public-staging.json). Relative project-prefix loading and blocked external services were exercised. Existing legacy root Pages settings are retained; this checkpoint does not change publishing source.
-2,754 decoded upward-triangle support samples pass across all nine repaired stair heads and both delivered geometry variants. Original inputs correctly fail675/1,377 samples per variant. Physical repair receipts preserve unmodified compressed payloads, UVs, normals, indices and lighting metadata. Gate relocation converts only two POSITION views to Float32 to avoid clipping their outer frames; unrelated coordinates change by at most2.565micrometres. Exact post placement remains reconstructed. [Repair evidence](../authoring/penn-station-1935/review/phase4/STAIR_HEAD_REPAIR.md).
- Four office labels were corrected in full and fallback geometry and the editable Blender source. A real walking camera confirms legible TELEPHONES. [Evidence](../authoring/penn-station-1935/review/phase4/signs/).
- Nine original CC0 map hashes remain unchanged. Stone colour and normal-strength changes preserve geometry BIN/UVs, roughness, metal, AO, base-colour factors and lightmap references. Actual Metal before/after views and decoded KTX image checks are retained. [Material evidence](../authoring/penn-station-1935/review/phase4/material-finish/).
- Phase3 illumination and reflection captures are intentionally retained, with their original source hashes. They predate the new palettes and small geometry repairs. No new GI or reflection bake is claimed here.
- Source syntax, five-app manifest/link validation and whole-site staging pass. The authoring-only sharp dependency is pinned to patched0.35.5; npm audit reports zero advisories after that update. Browser rendering-library versions remain unchanged.

## Visual acceptance and remaining work

The checkpoint improves movement, the physical train route, office signs and stone appearance. It does **not** meet final photorealism acceptance. The user specifically identified the visibly defective waiting-room ceiling: blurred/coarsely mapped illumination, dark inward-facing arch bands and coarse capital/coffer detail remain. Corrected arch faces, dedicated higher-resolution ceiling/masonry bakes and close-up review are the next visual work, alongside authenticated concourse windows/prism fields, refined fixtures and further reflection captures.

A restart removed the earlier temporary, uncommitted larger visual pass. Its models, bakes and prior test results are not included or claimed as delivered. Saved Phase3 sources were restored into a persistent project folder; this record describes the rebuilt checkpoint only.

The143/150ft ceiling-source conflict, interpreted minor profiles/material colours, five neutral mural fields, incomplete sculpture/furnishings, unverified later-period railway operations and realistic passengers remain explicit. The fuller Manhattan streetscape stays last. Mobile optimization is deferred at the user's request. Native-WebGPU parity and physical-phone performance are not certified.

Chrome sometimes labels completed HTTP200 responses as cancelled. A controlled trace through the app's natural readers found complete expected byte lengths and matching SHA256 for all12 such responses, no AbortSignal, all six decoded models and no page errors. The cancellation flags remain in the [diagnostic record](../authoring/penn-station-1935/review/phase4/network-read-hashes.json); reporting uncertainty is not hidden or presented as a missing-asset fix.

Publication is checked against the matching commit separately. The pull request remains draft and must not be merged without owner authorization.
