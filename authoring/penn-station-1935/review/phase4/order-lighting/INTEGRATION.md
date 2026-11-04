# Dedicated colossal-order lightmap

`model/order_lighting_uv.py` prepares lighting only. All8 authored orders retain their registered geometry, normals, materials and original surface UV channel. This adds no historical evidence or carving detail.

Call the splitter immediately after importing the raw waiting-room primary GLB, before importing neighbours:

```python
from order_lighting_uv import split_waiting_order_objects, prepare_order_uv
order_objects, other_primary_objects, order_audit = split_waiting_order_objects(primary_objects)
primary_objects = list(scene.objects)
primary_set = set(primary_objects)
order_set = set(order_objects)
```

Use membership of `order_set` for the new order bake partition, and exclude those objects from the masonry partition. All nonselected objects remain in light transport. The helper separates whole connected stone components only, inside the eight canonical plinth/shaft/capital envelopes. It excludes long wall and above-order impost components. It does not crop a wall or a carving.

Join only the selected order meshes, apply the existing scale operation, then call:

```python
uv_report = prepare_order_uv(architecture, resolution=4096, margin_pixels=4)
```

This helper creates `BakedLightingUV` itself. Do not create the layer first; do not run `remove_doubles` or another unwrap afterwards. It uses89-degree front/return projection, coherent cylindrical shaft strips, equalized island density, and4px padding. Original UV0 is byte-checked before return. The caller can retain the same sky/AO/material export path. Add `uv_report` and `order_audit` to provenance.

The order atlas needs a corresponding distinct AO texture at its authored resolution. Resizing its AO down to2K halves every measured linear footprint and can reintroduce sub-texel returns. Extra path samples cannot recover unresolved geometry. Validate the mapped actual browser camera before promotion; a successful UV proof alone does not establish the final appearance.
