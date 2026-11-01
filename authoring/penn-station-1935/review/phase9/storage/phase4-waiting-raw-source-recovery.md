# Current waiting-room raw source recovery

Three current Phase4 raw lighting inputs are archived reversibly for the Arcade delivery: vault AO PNG, masonry AO PNG and masonry raw sky HDR.gz. They are **current source provenance**, not obsolete maps. The [exact recovery receipt](phase4-waiting-raw-source-archive.json) records42,644,086bytes, original SHA256/size, immutable96641fd Git commit/blob and independently verified persistent backups outside the published tree.

Current runtime models/textures, all retained filtered/denoised HDRs and full/low PNG/WebP derivatives, bake reports and the **order AO source** remain present. Active asset/denoise checks consume these retained derivatives and metadata; the order source stays available for actual mapped-AO sampling. Historical authoring scripts may require a raw source: recover its exact bytes before reproducing that job. Earlier Phase4/Phase8 notes describe the prior archival state; this receipt records these three additional inputs without rewriting those records.

Recover only the needed source outside the published tree. For example, from the repository root:

```sh
git cat-file blob 960a0c8b8f146ccb3256416641527f1e19813588 > /private/tmp/lighting-waiting-room-vault-ao.png
```

Verify the recovered file's size and SHA256 against the matching receipt entry before using it. `git show IMMUTABLE_COMMIT:ORIGINAL_PATH` gives the same bytes. Each entry also links to its immutable public GitHub object and names the verified persistent backup. Copy a verified recovery to its original authoring path when that specific job needs it; restoring all archives into the published tree consumes the hosting allowance.

The masonry raw HDR's decoded SHA256 still equals the active denoise record's sourceSha256. This source archival changes no delivered geometry, materials, AO quality or lighting appearance. The root-size estimate in the receipt is a checkpoint measurement before any further Arcade delivery files.
