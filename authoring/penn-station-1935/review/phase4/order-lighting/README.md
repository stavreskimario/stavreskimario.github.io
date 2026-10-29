# Waiting-room order lighting: diagnosis and UV preparation

**The correction has not yet passed browser acceptance.** This record contains an actual-browser diagnosis of the preliminary candidate and an accepted geometry-preserving UV helper. New order/masonry bakes, final texture compression and a matching-camera mapped-browser comparison are still required before promotion. The two retained screenshots are diagnostic evidence, not a finished graphics result.

The preliminary candidate showed hard black patches on the colossal capitals and blotches on the granite shafts. Nine same-camera shader controls held exposure fixed while disabling AO, sunlight, sun shadows, room reflections and normal maps independently. Neither those switches nor double-sided rendering removed the capital patches. A flat white hemisphere with both atlas contributions removed was clean. Disabling atlas mipmaps also retained the defect. All fourteen waiting-room materials were already double-sided.

Actual browser triangle rays found literal `[0,0,0]` source texels in both the original AO PNG and delivered irradiance PNG at visible black leaves. For example, screen `(1050,312)` mapped to Travertine UV1 `(0.20737565,0.04727791)` and a triangle occupying only `0.0234 pixel²` in the 4K atlas. This confirms a defect in the mapped baked data rather than an old reflection probe or ordinary sun-shadow acne. The source-image and browser-hit evidence is retained in [capital-ray-uv-samples.json](reports/capital-ray-uv-samples.json).

The large masonry atlas gave the shafts about 6.38 texels/metre; a bounded capital region received about 6.49. An interpreted 0.8m leaf therefore spanned about 5 texels, while its authored 55mm return was smaller than 0.4 texel. Thousands of padded small islands left only 19.28% of that atlas as surface area. More path samples cannot recover a surface that has insufficient texels.

| Before | After | Why |
| --- | --- | --- |
| The preliminary wall/floor/order atlas allocated about 6.4 texels/metre to the order. | The separate 4K order UV proof allocates 61.54 texels/metre over 1,946.13m², with 43.93% atlas coverage. Browser appearance remains pending. | Separating the eight orders provides about 9.6 times the linear density. |
| A 0.8m leaf spanned about 5 texels and a 55mm return less than 0.4 texel. | The prepared 4K atlas gives about 49.23 and 3.38 texels respectively. | The map can represent the authored front/return relief more coherently. |
| General AO optimization resized embedded maps to 2K. | Preserve this order AO at 4K; a 2K derivative would reduce the return footprint to 1.69 texels. | A global resize could reintroduce lost fine surface support. |
| Original stone grain, normals and architecture were already registered. | Exact per-corner position, normal and UV0 hashes match before/after separation and before/after UV preparation. | The repair changes independent lighting coordinates only. |

## Retained evidence

- [baseline.png](images/baseline.png): actual preliminary candidate with its defect.
- [white-control.png](images/white-control.png): the same camera and fixed exposure, white materials with AO/irradiance removed and constant hemisphere illumination. This deliberately flat image isolates geometry from the atlases.
- [shader-isolation.json](reports/shader-isolation.json), [atlas-controls.json](reports/atlas-controls.json) and [face-controls.json](reports/face-controls.json): actual capture options, browser version, camera/exposure, input/request hashes and errors. The baseline/white pair comes from the same atlas-control run at exposure 4.153373611617231. Other large variant images are not copied into this archive.
- [atlas-density.json](reports/atlas-density.json): measured original physical areas and UV footprints. The bounded capital measurement includes neighbouring order stone and is not a new architectural dimension.
- [order-uv-proof.json](reports/order-uv-proof.json): accepted helper input/hash, eight equal 69,904-polygon selections, exact geometry/normal/UV0 preservation and atlas metrics.
- [rejected-first-pack.json](reports/rejected-first-pack.json): retained failed preparation evidence. Its custom coordinates were not packed into one tile. It was rejected before baking or delivery; the accepted helper selects the active tile explicitly and rejects invalid bounds/coverage.
- [archive-receipt.json](archive-receipt.json): retained-file hashes and explicit pending acceptance. Local path prefixes in JSON are normalized to `repo/` and `work/`; measured values and original content hashes remain intact.

The [actual exported order audit](reports/exported-order-audit.json) also passes before optimization: all eight orders contain 69,904 triangles, positions/normals match the accepted preparation exactly, both material UV0 sets match the existing grain-scale preparation exactly, and every lighting triangle has positive UV area. Both AO bindings use channel 1, with embedded 4K pixels matching the original bake PNG. This confirms export integrity; it does not replace the pending mapped-browser comparison.

## Accepted helper and reproduction

The frozen [order_lighting_uv.py](source/order_lighting_uv.py) is SHA256 `f8d6d1268462f54893129a7c200d6b899d5fdb2eaffd09630f8acca177ac3f6c`. The raw waiting-room input is SHA256 `d2f2f8361a941d3b25f3bb3d4bd32a1c02b09100ec00ab04b7550946bc8e7025`. Floor revision 3 changes the concourse; the tested waiting-room architecture is unchanged.

The splitter selects whole connected stone components in the eight authored plinth/shaft/capital envelopes. Large wall and above-order impost components are excluded. It never crops a carving or alters vertex positions. The new lighting layer uses 89-degree front/return projection, coherent cylindrical shaft strips, equalized island density, a single packed tile and 4px padding. Original surface UV0 is checked before return. [INTEGRATION.md](INTEGRATION.md) gives the three-value split API and bake call.

The [preparation proof](proof/prepare-order-proof.py) accepts explicit `--input` and `--out` directories and imports the frozen helper. Run with Blender bpy 4.3.0 and NumPy 1.x. It imports the actual raw GLB, compares exact per-corner signatures, splits/joins the selected orders, prepares 4K lighting UVs, compares the signatures again, and refuses to overwrite the resulting lighting layer. Output GLBs remain external review derivatives and are not copied here.

[inspect-original-atlas.py](proof/inspect-original-atlas.py) accepts `--input` and `--output` for the original uncompressed baked GLB. The four `browser-*.cjs` scripts reproduce shader, atlas, facing and ray controls against a supplied checkout/candidate with `PENN_REPO`, `PENN_WORK`, `PENN_TOOLS` and optional `PENN_DIAG_ASSETS`; they require the pinned project tool dependencies and actual Chrome. Each new run records its current frontend and input hashes, so a later frontend is not silently presented as the exact earlier capture. [analyse-ray-samples.py](proof/analyse-ray-samples.py) accepts `--work` for the captured ray report, screenshot and original atlas files.

No architecture, material identity or historical accuracy claim is changed by this UV preparation. The 143ft/150ft ceiling conflict, interpreted capital carving, native mural limits and other documented reconstruction qualifications remain. Final mapped-browser acceptance must determine whether 4K sky/AO is sufficient or an 8K order derivative is warranted.
