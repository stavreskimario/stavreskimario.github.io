# Stone/fixture backup checkpoint

This separate outside-only checkpoint retains the current Phase4 vault geometry, AO, materials and all six lighting atlases exactly. It adds the accepted radial-only fixture pair once and reuses the six already-encoded bounded B roughness derivatives. Duplicate Travertine entries keep their distinct masonry/order atlas identity by stable-index plus non-finish-field checks. No texture was re-encoded.

All12 GLBs validate with zero errors and280 format/tangent warnings. The76 unique KTX2 files and actual model/illumination/probe transfer total161,327,896bytes; navigation is separate. Existing geometry/BIN data remains exact; waiting models only append the fixture module with unchanged old geometry/material bindings and exactly unchanged bounds. Concourse floor BINs, all six atlas images/records, navigation manifest and sky/reflection probes remain byte-exact.

The cached-shadow implementation and production bundle hashes are recorded unchanged. No browser/GPU performance or shadow-image test ran for this checkpoint. The corrected roof is explicitly pending; this is a CPU-validated backup while the full fresh vault candidate is prepared. No production assets, dist or canonical scene were written by this assembly. Full outputs/validator logs remain in work/phase5-stone-checkpoint and work/phase5-stone-checkpoint-work.
