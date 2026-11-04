# Departure-access illumination

This directory retains only the new departure-stair module's neutral-dome illumination. Existing room illumination and static reflection probes are unchanged. The waiting-room ceiling and exterior roof flicker fixes are outside this checkpoint.

The module uses the concourse Main=0 frame, with the retained concourse and exterior geometry as registered occluders. The exterior has a +4.2672 m offset into that frame. Cycles 4.3 Metal baked 2048 px at 64 path samples; the source and occluder hashes are recorded in `raw/lighting-concourse-access.json`.

`raw/` contains the exact bake report and lossless gzip source HDR. `denoised/` contains the linear denoised HDR archive, 2048/512 PNG derivatives and the denoise report. Runtime lossless WebP images are checked against those PNG pixels. The validator also checks both decoded HDR hashes, the exact raw/runtime bake JSON, the linear 0.18 transfer control, dimensions and positive finite radiance.

Bake with `model/bake_lighting.py --zone concourse --artifact-name concourse-access` and explicit registered occluders. The artifact name prevents replacing the existing concourse atlas. The [departure source record](../../review/phase6/departure-access/README.md) preserves source reconstruction and acceptance limits.
