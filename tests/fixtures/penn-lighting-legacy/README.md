# Legacy lighting records

These eight JSON files are the four exact bake/denoise pairs from maintenance commit `b86a59177e65461f5eb71c0593cab5b53fd4e5f6`. `manifest.json` records their Git blob identities and SHA-256 hashes, plus the exact retained source-PNG identities from that same commit. No texture is copied into this fixture directory.

`tests/penn-denoise-records.cjs` regenerates temporary lossless WebP derivatives from the retained Phase 3 PNGs and validates them against these original records and retained HDR source archives. This keeps the schema-1 compatibility controls reproducible after schema-3 runtime promotion. The regenerated derivatives are source-pixel controls, not the original runtime WebP files. Earlier actual delivered-asset proof remains separate; this focused suite does not accept final architecture, lighting or browser output.
