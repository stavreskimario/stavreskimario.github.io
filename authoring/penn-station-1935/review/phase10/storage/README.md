# Reversible source-output storage reserve

Three older generated raw AO PNG outputs were moved out of the currently published source tree to reserve space for the new arrivals exit lighting. This does not reduce runtime image quality or change rendering performance. Raw/denoised HDRs, retained lighting PNGs, all runtime KTX2 textures, detailed order AO and input maps remain unchanged.

[Exact recovery receipt](old-raw-ao-output-reserve.json) records every file, SHA256, immutable Git blob at a0aa21afc83fba41e6f0d8b2d269c0becec3e708 and two verified external copies. The three older archive manifests now separate these Git-backed generated outputs from physically retained files. Direct active app/test/script and new frozen-work filename searches found no consumers; the reviewed source checks read HDRs and reports. Some historical full-source replays may require restoring the PNGs first.

Run `python3 restore-old-raw-ao.py` from this folder for exact restoration from local Git history. The helper refuses to overwrite differing files. It restores bytes rather than rebaking. For full historical archive-layout replay, also recover the previous manifests from the immutable commit or their recorded external backups; current manifests retain the archival references honestly.

Only these three PNGs were archived: Phase8 arrivals, Phase9 arcade enclosure and Phase9 platform surfaces raw AO. No older material-finish images were archived in this reserve.
