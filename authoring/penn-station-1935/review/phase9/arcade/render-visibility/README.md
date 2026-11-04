# Arcade render visibility and editable-source receipts

This package preserves the source-only evidence for two non-rendering construction templates. It changes no frozen model authority or canonical source. The derived context models are deliberately omitted; they can be regenerated from the exact protected raw exports below.

`hidden-source-visibility.json.gz` is a lossless archive of the full source inventory (4,237,859 decoded bytes). Its decoded SHA256 is `b6ea9225593b9e7a7f325e8b254e1087ae251dd62f076f63db566607fd7676ae`. Original c96 and editable c4aa have the same two `hide_render=True` objects: `Doric column master — 35ft` and `Fluted Corinthian shaft master`. No source collections are render-hidden. The railway has no hidden source objects; the actual context and train export inputs contain none of their source templates. The exact raw input audit is retained separately.

`derive_visible_occluders.py` accepts the gzip inventory and the original Exterior/Main protected GLBs. It removes only the matching node references from scene roots or parent-child lists. Every node, mesh, material, accessor and BIN byte remains unchanged, with independent hashes in `visible-context-proof.json`. It validates source identities and geometric bounds rather than filtering object names heuristically. The original protected-authority SHA256 values are:

- Exterior Street0: `fc62b1f34c1a56c771a2b91e21aa48e3c5d2d0d1f65712c62c29b0d450894ec6`.
- Main Main0: `5e56cfc2a135c499eb40a1a9c6ad5516359c7bbee95043a8f0d32ebba58ad511`.

Example replay, supplying those original raw exports and a new output directory:

```sh
python3 derive_visible_occluders.py --exterior /absolute/path/retained-exterior-occluder.glb --main /absolute/path/retained-main-occluder-main0.glb --visibility hidden-source-visibility.json.gz --out /absolute/path/new-visible-contexts
```

Blender4.3 imports orphaned GLTF nodes back into its scene. Therefore scene-reference unlinking alone does not restore render visibility in that importer. `restore_imported_visibility.py` must run after importing each context, applying its actual frame offset, and updating the view layer. Its exact input SHA, node name and source-world bounds guard the operation. It restores only `hide_render=True` for those two source templates. The two-input Blender check passes, with every object matrix, mesh identity, material slot and unrelated visibility flag unchanged. Main Main0 is placed at street height minus4.2672m before this check. Real colonnade instances remain visible.

`editable-source-cleanliness.json` verifies c4aa is an editable architecture source: all old camera/light objects (zero), world data, original object visibility and collection memberships are exact; all2,041 new objects are meshes; obsolete export/removal collections are absent; no studio render actors were saved. It records the exact c96 Git backup commit/path/SHA. This is a source cleanliness receipt, not a final browser or photographic-fidelity claim.

The audit producer scripts are retained as exact working-source receipts. Their original absolute source locations describe the audited files; only the two explicitly parameterized derivation/restoration helpers are portable APIs. This package contains no derived GLBs, reference photographs, historical PDFs or duplicate blend files.
