# Connected Penn Station arcade — source-only checkpoint

This checkpoint preserves the reviewed architectural authoring and its evidence controls. It does not change the live website, replace the canonical Blender file, or claim final lighting acceptance.

The source version is `connected-v12`. Its connected geometry includes the formal arcade, paired Ionic loggia screen, bounded restaurant entrance bays, grand-stair side enclosure and widened Seventh Avenue vestibule. The outdoor Doric portico stays open. Every existing public floor, all 28 Main risers, the existing monumental Main arch/jambs and unrelated source geometry/materials remain protected.

## Reproducible input

The exact input Blender SHA256 is:

`c96fb37215d4ebfc7bbbba9154fe7f96a8daf8500e9c61778136e286c4a03739`

That file is already preserved in Git at commit `abde5167c984b6bf28286af3259e79380ba7fb36`, path `authoring/penn-station-1935/penn-station-phase5.blend`. Its Git bytes were independently hashed against the working input. The external source archive also retains an identical copy; this narrow checkpoint does not add a duplicate 76 MB base file.

The four JSON files in `controls/` are byte-identical to the frozen inputs. The CLI refuses a different Blender file or changed controls. It never saves over the input and requires a new output directory.

```sh
python3 repair_arcade_enclosure.py \
  --source /path/to/the/reviewed/penn-station-phase5.blend \
  --check-inputs
```

Authoring requires the existing Blender Python environment used for this station:

```sh
uv run --offline --no-project --python 3.11 \
  --with bpy==4.3.0 --with 'numpy<2' \
  python repair_arcade_enclosure.py \
  --source /path/to/the/reviewed/penn-station-phase5.blend \
  --out /path/to/a/new/external/review-directory
```

`portable-source-proof.json` proves the architectural body in `repair_arcade_enclosure.py` is copied byte-for-byte from the frozen generator, and `arcade_connected_extensions.py` is unchanged. The portable header alters only argument/path handling and input checks. Both files compile and `--check-inputs` passes. A complete replay through this portable header is not claimed here; the frozen original producer ran successfully.

## Source and uncertainty

The primary controls are McKim, Mead & White plates 300, 302 and 305; the railroad's 1910 technical booklet; and Detroit Publishing photograph 071930, [LOC original scan, digital ID det.4a23715](https://tile.loc.gov/storage-services/master/pnp/det/4a20000/4a23000/4a23700/4a23715u.tif). Native reference scans and photographs remain research-only outside this package.

The longitudinal barrel and side lunettes, four-column paired-depth axial screen, restaurant entrance relationships, widened vestibule, and opaque upper terminal field follow those plans/photographs. Exact working heights and individual faces remain qualified reconstruction. The independently fitted arcade spring/crown are 11.15/17.246 m, with at least ±0.6/±0.8 m interpretation allowances. Published 220 × 40 ft and 225 × 45 ft descriptions remain a documented datum conflict.

Fine Ionic mouldings, metal sections, sail recess/curvature, secondary backing depth and some glazing subdivisions are interpreted. The small arcade/loggia threshold steps stay held while the existing public floors and 28 Main risers remain exact. No mirrored niche inventory, invented tenant signs, complete restaurant operations or 1:1 replica claim is introduced.

The vestibule side slab's inner 0.75 m band bridges from the old paving edge to the actual outer footing. That supported overhang is an inferred slab interpretation; no new solid foundations are invented to fill it.

## Exact ownership and artifact frames

The authoring replaces 394 specified old connected components. It preserves all retained corner positions, normals and UV layers, 11,269 unrelated object signatures, and every old named material's node properties, socket values, links and full custom-property values. Blender's exporter-only `used` texture-node tag moves are independently reproduced, logged and restored; PBR or image-reference changes are not waived.

The final correction adds only a closed arched reveal bridge X16.535–16.565, joining the actual ashlar back face and backing around the unchanged clear portal. Both old-owned files and both protected files remain byte-identical to accepted v11 authorities.

| Artifact | Frame and use |
| --- | --- |
| `formal-arcade-module.glb` | All new geometry, glTF **street-zero**. No Main vertical offset. |
| `old-arcade-owned-exterior-street0.glb` | Exterior removal authority, street-zero; original material names. |
| `old-arcade-owned-main-main0.glb` | Main removal authority, Main-zero; place Y−4.2672 in street world. |
| `retained-exterior-occluder.glb` | Protected Exterior, street-zero; original names, zero images/textures. |
| `retained-main-occluder-main0.glb` | Protected Main, Main-zero; place Y−4.2672 in street world; zero images/textures. |

`source-freeze.json`, `source-proof.json` and `retained-main-export-proof.json` pin the external artifacts. Those large generated files are not part of this narrow source-only package.

## Materials and navigation handoff

All thirteen new materials have unique names and independent node trees. All carry `reflection_probe = "arcade"`. New repair materials preserve their original surface identity through `surface_source_name`; no old runtime atlas should be rebound to their new UVs. Primary new stone/paving UVs use the shared world × 0.28 convention. Repair boundaries inherit the original component's UV basis, with identical old corner UVs copied exactly.

Clear glass is an interpreted uncoated plate response: transmission 1, roughness 0.05, IOR 1.52 and backface culling. Its actual panes carry `walk_collision = "closed-glazing"`. The public doorway remains a real opening. The matte cast-composition vault and neutral shop backing have no inherited stone-normal/roughness links.

Five qualified walkable additions connect the actual retained loggia and new restaurant/vestibule side slabs. Their glTF X/Z bounds are in the source proof and new slab extras. Existing walkable fields stay unchanged.

The reviewed lighting-preparation step may set `skip_lighting_atlas` only on exact `ArcadeOrnamentalMetal` (1,142 fine primitives / 46,344 triangles), preserving the frozen source and all geometry. Glass already skips that atlas. Root must produce and validate fresh illumination/reflections using current geometry; studio-fill review images are not final daylight acceptance.

## Validation and promotion

Frozen v12 has 596,604 triangles and thirteen materials. Every new solid passes directed-edge closure, positive volume and nondegenerate triangulation. The CPU audit records 1,878 passing finite probes, including all twenty measured reveal-slit probes. The independent architectural reviewer separately checks dense street-to-Main circulation, all eight Ionic bearing chains, arch normals, retained ownership/materials and side-floor metadata.

Root owns the final source review, asset baking/compression, four-tier strict removal, navigation/glass integration, native browser traversal and publication. Until those gates pass, the canonical source and live assets remain unchanged.
