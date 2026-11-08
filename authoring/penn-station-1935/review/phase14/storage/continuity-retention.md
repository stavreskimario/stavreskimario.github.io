# Five-bay physical lighting sources

All four4K linear lighting masters and the2K Float32RGBA reflection master are retained exactly in ordinary feature-branch history at008c9d0b7d878ffbe35e12be1cbf5538401658b3. Compressed and decoded hashes, HDR dimensions, EXR channel precision and exact commit/path/blob membership are pinned in current-continuity-hdr-archives.json. Fresh independent backups were verified before originals moved. No runtime PNG/WebP/KTX, source resolution, material or optical value was reduced.

Restore from a full-history clone with `python3 authoring/penn-station-1935/review/phase14/storage/restore-current-continuity-hdrs.py --repository .`. The helper verifies all five files before writing and refuses to overwrite different content. The full asset validator has passed with the masters absent, exercising actual Git recovery, original source statistics, Float32/256-to255 RGBE checks and independent every-pixel floor delivery replay.
