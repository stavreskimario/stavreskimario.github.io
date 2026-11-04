"""CPU controls proving the real rebake acceptance gate rejects regressions."""
from pathlib import Path
import argparse
import copy
import json
from audit_arrivals_rebake import Glb, compare_geometry, compare_materials, compare_fresh_ao, sha


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("original", "priority-input", "actual", "fresh-ao", "out"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    assert not args.out.exists()
    original, priority, actual = [Glb(path) for path in (args.original, args.priority_input, args.actual)]
    source_hashes = [sha(x.bytes) for x in (original, priority, actual)]
    rows = []

    def reject(name, operation):
        try:
            operation()
        except AssertionError as error:
            rows.append({"control": name, "rejected": True, "reason": str(error)})
        else:
            raise AssertionError("Control was unexpectedly accepted: " + name)

    def changed_attribute(name, component, value):
        changed = copy.copy(actual)
        primitives = actual.primitives()
        key = next(k for k in primitives if k[0] == "concourse-arrivals baked static architecture")
        fields = dict(primitives[key]["fields"])
        fields[name] = fields[name].copy()
        fields[name][component] += value
        primitives[key] = {**primitives[key], "fields": fields}
        changed.primitives = lambda: primitives
        return changed

    reject("1mm physical displacement", lambda: compare_geometry(original, priority, changed_attribute("POSITION", (0, 0, 0), .001)))
    reject("changed surface UV0", lambda: compare_geometry(original, priority, changed_attribute("TEXCOORD_0", (0, 0, 0), .01)))
    reject("changed priority lighting UV1", lambda: compare_geometry(original, priority, changed_attribute("TEXCOORD_1", (0, 0, 0), .01)))
    reject("non-finite lighting UV1", lambda: compare_geometry(original, priority, changed_attribute("TEXCOORD_1", (0, 0, 0), float("nan"))))
    reject("non-unit authored normal", lambda: compare_geometry(original, priority, changed_attribute("NORMAL", (0, 0, 0), .5)))
    changed = copy.copy(actual)
    changed.json = copy.deepcopy(actual.json)
    changed.json["materials"][0]["normalTexture"]["scale"] = .5
    reject("changed PBR normal strength", lambda: compare_materials(original, changed))
    changed_image = copy.copy(actual)
    original_image = actual.image

    def corrupt_image(index):
        payload, image, texture = original_image(index)
        if index == actual.json["materials"][0]["normalTexture"]["index"]:
            payload = bytes([payload[0] ^ 1]) + payload[1:]
        return payload, image, texture

    changed_image.image = corrupt_image
    reject("changed authored normal image", lambda: compare_materials(original, changed_image))
    reject("original stale AO exported after fresh bake", lambda: compare_fresh_ao(original, args.fresh_ao))
    assert source_hashes == [sha(x.path.read_bytes()) for x in (original, priority, actual)]
    report = {"schema": 1, "status": "PASS", "controls": rows,
              "allSourceFilesUnchanged": True, "generatorSha256": sha(Path(__file__).read_bytes())}
    args.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
