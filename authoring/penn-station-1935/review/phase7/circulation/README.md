# Phase 7 circulation source archive

This compact archive records the accepted 176-leg/two-bay/rear-guard source candidate. It does not itself promote the canonical Blender scene, runtime assets or deployment. See the [circulation evidence](../../../../../penn-station-1935/model/circulation-evidence.md), [adapted research note](research.md) and [source history](source-history.json).

- `source-proof.json.gz` preserves the exact accepted proof bytes, uncompressed SHA256 `a7214793534d9700e1124c0b8cc6f97fd85fead6e313b7607e8d241dc85ad8b4`.
- `component-census.json.gz` identifies the 176 repaired legs, two original wall cells and 16 explicitly deferred original legs. The four close secondary-pier centres remain unchanged.
- `raw-review.json` checks actual GLB geometry, including zero new inter-pier overlaps and the rejected four-overlap control. All 91 wall/rear-guard primitives remain exact between candidates.
- `independent-historical-scope-v2.json` distinguishes primary support from inferred dimensions. The removed cell height is 3.8 m; measured midpoint clearance under retained moulding is approximately 3.65 m.
- `optimized-native-route-cpu.json.gz` is an independent actual-geometry route receipt, not a browser or deployment claim.
- `rejected-v1.json` and its actual overlap report preserve the rejected 192-leg scope. `rejected-transform-roundtrip.json.gz` retains the exact 36-font Euler/basis/world changes that caused the first exporter to fail preservation. Copy-only export resolves that failure without relaxing the guard.
- `rejected-alias-only-normalization.json` records the earlier exact material-alias correction. The accepted generator emits exact aliases and removes its temporary owned materials before saving.
- `cli-replay-proof.json` proves all four raw GLBs were reproduced byte-for-byte by the new public CLI. `original-hashes.json` records stored and uncompressed identities.

The prior scene is verified in immutable Git and persistent external backup. The selected review scene hash is `f2e5a0e382b5d6771030055ed527546005cd18d2a3e2d77f204d570c0a9cc588`. Parent-owned source/runtime promotion and final mapped-browser checks are separate from these source receipts.

No raw GLBs, duplicate Blender scenes or historical rasters are copied here. Full evidence remains under `/Users/stavreskimario/Desktop/penn-station-work/phase7-circulation`. The original source hashes and mechanical crop metadata remain in [research-sources.json](research-sources.json). Arrivals and the unresolved paired minor joints are not claimed complete.
