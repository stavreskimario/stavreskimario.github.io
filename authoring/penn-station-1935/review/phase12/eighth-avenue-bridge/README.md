# First Eighth Avenue bridge bay

Historical checkpoint: superseded by Phase13. The two linear HDRs, two PNG derivatives and original single-bay Blender/GLB files are now restored from exact Git objects using `review/phase13/storage/restore-phase12-source.py` (repository-relative authoring location). See its receipt before replaying this old checkpoint; reports below describe the originally accepted files.

The editable Blender addon uses Geometry Nodes for the eleven column/foundation stations repeated across two source-corresponding bents. Seven evaluated mesh owners contain 8,256 triangles. The roof, built-up columns, cross-girders, longitudinal girders and buried bearings follow the documented structural families. No passenger-floor pedestal or opaque gallery sidewall is added.

The bounded section lies between approximately Z 6.33 and 13.0, across the 100 ft avenue width. This is one bay of the 525 ft bridge. Plate LIX establishes the width, column spacing and member families; local member depths/thicknesses, minor fabrication, cover, world registration and material appearance remain qualified. The source under-clearance line is not treated as a uniform slab underside.

`model/bridge-addon.blend` retains editable Geometry Nodes. The accepted material revision is `model/bridge-addon.glb`, SHA256 `e888dd861313368251d438203ee2c10a3ff3efe9b80f33b0e4d78f5345724d3b`. Its geometry and binary payload are identical to the first source export `5858205a`; only the painted coating changes. The Main0 coordinate frame receives the existing −4.2672 m runtime height translation once.

The first browser view exposed an overly metallic, nearly black painted surface. The material-only correction uses a dielectric coating with linear color (0.18, 0.19, 0.17), metallic 0 and retained roughness 0.64. This is a calibrated appearance interpretation, not recovered historic paint. `source/material_v4.executed.py` derives the glTF material values from the updated Blender material while retaining every original geometry byte. The exact change proof is in `acceptance/material-change-proof.json`.

`acceptance/raw-physical.json` checks all 22 column positions against real existing receivers, 30 roof/rail-clearance samples and 250 body samples on the adjacent Platform 5 paths. The first eight stair regions are disjoint. These are scoped geometry checks; no structural-capacity certification or native walking walkthrough is claimed.

`evidence/` contains the corrected source scope, primary section/plan crops, URLs, rights and arithmetic replay. `source/` retains the exact executed builder and checker. Their original work paths identify pinned external inputs and must be rebound in an external authoring directory for replay; they are not browser dependencies. Lighting, compression and mounted-view acceptance are separate from this source checkpoint.
