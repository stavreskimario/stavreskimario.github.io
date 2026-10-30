# Historical source storage

The eight superseded Phase3 raw lighting PNGs in `archived-phase3-raw-png.json` are preserved byte-for-byte in immutable Git history and in a verified backup outside the public checkout. Their working-tree copies were archived to keep the complete site below1GB. Active Phase4/Phase6 sources, raw bake JSON/HDR records and all denoised PNGs used by current or legacy validation remain present.

Recover a file from its immutable commit link or run `git cat-file blob <gitBlob> > /chosen/recovery/file.png` from this repository. Compare its byte count and SHA256 against the receipt before use. Each receipt entry also gives its location relative to the persistent work folder. No image was resized, recompressed or regenerated.
