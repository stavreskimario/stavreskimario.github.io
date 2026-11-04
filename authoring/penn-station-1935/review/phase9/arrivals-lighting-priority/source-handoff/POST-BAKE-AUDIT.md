# Raw acceptance and remaining gates

The actual V2 raw acceptance passes; use `proofs/actual-v2-raw-acceptance-v2.json` as the final measured receipt. The earlier similarly named receipt predates a stronger finite-UV/scene-membership assertion; both passed, but V2is the current checker result.

Recheck raw acceptance using explicit paths:

    uv run --offline --no-project --python 3.11 --with 'numpy<2' --with pillow==13.0.0 python source/lighting_uv/audit_arrivals_rebake.py --original /path/to/f346.glb --priority-input /path/to/85bf.glb --new /path/to/fresh.glb --report /path/to/lighting-concourse-arrivals.json --fresh-ao /path/to/lighting-concourse-arrivals-ao.png --out ./fresh-raw-acceptance.json

1. Preserve the completed raw model/HDR/AO/report and all frozen inputs before compression. Fresh AO must be the actual exported red-channel image in all4slots; an existing old settings group must never win.
2. Denoise linear radiance with the established transfer/grey controls; confirm mean radiance changes and clipping bounds. The correct illumination scale comes from the new report and must not inherit the old atlas scale4silently.
3. Optimize only the ARRmodule. Verify source albedo, normal and MR bytes/roles through resizing and compression, normal image variation and scalar.035, KTX2orientation and runtime texture channel semantics. Follow the actual occlusion texCoord after optimization; it may be renumbered.
4. Append to the exactd06fb5fb…optimized retained base. Require its complete BINprefix and existing JSON bindings exact, and disallow added materials outside the original7ARRnames. Preserve all other zone models byte-for-byte relative to the parent checkpoint.
5. Review a tread/landing close-up, stair riser, gallery top and upper contact at the same native browser exposure/light/quality. Check island-edge smearing, lighting inversions, contact stability, blurry stone and no residual staleAO.256samples does not replace spatial atlas density or mapped visual review.
6. Re-run the accepted encoded walking routes up/down every ordinary arrival stair pair and platform detours, then native performance and actual deployment. This lighting-only patch does not alter architecture, collision routes or historical qualifications.

This package does not certify an exhaustive island overlap/gutter proof, runtime graphics, complete first-eight enclosure or a finished1:1historical replica. Those remain explicit parent/future checks.
