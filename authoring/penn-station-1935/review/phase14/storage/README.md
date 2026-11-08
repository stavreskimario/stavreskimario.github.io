# Current arrivals lighting source retention

The two current Phase8 arrivals HDR archives (71,875,735 bytes) remain in ordinary feature-branch history at commit341bb59f58a4226e1010e5b1a5b4b6d5d3e85145. The exact receipt records commit/path/blob membership, compressed and decoded SHA256 and4096px dimensions. Fresh external copies and the moved originals are byte-exact. Runtime PNG/WebP/KTX files, material quality, geometry and original lighting statistics remain unchanged.

Restore from a full-history clone with `python3 authoring/penn-station-1935/review/phase14/storage/restore-current-arrivals-hdrs.py --repository .`. It refuses to overwrite differing content. The source reader uses only the two exact allowlisted paths and verifies all Git membership/byte hashes.

After activation, full validation passed for all12GLBs/117sharedKTXtextures, including actual missing-master Git recovery, original HDR statistics and every-pixel floor delivery replay. All15focused denoise controls also passed. This source-storage checkpoint frees space for the next detailed enclosure and arcade work; it changes no rendered asset.
