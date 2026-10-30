# Phase 4 lighting source archive

Six authored illumination atlases use 8192px for the waiting-room vault, 4096px for masonry and colossal order, and 2048px for exterior, concourse and platform. The order uses 512 Metal Cycles samples; other atlases use 128. All use six diffuse bounces. Desktop order AO remains 4096px. Each record retains actual source hashes, UV coverage, device and timing. Directional sun stays dynamic.

Original and denoised HDR bytes are losslessly gzip archived. Decompress with Python gzip or a standard archive utility; decoded SHA256 receipts preserve exact original bytes. Final PNGs are the pixel sources for lossless runtime WebP. Low derivatives remain 512px. No HDR is a historical photograph or calibrated1935 exposure.

The vault, detailed-order and concourse **raw inputs** are now recoverable through [the Phase8 archival receipt](../../review/phase8/storage/). These remain current source provenance, with exact immutable Git objects and verified backups; they are not obsolete maps. Their original `../originals/` references and decoded `sourceSha256` values remain in the denoise records. Restore those inputs before reproducing the corresponding denoising jobs. All current denoised HDRs/PNGs, original AO maps and bake JSON reports remain here.

Source snapshots preserve development history. The final delivery-records.json identifies all six repaired-leaf runs, including the broad revision3 prism court and recorded architecture/railway/context inputs. Canonical lighting helpers are retained in source/lighting-order-source; earlier source snapshots are development evidence. Raw GLBs are not duplicated here; editable architecture is in the current Phase5 Blender scene.

Mapped browser acceptance and transfer measurements are recorded separately in the release validation report.
