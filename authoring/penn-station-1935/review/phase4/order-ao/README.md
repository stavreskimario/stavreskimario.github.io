# Dedicated carved-order AO resolution

The general desktop pipeline resizes PBR images to 2K. Capitals and pilasters have a separate, more tightly packed 4K AO atlas. `preserve-order-ao.mjs` restores that original atlas immediately after the general resize and before scalar preparation/UASTC. It selects only materials whose `extras.sky_illumination` is exactly `lighting-waiting-room-order-sky.png`. The existing 512-pixel fallback is unchanged.

`controls.json` records a real CLI resize followed by restoration of the original 4096 × 4096 PNG bytes. Two order materials retain one shared image; image/texture counts and indices do not grow. All other image bytes, geometry, normals, UVs, samplers, material factors, node data and resource bindings remain exact. The unrelated colour map remains 2K and the constant normal remains intact.

Repeat and unmarked inputs pass through verbatim. `pre-uastc-scalar-proof.json` also verifies that the subsequent scalar-preparation stage retains this canonical 4K atlas and the entire fixture byte for byte. A 2K input cannot stand in for the original atlas, and an image also used for colour is rejected. The helper's runtime proof will record the actual architectural source separately; these fixture results do not establish final visual quality or delivery size.
