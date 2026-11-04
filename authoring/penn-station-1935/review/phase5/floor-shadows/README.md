# Floor and shadow source checkpoint

The reported Train Concourse gray/white floor patches are reproduced independently of shadows: upward rays hit both marble and circulation concrete at exactly the same height. Hiding concrete in a diagnostic control removes the jagged patch; that visibility toggle is evidence, not the delivered repair.

The Blender repair partitions the concrete's existing occupied top footprint at the existing axial/subsidiary marble extents, retaining concrete below the 200/220mm finish bedding. It adds no floor extension, stair-hole filler, visual depth offset or navigation plane. The original attempted Boolean route was rejected because it removed disconnected cells; the accepted partition path checks occupied area, outer bounds and all 5,104 unrelated objects. The small coordinate snap and actual errors are recorded rather than claiming exact surveyed dimensions.

The decoded pre-repair desktop/fallback models have 52 competing samples out of 78 per variant. The isolated repaired models have zero at the same samples. Offline merge preserves all existing BIN bytes, nodes, material records and compressed views, replacing only the circulation-concrete primitive with a texture-free Blender module. Browser movement and final production acceptance remain pending at this source checkpoint.

A separate r180 shadow defect is also proven: lazy depth-convention setup occurs after the first shadow matrix/frustum is built. Static caching retains the mismatch. The helper now primes the supported convention before that calculation; the bias helper also converts forward-depth bias for the supported reversed comparison, leaving world-space normal bias and native WebGPU alone. The tiny forward/reversed control and CPU lifecycle, resize, fallback and bias controls are retained. These controls do not alone prove the motion artifact repaired.

The older `penn-stair-geometry.mjs` material-filtered check fails identically before and after this repair (960 unsupported samples per variant) because it omits the now-authoritative circulation-concrete material. This is a stale test limitation; it is not counted as a passing check or hidden. A complete updated floor/step geometry check and real walking acceptance must precede promotion.

Current runtime assets and the built bundle are unchanged in this source checkpoint. The final iteration will package the validated floor, stone finish, ceiling and photographed bracket changes together, with a new runtime identity and separate publication receipt.
