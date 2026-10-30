# Appearance revision4: interpreted stone finish

These eight PNGs are deterministic derivatives of the committed ambientCG CC0 source maps. The original nine source files are unchanged and hash-verified by `surface-finish.json`. They are modern material references; the chosen palette and contrast are not measured colours from the demolished station.

The transformation normalizes colour channels in **linear RGB**, reduces their variation about the original means, applies the stated target palette, and encodes sRGB once. The512px variants are resized in linear light. The report includes source/derivative hashes, clipping, exact KTX4.4.2 encoding, decoded UASTC means and encoding error. Milford's brightest grain samples clip in approximately0.09% of RGB samples; the other profiles do not clip before encoding. KTX encoding is lossy and its separate measured error is retained.

`prepare_surface_library.py` recreates the images and compressed maps in a review directory; `apply_surface_finish.mjs` changes only selected material colour references and normal strengths in existing Meshopt GLBs. It preserves base-colour factors and records their products with actual decoded map means. Architectural UV revision3, grain scale, geometry BIN data, AO, roughness, metal, original normal-map pixels, lightmaps and reflection captures remain unchanged. Source material normal-strength settings are separately updated in `material_library.py` for future authoring.

The existing Phase3 indirect illumination and static probes are retained. Revised albedo would affect some secondary bounce light in a fresh physical solution; that effect has **not** been rebaked by this narrow recovery checkpoint. The isolated browser material comparison is in `review/phase4/material-finish/`, separate from final integrated navigation/asset testing. It does not recover the lost split-atlas bakes, finer concourse architecture or reflection captures.

Example regeneration from the repository root, with a local pinned KTX tools directory:

```sh
uv run --no-project --python 3.11 --with 'numpy<2' --with pillow==13.0.0 python penn-station-1935/model/prepare_surface_library.py --source authoring/penn-station-1935/materials --provenance penn-station-1935/material-provenance.json --out REVIEW_MATERIAL_DIRECTORY --ktx-bin KTX_TOOLS_DIRECTORY
PENN_TOOLS=PINNED_NODE_TOOLS node penn-station-1935/model/apply_surface_finish.mjs --input REVIEW_RUNTIME_DIRECTORY --out REVIEW_FINISHED_RUNTIME_DIRECTORY --library REVIEW_MATERIAL_DIRECTORY
```

`PINNED_NODE_TOOLS` is the folder containing the project's pinned `node_modules`. KTX tools are extracted official Khronos KTX-Software4.4.2 binaries, with their matching library available beside them. Review results before promotion; these commands do not publish or overwrite source assets.
