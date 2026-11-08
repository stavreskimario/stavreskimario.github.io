# Phase9 connected arcade illumination sources

Source illumination staged for review; final transport, encoded assets and browser acceptance remain separate.

The raw bake report is copied byte-for-byte. Its neutral dome has no directional sun baked; runtime sun remains separate. The source model identity and all placed occluder hashes/height offsets remain in that report. Raw AO is unchanged. Both HDR files are losslessly gzip-archived with deterministic headers; decompressed bytes match the original recorded hashes.

The denoised4096×4096 and512×512 PNGs are exact authored derivatives. Denoise radianceScale is2.0, relative mean change is+0.260627146%, full/low clipped RGB samples are0/0, and the linear0.18 transfer control passes. The stored HDR remains linear; PNGs apply the documented sRGB transfer once.

The augmented denoise report identifies the exact Phase9 authoring directories, raw HDR archive, retained HDR archive and raw bake report SHA. Its radiance statistics and optical values are not edited. `source/` retains the exact frozen bake, material, device and denoise helpers used for this archive. Reflection capture has its own separate source/report archive; no reflection acceptance is claimed here.

The large raw model GLB, uncompressed HDRs, duplicate raw preview PNGs and runtime WebPs are not copied into this source archive. Their omission changes no retained HDR/PNG/AO/report bytes. No canonical source or website file is modified by this packaging step.
