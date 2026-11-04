# Arrivals lighting UV handoff

The corrected V2 raw bake passes source-preservation and fresh-AO export checks. This package provides the exact executed source, a portable lighting-UV replay, a reviewed production adaptation and measured raw-export acceptance. It does not change the repository or publish runtime assets.

The four-kilopixel atlas now gives public stair treads/landings115.81texels/m instead of42.30 (2.738×); risers receive92.64texels/m (2.190×). Every public gallery/retained-floor face gains at least1.095×. Existing4,672opaque triangles and all fine iron geometry remain. This improves spatial lighting resolution; it does not create authenticated new architectural detail or establish finished photorealism.

## Actual bake and preservation

`actual-bake-v2-source/` is byte-identical to the frozen source root executed. Keep it unchanged as evidence. Its source guards preserve geometry, both UV sets, normals, transforms, visibility and material assignments after import. Neighbor-only library preparation excludes the primary's mesh/material pointers and proves all7primary shader/image states exact since initial import. All10original neighbor profile records are restored;28current profiles cover the expanded8contexts. The context partition physically excludes the original4,047ARRnodes, avoiding duplicate geometry. Original hidden-template rules are restored with the correct Main0offset. Only the opaque architecture is selected and active before baking.

`proofs/actual-v2-raw-acceptance-v2.json` checks the actual finished output against original unquantizedf346and authored85bf. All374,852oriented triangles retain exact positions; UV0, node JSON and scene membership are exact. Exported normal re-encoding peaks at0.038583° (declared bound0.5°), and authoredUV1round-trip error peaks at2.98e-8. These values are measured, not called byte-exact. All7PBR material definitions remain exact except the declared illumination scale, and every authored PBR image payload is byte-identical. All4occlusion bindings resolve the actual new AO's red pixels exactly. Eight deliberate regression controls reject changed position/UV/normals/material/normal-image/stale-AO cases.

## Portable CPU replay

Use Python3.11, bpy4.3.0, NumPy<2and Pillow13.0.0. Explicit paths replace machine-specific imports. The original source and raw bake are pinned in `input-identities.json`; they are large binary artifacts and are not bundled. A clean clone must obtain those exact archived inputs before replay. Do not substitute quantized runtime UVs. The gzipped saved UV array is included in `data/`.

    uv run --offline --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python source/lighting_uv/arrivals_atlas_priority.py --source /path/to/arrivals-module.glb --baked /path/to/original-raw-bake.glb --out ./replay --pack
    uv run --offline --no-project --python 3.11 --with 'numpy<2' python source/lighting_uv/validate_priority_pack.py ./replay
    uv run --offline --no-project --python 3.11 --with 'numpy<2' python source/lighting_uv/write_uv_only_candidate.py --baked /path/to/original-raw-bake.glb --uv ./replay/candidate-lighting-uv.npy --out ./uv-only

The portable replay was run with CPU packing only and reproduced the exact85bfe97f…GLB input byte for byte. All bytes outside UV1 accessor elements remain exact. True-island adjacency requires a complete common physical edge with matching UVs at both endpoints. Each of1,564charts is scaled as a whole; public floor-containing charts retain their minimum priority. BlenderCONCAVEpacking with4/4096margin supplied separation. No independent exhaustive UV-triangle overlap/gutter certificate is claimed.

## Production adaptation for root review

`patches/production-arrivals-preserve.patch` targets production baker600bb9d6…plus its pinned guard/visibility helpers. It expands preserve mode to the exactMain0arrivals artifact and offsets the sourceStreet0visibility bounds into the bake frame. It keeps `--materials` rejected in preserve mode and `--occluder-materials` mutually exclusive. It adds the initial primary-material snapshot before all neighbor imports. Existing fresh-AO and neighbor-only helpers remain byte-identical. The production baker removes a redundant first copy of the actual source's two identical pre-context material snapshots; the second retained snapshot occurs before any neighbor import. No other bake algorithm changes.

The patch was applied and compiled in an external fixture and produced the recorded production hashes exactly. The cleaned production copy has not undergone another full Blender preflight; the actual executed frozen source already passed full-context CPU preflight and the completed bake. `source/lighting_uv/` includes its dependencies for standalone source review. Root must review/apply the delta on the feature branch; this task has not edited root.

## Runtime replacement

Use unchanged `phase7-arrivals/packaging-v1/concourse-without-old-exit.glb.gz`, SHAd06fb5fbea6908f1584b9ba263cd5db2d65a710dc37c0e3ff4c1bbfe16ef3269. Its15,672,836-byte BINprefix has SHA61f264f2d14685363a9a299fdca3f51a2ed613ceec7bf20391a2fd9fd3beeeeb. This is the exact original optimized phase8append input, not a light-transport occluder. Both current runtime variants retain its JSON prefixes and entire BINexactly. The existing append helper replay reproduces the original38325d19…output byte for byte.

Optimize only the newly baked ARRmodule, then append it to this unchanged base with `append_access_module.mjs`, artifact`concourse-arrivals` and the7allowed materials from the original receipt. Do not append to the old already assembled38325d…or currentb2bce…scene; that duplicates oldARR. Do not use pre-removal210f52…or raw35f726…as runtime authority. The current full normal correction affects only the replaceable ARRsuffix. Keep authored.035strength and use the reviewed normal compression; verify the new normal URI/hash rather than copying old texture index33.

Denoising/transfer checks, source-image resize/compression, optimized AO/UVchannel checks, exact retained-prefix ownership, other-zone asset snapshots, both encoded walking routes, actual native browser appearance/performance and deployment remain parent gates. The existing reflection/platform maps still need reconciliation where the enlarged floor changes their surroundings. Full arrivals completion remains a separate architectural task with northern, streetward and unresolved support transfers held explicitly.
