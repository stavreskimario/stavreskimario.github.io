# Lower 33rd Street soffit finish source

This packet contains the accepted editable model and exact 56 existing underside faces: 52 legacy concrete faces and four later ceiling faces. The source GLB preserves every original oriented position, normal and primary UV0 exactly in both current model qualities. It adds a common qualified pale mineral finish and a continuous dedicated lighting UV; it adds no roof, infill, beam, wall or floor geometry.

The proposed finish is a photographic appearance family. Exact exposed concrete, paint or plaster species, hue, roughness and continued 1935 condition remain unverified. Pale neutral values are rendering calibration, not historical measurements. No travertine veins or invented ornament were added.

Lighting UV1 is a continuous world projection on the actual 56 triangles, intended for 4K at 60.13 pixels per metre. The broad bounds include 846 m² that remains unfilled. Original UV0 and formerly valid light atlas channels are preserved in the ownership records. Their prior difference was a material/light boundary, not proof of a missing roof or invalid UV1.

`pack-retained-soffit-base.mjs` changes only the two declared primitive index accessors. The old BIN, nodes, scene, PBR and texture bindings remain unchanged. Its full/low outputs are pinned externally rather than duplicated in this compact packet. They intentionally omit the old 56 triangles and must receive the new receiver exactly once before use.

`soffit_context_membership.py` removes the matching 56 triangle-polygons from exactly three cached source objects. All retained vertex positions, UVs, normals and material indices remain exact; the other 90,606 object data pointers, transforms and visibility remain unchanged. The separate prepared context includes the accepted four-bay structure, actual platform/track floors once, existing station/city occluders, glass and ten source Exit pendants. It is pinned externally, not copied here.

The scripts are exact copies of those executed. They retain original absolute workspace paths; the manifest maps each copy to its original location. For replay, decompress the JSON records in a separate staging workspace and recreate the original input layout or explicitly change only paths in a new replay copy. The builder refuses to overwrite its candidate directory. Bpy 4.3.0/Python 3.11 and existing repository geometry helpers are used.

No new GI has been baked or approved by this source packet. Integration must retain the prescribed shared UV layout, run the dedicated 4K/128-sample physical bake, validate final raw/encoded/mounted geometry and texture bindings, and inspect the same close-sign view. No arbitrary exposure or brightness gain should replace the physical rebake. User-native walking walkthrough remains skipped.
