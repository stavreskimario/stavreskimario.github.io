# Reviewed compressed vault module merge

`model/merge_blender_module.mjs` retains the default texture-free module path: existing material records are authoritative, incoming raw material extensions are ignored, and old compressed bytes are not re-encoded. The explicit `--replace-material-binding true` option requires `--replace-material PaleVaultPlaster` and exactly one named vault material.

Only that material's AO texture information and the four reviewed lighting extras may change. Existing colour, roughness, metallic response, other PBR fields and every non-vault material remain exact. New external AO images keep their original `textures/<20-character SHA256 prefix>.ktx2` URIs; actual files are checked against the URI hash and KTX2 identifier. Image/texture/sampler indices are remapped. The caller places external files; the merger does not alter or re-encode them.

The module's real buffer 0 is appended at the old BIN length. Raw buffer offsets and compressed-source offsets receive that offset, while virtual fallback offsets stay local and their buffer indices move after all existing buffers. Original virtual buffers, views and accessors remain exact. Accessor, primitive, mesh and child/root-node references are remapped without changing transforms. A sole-material old vault mesh is removed instead of leaving an invalid empty primitive list; only its old node's mesh binding is detached. Other old mesh indices are adjusted without changing their records or geometry.

## Controls

`tests/penn-merge-module.mjs` passes 13 small regression controls. The fixtures combine an existing compressed base, a default raw fixture, and a textured replacement with two separate virtual buffers, raw views, compressed views and a nonzero accessor offset. The actual pinned Meshopt decoder reproduces positions, normals, UVs and indices. Controls also check unchanged PBR/materials and reject non-vault binding authority, textured default modules, traversal image paths and non-AO texture roles. The raw fixture contains an ignored transmission material extension to exercise the existing authoritative-material behavior.

Run with the pinned `PENN_TOOLS` environment:

```sh
node tests/penn-merge-module.mjs
```

## Actual module receipt

The tested desktop candidate is `/Users/stavreskimario/Desktop/penn-station-work/phase5-materials/merged-runtime/model-waiting-room.glb`, SHA-256 `0a562061f7a4e1d50338875051da08cc16c66c60188425691588683f6e2c685b`. It merges the delivered room with the optimized one-material vault module `a8e9d570…`. All **15,761,452 old BIN bytes** remain an exact prefix. Its new AO uses effective `TEXCOORD_0`; the application follows the exported AO channel rather than the descriptive atlas-UV extra.

`actual-decoder-proof.json` independently reads the original room, standalone module and merged candidate through the actual Meshopt decoder. All 14 unrelated primitives retain exact decoded attributes, indices and world transforms. The new vault's decoded fingerprint is identical before and after merge: `4dd73ed3283cf86a399343ed729d4e85ea12ef3cf92a66cc47610ed782b0d950`.

A separate read-only review confirmed the exact BIN prefix, eight retained mesh records, non-vault materials, scene roots and buffer-index/offset remapping. `source-receipt.json` records helper/test hashes. No app, runtime asset or built bundle was changed by this utility work, and no commit was made.

These are integration/transport checks. The new vault preview is **not visually accepted**: its visible speckling remains under separate AO/GI/precision diagnosis. Correct merging does not establish acceptable source lighting or optimizer quality.
