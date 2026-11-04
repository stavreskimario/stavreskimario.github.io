"""Create reproducible, explicitly interpreted stone-colour derivatives.

This changes albedo and glTF normal strength only. It does not recover historic
colour, create carved detail, change UV scale, or rebake indirect illumination.
Run through uv with numpy<2 and pillow==13.0.0. Outputs stay in --out until review.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image


PROFILES = {
    "MilfordFine": {"source": "Granite005A", "targetSrgb": [.76, .70, .66], "contrast": .65, "normalStrength": .045},
    "InteriorFine": {"source": "Granite005A", "targetSrgb": [.73, .71, .67], "contrast": .55, "normalStrength": .025},
    "RomanTravertine": {"source": "Travertine009", "targetSrgb": [.85, .82, .75], "contrast": .48, "normalStrength": .035},
    "HonedMarble": {"source": "Marble018", "targetSrgb": [.80, .78, .73], "contrast": .68, "normalStrength": .018},
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def linear(value):
    return np.where(value <= .04045, value / 12.92, ((value + .055) / 1.055) ** 2.4)


def srgb(value):
    value = np.clip(value, 0, 1)
    return np.where(value <= .0031308, value * 12.92, 1.055 * value ** (1 / 2.4) - .055)


def resize_linear(pixels, size):
    if pixels.shape[:2] == (size, size):
        return pixels.copy()
    return np.stack([
        np.asarray(Image.fromarray(pixels[:, :, c].astype(np.float32), mode="F").resize((size, size), Image.Resampling.LANCZOS))
        for c in range(3)
    ], axis=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Committed authoring materials directory")
    parser.add_argument("--provenance", type=Path, required=True, help="Original source-map hash register")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ktx-bin", type=Path, help="Official pinned KTX-Software4.4.2 tools directory")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    provenance = json.loads(args.provenance.read_text())
    originals = []
    for reference in provenance["references"]:
        for entry in reference["maps"]:
            path = args.source / entry["file"]
            actual = sha256(path)
            if actual != entry["sha256"]:
                raise RuntimeError(f"Original source-map hash mismatch: {entry['file']}")
            originals.append({"file": entry["file"], "sha256": actual, "bytes": path.stat().st_size})
    report = {
        "schema": 1, "appearanceRevision": 4, "architecturalUvRevision": 3,
        "interpretation": "Modern CC0 material derivatives; target palettes and contrast are appearance interpretations, not calibrated samples of the demolished station.",
        "algorithm": "Decode sRGB to linear; normalize each source channel by its spatial mean; apply contrast about that mean and multiply by the target linear palette; clip to0..1; resize in linear light; encode sRGB once.",
        "scope": "Base colour and separately applied normal-strength scalars only. Normal-map pixels, roughness/metallic/AO maps, geometry, UV coordinates, lighting atlases and reflection captures are preserved.",
        "rebakedIllumination": False, "sourceMaps": originals, "profiles": {},
    }
    if args.ktx_bin:
        version = subprocess.run([str(args.ktx_bin / "toktx"), "--version"], check=True, capture_output=True, text=True)
        report["ktxVersion"] = (version.stdout + version.stderr).strip()
        if "4.4.2" not in report["ktxVersion"]:
            raise RuntimeError("Use pinned KTX-Software4.4.2")
    for name, profile in PROFILES.items():
        source = args.source / profile["source"] / f"{profile['source']}_2K-JPG_Color.jpg"
        encoded_source = np.asarray(Image.open(source).convert("RGB"), dtype=np.float64) / 255
        original = linear(encoded_source)
        means = original.mean(axis=(0, 1))
        target = linear(np.array(profile["targetSrgb"]))
        adjusted = target * (1 + profile["contrast"] * (original / means - 1))
        clipping = int(np.count_nonzero((adjusted < 0) | (adjusted > 1)))
        adjusted = np.clip(adjusted, 0, 1)
        record = {**profile, "sourceFile": str(source.relative_to(args.source)), "sourceSha256": sha256(source), "sourceLinearMean": means.tolist(), "targetLinearMean": target.tolist(), "clippedRgbSamples": clipping, "rgbSamples": int(adjusted.size), "variants": {}}
        for variant, size in [("full", 2048), ("low", 512)]:
            pixels = np.clip(resize_linear(adjusted, size), 0, 1)
            output = args.out / f"{name}-{variant}.png"
            image = np.rint(srgb(pixels) * 255).astype(np.uint8)
            Image.fromarray(image, mode="RGB").save(output, compress_level=9)
            roundtrip = linear(image.astype(np.float64) / 255)
            details = {"file": output.name, "size": [size, size], "bytes": output.stat().st_size, "sha256": sha256(output), "decodedLinearMean": roundtrip.mean(axis=(0, 1)).tolist(), "decodedLinearStd": roundtrip.std(axis=(0, 1)).tolist()}
            if args.ktx_bin:
                compressed = output.with_suffix(".ktx2")
                subprocess.run([str(args.ktx_bin / "toktx"), "--t2", "--encode", "uastc", "--uastc_quality", "1", "--zcmp", "6", "--threads", "2", "--genmipmap", "--assign_oetf", "srgb", "--assign_primaries", "bt709", str(compressed), str(output)], check=True)
                decoded = args.out / f"{name}-{variant}-decoded.png"
                subprocess.run([str(args.ktx_bin / "ktx"), "extract", "--transcode", "rgba8", str(compressed), str(decoded)], check=True)
                decoded_bytes = np.asarray(Image.open(decoded).convert("RGB"), dtype=np.float64)
                if decoded_bytes.shape != image.shape:
                    raise RuntimeError("KTX decoded dimensions differ")
                error = np.abs(decoded_bytes - image.astype(np.float64))
                decoded_linear = linear(decoded_bytes / 255)
                decoded_means = decoded_linear.mean(axis=(0, 1))
                if np.max(np.abs(decoded_means - roundtrip.mean(axis=(0, 1)))) > .005:
                    raise RuntimeError("KTX compression materially changed mean albedo")
                details["ktx"] = {"file": compressed.name, "bytes": compressed.stat().st_size, "sha256": sha256(compressed), "decodedLinearMean": decoded_means.tolist(), "encodedRgbError255": {"mean": float(error.mean()), "p99": float(np.percentile(error, 99)), "max": float(error.max())}}
            record["variants"][variant] = details
        report["profiles"][name] = record
    for entry in originals:
        if sha256(args.source / entry["file"]) != entry["sha256"]:
            raise RuntimeError("A source map changed while generating derivatives")
    (args.out / "surface-finish.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"profiles": len(report["profiles"]), "sourceMapsVerified": len(originals), "output": str(args.out)}, indent=2))


if __name__ == "__main__":
    main()
