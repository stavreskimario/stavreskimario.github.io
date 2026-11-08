# Accepted canonical source promotion

The bounded first-eight arrivals source was accepted after the parent inspected the native browser gallery. The verified candidate was copied atomically to the existing canonical filename. **Final native route checks, runtime promotion and publication remain separate parent-owned gates.** No commit or push was performed by this task.

| Version | SHA256 | Bytes |
| --- | --- | ---: |
| Previous canonical | `f2e5a0e382b5d6771030055ed527546005cd18d2a3e2d77f204d570c0a9cc588` | 72,399,076 |
| Accepted canonical | `c96fb37215d4ebfc7bbbba9154fe7f96a8daf8500e9c61778136e286c4a03739` | 75,486,342 |

The repository-relative canonical remains `authoring/penn-station-1935/penn-station-phase5.blend`; editor links are preserved. The increase is 3,087,266 bytes. Its computed Git blob SHA1 is `82edecce76e4711d979f874640314ee801377ea3`; this is not a claim that a new source commit has already been created.

## Recover the previous source

The old bytes were independently verified against external work backup `before-local-overlay/penn-station-phase5.blend` and immutable commit `f53091b456a5aed99150914b696771c5865c48b9`, blob `b8e0a50e5886b0b60943ad659e5d1426f3653220`. Run the following from the repository root to extract a separate copy. Exclusive creation refuses to overwrite an existing file:

```sh
python - <<'PY'
from pathlib import Path
import hashlib
import subprocess

ref = "f53091b456a5aed99150914b696771c5865c48b9:authoring/penn-station-1935/penn-station-phase5.blend"
data = subprocess.check_output(["git", "show", ref])
assert hashlib.sha256(data).hexdigest() == "f2e5a0e382b5d6771030055ed527546005cd18d2a3e2d77f204d570c0a9cc588"
output = Path("../penn-station-work/phase7-arrivals/recovered-source-f2e5.blend")
with output.open("xb") as file:
    file.write(data)
PY
```

This recovers the source file only. It does not roll back the application's meshes, lighting, manifest or fixture transforms. For a complete rollback, use a consistent reviewed application checkpoint.

## Reproduce the new architecture

With pinned Blender 4.3.0 and NumPy below 2 in Python, run from the repository root:

```sh
python penn-station-1935/model/repair_arrivals_access.py \
  --source ../penn-station-work/phase7-arrivals/recovered-source-f2e5.blend \
  --out ../penn-station-work/phase7-arrivals/replayed-arrivals-source
```

The external output directory must not exist. The CLI's pinned inputs are in `sourceinputs/`. Its verified replay, [cli-replay-proof.json](cli-replay-proof.json), reproduces the old-owned, new-module and retained/protected raw GLBs byte for byte, with exact fixture groups/parts/models and structural records. The replay Blender container hash is `5a0ba9c38ef7605faf7076e43756f46c6dcc9e9b44234a0ad152bc0e8b5c99dc`; path/container metadata differs. The accepted canonical is the exact frozen `c96f…` container, not a claim of byte identity with that replay container.

The core scene contains the new Exit architecture. The separate railway fixture source remains linked through [the frozen fixture recipe](frozen-candidate-fixture-relocation-recipe.json), SHA256 `4e3b6005e3d7364b0a7d1dd41004e159218d9559d31b97dd9aa3dc548a4e1525`, moving complete groups 0–15 and retaining 16–21. Do not describe the core Blender file alone as containing the relocated railway asset.

All earlier archive payloads and hashes remain unchanged. [canonical-history.json](canonical-history.json) records byte checks, the immutable old source, source/replay links and the approval scope. The archive manifest only adds these two history records. After an actual reviewed source commit, record its new immutable commit/blob separately; do not invent that future reference.
