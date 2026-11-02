# Phase8 arrivals illumination sources — priority v2

Source illumination staged for review; final transport, encoded assets and browser acceptance remain separate.

The raw bake report is copied byte-for-byte. Its neutral dome has no directional sun baked; runtime sun remains separate. The source model identity and all placed occluder hashes/height offsets remain in that report. Raw AO is unchanged. Both HDR files are losslessly gzip-archived with deterministic headers; decompressed bytes match the original recorded hashes.

The denoised4096×4096 and512×512 PNGs are exact authored derivatives. Denoise radianceScale is2.0, relative mean change is-0.059024772%, full/low clipped RGB samples are0/0, and the linear0.18 transfer control passes. The stored HDR remains linear; PNGs apply the documented sRGB transfer once.

The augmented denoise report identifies the exact Phase8 arrivals authoring directories, raw HDR archive, retained HDR archive and raw bake report SHA. Its radiance statistics and optical values are not edited. `source/` retains the exact frozen bake, material, device and denoise helpers used for this archive. The exact frozen execution packet, original Street0 visibility controls and actual Main0 visibility proof are retained. Actual bake bounds include the documented+4.2672m source-to-Main0 offset; no generic Street0 bounds are substituted. The raw report retains all3.9MB of actual object/UV/normal/AO controls unchanged. The frozen preparation status records describe pre-execution review; the actual output report/log separately demonstrate execution. Reflection capture is unchanged and has separate provenance; no new reflection capture is claimed here.

The large raw model GLB, uncompressed HDRs, duplicate raw preview PNGs and runtime WebPs are not copied into this source archive. Their omission changes no retained HDR/PNG/AO/report bytes. No canonical source or website file is modified by this packaging step.
