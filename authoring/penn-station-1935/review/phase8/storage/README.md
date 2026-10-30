# Recoverable Phase4 raw lighting sources

Three large **current raw source inputs** are archived outside the current published tree to make room for the arrivals build. They are not obsolete atlases. All active denoised HDRs, full/fallback PNGs, AO maps, bake reports, runtime textures and model files are retained.

[The recovery receipt](phase4-raw-source-archive.json) records compressed and decoded SHA256 identities, exact immutable Git objects and verified persistent backups for102,088,771bytes. The decoded hashes still match the active denoise records' `sourceSha256`. Existing `../originals/` source references describe their original authoring paths; use this receipt to recover those three inputs before reproducing their denoising runs.

Recover a compressed source outside the published tree using its exact `gitBlob`, then verify both hashes against the receipt. For example, from the repository root:

```sh
git cat-file blob f8dc15c0e1649a965e0932c8df46a3f253c1cec2 > /private/tmp/lighting-waiting-room-vault-sky.hdr.gz
```

The same bytes are also reachable through each receipt entry's immutable source link. Restore only the inputs needed for the authoring job; placing every archive back in the published tree consumes its hosting allowance. This archival changes no runtime payload or lighting appearance.
