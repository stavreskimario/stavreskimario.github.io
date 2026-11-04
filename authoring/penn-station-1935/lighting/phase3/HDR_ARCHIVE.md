# Superseded Phase 3 HDR archive

The eight old raw/denoised illumination HDR gzip payloads remain byte-exact in [the immutable Phase 4 publication commit](https://github.com/stavreskimario/stavreskimario.github.io/tree/60563ab11c1d83c9b21badcd7fbd7b21efa66473/authoring/penn-station-1935/lighting/phase3). They are removed only from the current public tree to leave room for the newer source and lighting within GitHub Pages' site-size limit. Most Phase3 PNGs, AO, records and denoising reports remain here; they describe that older release.

[The archive receipt](../../review/phase5/storage/archived-phase3-hdr.json) records each path, compressed-byte SHA256, immutable Git blob, length and independently verified persistent local backup. Git history and that backup were checked before changing the current tree. No runtime asset, active source scene or original CC0 material is removed by this archive step.

Two superseded generated denoised PNGs, `denoised/lighting-concourse-sky.png` and `denoised/lighting-waiting-room-sky.png`, are additionally archived after Phase11 source promotion. Their exact immutable Git/external identities and restore helper are in the [Phase11 storage receipt](../../review/phase11/storage/superseded-lighting-outputs.json). Current runtime provenance uses later sources; no material/input map or runtime texture was removed.
