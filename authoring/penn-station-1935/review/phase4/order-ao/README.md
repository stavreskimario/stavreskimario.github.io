# Dedicated carved-order AO resolution

The general desktop pipeline resizes PBR images to 2K. Capitals and pilasters have a separate, more tightly packed 4K AO atlas. `preserve-order-ao.mjs` restores that original atlas immediately after the general resize and before scalar preparation/UASTC. It selects only materials whose `extras.sky_illumination` is exactly `lighting-waiting-room-order-sky.png`. The existing 512-pixel fallback is unchanged.

`controls.json` records a real CLI resize followed by restoration of the original 4096 × 4096 PNG bytes. Two order materials retain one shared image; image/texture counts and indices do not grow. All other image bytes, geometry, normals, UVs, samplers, material factors, node data and resource bindings remain exact. The unrelated colour map remains 2K and the constant normal remains intact.

Repeat and unmarked inputs pass through verbatim. `pre-uastc-scalar-proof.json` also verifies that the subsequent scalar-preparation stage retains this canonical 4K atlas and the entire fixture byte for byte. A 2K input cannot stand in for the original atlas, and an image also used for colour is rejected.

`actual-order-preservation.json` independently checks the real three-atlas waiting-room source (`9709a4a9…`) through restoration and scalar preparation. Its two carved-order material bindings retain one original 4096 × 4096 PNG, SHA-256 `b04788368a002cabc964a2ea153dbf7e69e20cddb3a1ef294e9e67dd7c0e44bf`. The image count stays 13; every other image is at most 2K. `actual-restoration-proof.json` verifies all 28 other binary views and complete JSON resource bindings; `actual-pre-uastc-scalar-proof.json` confirms the following scalar stage is verbatim. These are pre-UASTC checks; final visual quality, codec quality and delivery size belong to their own reports.

`actual-order-codec.json` decodes the existing UASTC output without re-encoding it. The AO remains 4096 × 4096. Against the original 8-bit red scalar, mean absolute error is 0.225/255, the 99th percentile is 3/255 and maximum is 16/255. This is a codec measurement for the recorded candidate, not approval of its capital-leaf geometry or the later shell repair.
