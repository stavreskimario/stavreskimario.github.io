# Proposed recovery of unreferenced runtime textures

This is an exact **8-file / 7,202,466-byte archival proposal**, tied to source commit `89035a4f09fcf43046c3651d6473de20f270e299`. No root file has been removed. Root must review and approve this exact list before mutation.

The inventory reads **every image-array entry** in all 12 current full/fallback GLBs, including entries unused by material slots. All 182 entries resolve to 89 distinct KTX2 files; all 89 files (119,551,559 bytes) and all 12 compressed/decoded model identities are pinned. The current 22ec9 travertine, b4a5 marble and 1e3f granite normal maps remain explicitly protected. All 97 existing KTX2 files are tracked; only the eight absent from the complete current image-array union are proposed below.

| Exact filename under `penn-station-1935/assets/textures/` | Bytes |
| --- | ---: |
| `363923bafe6efcb2994c.ktx2` | 1,731,155 |
| `57b74bfd6c788b7c2da2.ktx2` | 2,357,761 |
| `623a245c87b996572e77.ktx2` | 164,478 |
| `801a4f1dcf698acb12ca.ktx2` | 163,319 |
| `c8ffb212f6d77c7a9102.ktx2` | 173,916 |
| `cd6d4e919eb581296aa1.ktx2` | 2,203,123 |
| `e3a546949c1022529068.ktx2` | 217,523 |
| `f4f79aec04acf833312f.ktx2` | 191,191 |

[Exact proposal](unused-runtime-ktx-proposal.json) gives full paths, SHA256/Git blob identities and verified external backup paths. The lossless full inventory is `unused-runtime-ktx-plan.json.gz`. Every model, referenced texture and proposed file was compared byte-for-byte with its immutable source-commit Git blob. All eight backup copies are also byte-exact. The plan protects the existing material-provenance and asset-metrics files; no model, array, PBR value, normal quality, source/canonical or historical receipt is rewritten.

No current executable/HTML lookup names these eight files. Historical phase/publication/staging receipts and the earlier stone-normal provenance still name superseded encodings; those records remain unchanged and their files recover through exact Git or external backup identities. `unused-runtime-ktx-usage.json.gz` preserves the searches and matching historical paths. The current referenced texture count remains 89 and aggregate model/texture/light/probe bytes remain 219,408,187. Removing files that are not requested recovers source/public-artifact storage; it is **not an FPS or current rendering-quality improvement**.

## Read-only guard before any approved archival

The helper never deletes. Immediately before an approved removal, verify the current 12 model hashes, every image slot, all 89 protected texture hashes, protected metadata and all eight proposed-file hashes:

```sh
PYTHONDONTWRITEBYTECODE=1 python runtime_texture_archive.py verify --manifest unused-runtime-ktx-plan.json.gz --repo /path/to/checkout
```

A changed model or image array requires a fresh inventory, not permission to reuse this list. After the exact approved archival, the same command with `--after` verifies that all 89 protected files and all 12models remain exact and all eight archived paths are absent. Root retains full asset validation and site/staging checks as separate delivery gates.

## Exact external recovery

Choose a new external output directory. The helper verifies all bytes before creating output and refuses to overwrite an existing destination. Either source is sufficient:

```sh
PYTHONDONTWRITEBYTECODE=1 python runtime_texture_archive.py recover --manifest unused-runtime-ktx-plan.json.gz --git-repo /path/to/checkout --out /tmp/ktx-git-recovery-unique
PYTHONDONTWRITEBYTECODE=1 python runtime_texture_archive.py recover --manifest unused-runtime-ktx-plan.json.gz --backup /path/to/unused-runtime-ktx-v1/backups --out /tmp/ktx-backup-recovery-unique
```

Git recovery reads the exact pinned commit and relative paths without changing refs. Backup recovery uses the same repository-relative path structure. Both actual 8-file recovery methods pass. Seven additional negative controls reject changed model/protected-image pins, altered image slots, a referenced proposed URI, corrupted recovery bytes/pins, path escape and false after-archival acceptance. Their [retained report](unused-runtime-ktx-controls.json) records all nine controls. No root deletion or quality change was performed during this preparation.
