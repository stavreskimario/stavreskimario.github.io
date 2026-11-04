"""Prepare explicit, bounded stone roughness interpretations from CC0 grain.

The input images are read as linear Non-Color data. Their unusually low
roughness values are retained in the measurement report, not mistaken for a
calibrated Penn Station finish. These derivatives preserve their spatial grain
while mapping the robust 1st–99th percentile interval to declared candidate
ranges. They are appearance studies, not recovered historical measurements.
Use roughnessFactor=1 when binding a derivative; do not multiply it again.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


PROFILES = {
    "InteriorGranite-A": ("Granite005A", .18, .32, .50),
    "InteriorGranite-B": ("Granite005A", .30, .48, .50),
    "MilfordGranite-A": ("Granite005A", .45, .65, .88),
    "MilfordGranite-B": ("Granite005A", .55, .78, .88),
    "Travertine-A": ("Travertine009", .45, .65, .95),
    "Travertine-B": ("Travertine009", .60, .78, .95),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def statistics(values):
    return {"mean": float(values.mean()), "minimum": float(values.min()),
            "maximum": float(values.max()), "standardDeviation": float(values.std()),
            "percentiles": {str(p): float(np.percentile(values, p))
                            for p in [0, 1, 5, 50, 95, 99, 100]}}


def prepare(library, out):
    out.mkdir(parents=True, exist_ok=True)
    report = {"schemaVersion": 1, "method": "Linear Non-Color; clip robust p1/p99 then affine candidate range; round to nearest 8-bit value",
              "qualification": "CC0 grain reused for a bounded finish interpretation; no calibrated historic roughness samples",
              "roughnessFactor": 1, "geometryNormalsUV0AndColourChanged": False,
              "generatorSha256": sha(Path(__file__)), "sources": {}, "candidates": []}
    originals = {}
    for identity in ["Granite005A", "Travertine009", "Marble018"]:
        source = library / identity / f"{identity}_2K-JPG_Roughness.jpg"
        values = np.asarray(Image.open(source).convert("L"), dtype=np.float64) / 255
        originals[identity] = values
        report["sources"][identity] = {"file": str(source), "sha256": sha(source),
                                         "transfer": "Non-Color / linear scalar", **statistics(values)}
    for name, (identity, low, high, old_factor) in PROFILES.items():
        source = originals[identity]
        p1, p99 = np.percentile(source, [1, 99])
        if p99 <= p1:
            raise ValueError("Input roughness image has no usable variation")
        values = low + np.clip((source - p1) / (p99 - p1), 0, 1) * (high - low)
        encoded = np.rint(values * 255).astype(np.uint8)
        full = out / f"{name}-roughness.png"
        Image.fromarray(encoded, "L").save(full, optimize=True)
        low_path = out / f"{name}-roughness-low.png"
        Image.fromarray(encoded, "L").resize((512, 512), Image.Resampling.LANCZOS).save(low_path, optimize=True)
        decoded = np.asarray(Image.open(full), dtype=np.float64) / 255
        assert decoded.min() >= low - .5 / 255 and decoded.max() <= high + .5 / 255
        report["candidates"].append({"materialProfile": name, "source": identity,
            "range": [low, high], "inputClipPercentiles": [float(p1), float(p99)],
            "previousRoughnessFactor": old_factor,
            "previousEffectiveMean": float(source.mean() * old_factor),
            "roughnessFactor": 1, "full": {"file": full.name, "sha256": sha(full),
                "dimensions": [encoded.shape[1], encoded.shape[0]], **statistics(decoded)},
            "low": {"file": low_path.name, "sha256": sha(low_path), "dimensions": [512, 512]}})
    (out / "finish-roughness-report.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = prepare(args.library, args.out)
    print(json.dumps({"out": str(args.out), "candidates": len(result["candidates"])}))
