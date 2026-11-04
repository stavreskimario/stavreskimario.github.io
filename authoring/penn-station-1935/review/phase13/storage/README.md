# Exact lighting source retention

The four-bay structure, detailed floor lighting and physical reflection capture replace the old single-bay sources. Full source masters are retained in the ordinary linear feature-branch history at the exact commits and blobs listed in the two receipts. This keeps the current legacy Pages tree below its 1 GB limit without changing runtime quality or primary evidence. Fresh external backups were verified before the working-tree originals were moved.

Use a full-history clone. To restore current 4K bridge, floor and exit-soffit linear HDRs and the 2K FLOAT32 reflection EXR, run `python3 authoring/penn-station-1935/review/phase13/storage/restore-current-enclosure-hdrs.py --repository .`. The helper verifies commit/path membership, compressed and decoded bytes, HDR dimensions and EXR channel precision before writing. It refuses to overwrite different content. The asset validator reads these exact Git archives automatically if the local masters are absent.

For replay of the superseded single bay, run the adjacent `restore-phase12-source.py --repository .` first. Historical reports remain unchanged. Current editable four-bay Blender geometry, material textures, PNG derivatives and executed source helpers stay in the tree.

The two generated floor-transition PNGs are also pinned in `derived-floor-png-archives.json` and restored by `restore-derived-floor-pngs.py --repository .`. Their complete RGB pixels remain present in the runtime lossless WebPs. The validator independently replays every pixel and deterministically re-encodes the exact original PNG hashes even with those redundant PNG files absent. Original physical denoise PNGs stay in the current tree.
