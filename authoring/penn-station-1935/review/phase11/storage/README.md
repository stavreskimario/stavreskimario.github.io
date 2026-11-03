# Phase11 historical lighting-output storage reserve

Exactly four superseded generated outputs totaling67,618,527bytes were archived after the current runtime provenance selected the fresh Phase11 source roots. superseded-lighting-outputs.json pins original bytes/SHA, immutable Git blobs, fresh external copies and moved originals. Current Phase11 sources, current source PNGs, runtime textures, all material/input maps and canonical core remain retained. The later gallery QA reserve remains held.

restore-superseded-lighting.py restores the four exact old files from local immutable Git, with an explicit repository argument. It uses exclusive writes and refuses differing existing files. Syntax was checked; it was not executed against root. This restores historical bytes rather than rebaking. The old generated-output-archive.json manifests distinguish retained and archived files; earlier frozen acceptance/copy inventories describe their original checkpoints.

The current8192px vault linear HDR is separately retained as exact immutable Git-backed source, with its current PNG/WebP and reports unchanged. current-vault-hdr-archive.json supplies the single allowlisted archive identity to the active validator; restore-current-vault-hdr.py restores its exact historical path when explicitly run. This is current source retention, not a superseded-output classification.
