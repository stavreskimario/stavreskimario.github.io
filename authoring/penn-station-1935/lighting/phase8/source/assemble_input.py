"""External-only GLB assembly: preserve accepted opaque/UV/PBR source verbatim.

Only the six manifest-owned unbaked rail meshes are replaced. Sixteen new
PaintedStructuralIron objects are appended. No geometry is generated here;
all new geometry comes from the independently authored Blender export.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import json
import math
import struct

H = lambda b: hashlib.sha256(b).hexdigest()
BASE_SHA = '85bfe97fa8c9459aa82591a983efe3165d87b46a1ce86413c13ae18501a89994'

def read_glb(path):
    raw = Path(path).read_bytes()
    assert struct.unpack_from('<III', raw) == (0x46546c67, 2, len(raw))
    n, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    j = json.loads(raw[20:20+n])
    blen, bkind = struct.unpack_from('<II', raw, 20+n)
    assert bkind == 0x004e4942 and 28+n+blen == len(raw)
    binary = raw[28+n:]
    assert len(j['buffers']) == 1 and 'uri' not in j['buffers'][0]
    assert j['buffers'][0]['byteLength'] <= len(binary)
    return raw, j, binary

def write_glb(path, j, binary):
    while len(binary) % 4:
        binary += b'\0'
    j['buffers'][0]['byteLength'] = len(binary)
    text = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode()
    text += b' ' * ((-len(text)) % 4)
    raw = struct.pack('<III', 0x46546c67, 2, 28+len(text)+len(binary))
    raw += struct.pack('<II', len(text), 0x4e4f534a) + text
    raw += struct.pack('<II', len(binary), 0x004e4942) + binary
    Path(path).write_bytes(raw)
    return raw

def unique_nodes(j):
    names = {}
    for i, node in enumerate(j['nodes']):
        name = node.get('name')
        assert name not in names, ('Duplicate node name', name)
        names[name] = i
    return names

def assemble(base, candidate, manifest_path, output, report_path):
    output, report_path = Path(output), Path(report_path)
    assert not output.exists() and not report_path.exists()
    old_raw, old, old_bin = read_glb(base)
    src_raw, src, src_bin = read_glb(candidate)
    assert H(old_raw) == BASE_SHA
    manifest_bytes = Path(manifest_path).read_bytes()
    manifest = json.loads(manifest_bytes)
    assert H(src_raw) == manifest['candidate']['sha256']
    owned = [row['node'] for row in manifest['ownedRailChanges']]
    assert len(owned) == len(set(owned)) == 6
    base_names, src_names = unique_nodes(old), unique_nodes(src)
    additions = [name for name in src_names if name.startswith(('P5Finish ', 'P5Curve '))]
    assert len(additions) == 16 and len(set(additions)) == 16
    assert sum(name.startswith('P5Finish ') for name in additions) == 14
    assert set(additions).isdisjoint(base_names)
    assert all(name in base_names and name in src_names for name in owned)
    assert len(old['nodes']) == len(old['meshes']) == 3904
    assert len(old['scenes']) == 1
    # All material definitions come from the accepted weighted PBR source,
    # never from the plain geometry-export materials.
    target_materials = {m['name']: i for i, m in enumerate(old['materials'])}
    assert len(target_materials) == 7
    material_map = {i: target_materials[m['name']] for i, m in enumerate(src['materials'])}
    j = copy.deepcopy(old)
    binary = bytearray(old_bin)
    views, accessors = {}, {}
    geometry_records = []

    def copy_view(index):
        if index in views:
            return views[index]
        view = copy.deepcopy(src['bufferViews'][index])
        assert view['buffer'] == 0 and not view.get('extensions')
        start, length = view.get('byteOffset', 0), view['byteLength']
        assert 0 <= start <= start+length <= len(src_bin)
        while len(binary) % 4:
            binary.extend(b'\0')
        view['byteOffset'] = len(binary)
        binary.extend(src_bin[start:start+length])
        views[index] = len(j['bufferViews'])
        j['bufferViews'].append(view)
        return views[index]

    def copy_accessor(index):
        if index in accessors:
            return accessors[index]
        accessor = copy.deepcopy(src['accessors'][index])
        assert 'sparse' not in accessor and 'bufferView' in accessor
        assert not accessor.get('extensions')
        accessor['bufferView'] = copy_view(accessor['bufferView'])
        accessors[index] = len(j['accessors'])
        j['accessors'].append(accessor)
        return accessors[index]

    def copy_mesh(index, owner):
        mesh = copy.deepcopy(src['meshes'][index])
        assert not mesh.get('weights') and not mesh.get('extensions')
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4
            assert not primitive.get('targets') and not primitive.get('extensions')
            assert src['materials'][primitive['material']]['name'].startswith('PaintedStructuralIron')
            primitive['material'] = material_map[primitive['material']]
            primitive['attributes'] = {key: copy_accessor(value) for key, value in primitive['attributes'].items()}
            if 'indices' in primitive:
                primitive['indices'] = copy_accessor(primitive['indices'])
        geometry_records.append({'owner': owner, 'sourceMesh': index, 'sourceMeshJsonSha256': H(json.dumps(src['meshes'][index], sort_keys=True).encode())})
        return mesh

    changed_meshes = set()
    owner_actions = []
    for name in owned:
        target_node = j['nodes'][base_names[name]]
        source_node = src['nodes'][src_names[name]]
        transform_keys = {'translation', 'rotation', 'scale', 'matrix'}
        assert set(target_node) <= {'mesh', 'name', 'extras'} | transform_keys
        assert set(source_node) <= {'mesh', 'name', 'extras'} | transform_keys
        assert {key: target_node.get(key) for key in transform_keys} == {key: source_node.get(key) for key in transform_keys}, 'Owned rail frame changed'
        target_mesh = target_node['mesh']
        fanout = sum(node.get('mesh') == target_mesh for node in j['nodes'])
        assert fanout >= 1
        assert target_mesh != 0
        assert all(old['materials'][p['material']]['name'] == 'PaintedStructuralIronArrivalsGuard' for p in old['meshes'][target_mesh]['primitives'])
        assert all(src['materials'][p['material']]['name'] == 'PaintedStructuralIronArrivalsGuard' for p in src['meshes'][source_node['mesh']]['primitives']), 'Owned rail must export the actual Guard binding, not a default material'
        mesh = copy_mesh(source_node['mesh'], name)
        if fanout == 1:
            j['meshes'][target_mesh] = mesh
            changed_meshes.add(target_mesh)
            action = 'replace unique owned mesh definition'
        else:
            target_node['mesh'] = len(j['meshes'])
            j['meshes'].append(mesh)
            action = 'append mesh and redirect only owned node; shared original retained'
        owner_actions.append({'owner': name, 'originalMesh': target_mesh, 'originalFanout': fanout, 'action': action, 'resultMesh': target_node['mesh']})

    scene_roots = j['scenes'][j.get('scene', 0)]['nodes']
    for name in additions:
        node = copy.deepcopy(src['nodes'][src_names[name]])
        assert set(node) <= {'mesh', 'name', 'extras', 'translation', 'rotation', 'scale', 'matrix'} and 'mesh' in node
        assert src_names[name] in src['scenes'][src.get('scene', 0)]['nodes'], 'Addition must have an explicit root frame; parent transforms may not be lost'
        for key in ['translation', 'rotation', 'scale', 'matrix']:
            if key in node:
                assert all(math.isfinite(value) for value in node[key])
        assert all(src['materials'][p['material']]['name'] == 'PaintedStructuralIronArrivalsStructure' for p in src['meshes'][node['mesh']]['primitives']), 'New fascia/haunch must retain the existing structural-iron material'
        node['mesh'], mesh = len(j['meshes']), copy_mesh(node['mesh'], name)
        j['meshes'].append(mesh)
        scene_roots.append(len(j['nodes']))
        j['nodes'].append(node)

    # Literal preservation, including the already-batched opaque architecture,
    # all UV0/UV1 data, normal/image bytes, PBR values and original node frames.
    assert bytes(binary[:len(old_bin)]) == old_bin
    for index, node in enumerate(old['nodes']):
        expected = copy.deepcopy(node)
        if node.get('name') in owned:
            expected['mesh'] = j['nodes'][index]['mesh']
        assert j['nodes'][index] == expected
    for key in ['materials', 'images', 'textures', 'samplers', 'asset']:
        assert j.get(key) == old.get(key), key
    for key in ['accessors', 'bufferViews']:
        assert j[key][:len(old[key])] == old[key]
    assert j['meshes'][0] == old['meshes'][0]
    for index, mesh in enumerate(old['meshes']):
        if index not in changed_meshes:
            assert j['meshes'][index] == mesh, index
    assert len(j['nodes']) == 3920
    assert len(j['meshes']) == 3920 + sum(action['originalFanout'] > 1 for action in owner_actions)
    assert len(owner_actions) == 6
    output.parent.mkdir(parents=True, exist_ok=True)
    result = write_glb(output, j, bytes(binary))
    proof = {'schema': 1, 'status': 'ASSEMBLY PRESERVATION PASS ONLY; SOURCE/VISUAL/FRESH GI ACCEPTANCE SEPARATE',
             'base': {'path': str(base), 'sha256': H(old_raw), 'bytes': len(old_raw)},
             'geometryCandidate': {'path': str(candidate), 'sha256': H(src_raw)},
             'geometryManifestSha256': H(manifest_bytes),
             'output': {'path': str(output), 'sha256': H(result), 'bytes': len(result)},
             'originalBinPrefixSha256': H(old_bin), 'originalBinPrefixByteExact': True,
             'allOriginalNodeFramesAndNonownedNodeDefinitionsExact': True, 'allOpaqueArchitectureMeshAndAccessorBytesExact': True,
             'allOriginalMaterialTextureImageSamplerDefinitionsAndImageBytesExact': True,
             'unownedMeshCount': len(old['meshes'])-len(changed_meshes), 'unownedMeshesExact': True,
             'ownedReplacedMeshIndices': sorted(changed_meshes), 'ownedReplacedNames': owned,
             'ownedMeshFanoutAndActions': owner_actions,
             'newMetalObjectNames': additions, 'originalNodeCount': 3904, 'outputNodeCount': 3920,
             'newNodeTransforms': [{'name': name, 'sourceNode': src['nodes'][src_names[name]], 'copiedNode': j['nodes'][next(i for i, node in enumerate(j['nodes']) if node.get('name') == name)]} for name in additions],
             'copiedGeometryBufferViews': len(views), 'copiedGeometryAccessors': len(accessors),
             'appendedGeometryBytes': len(binary)-len(old_bin), 'sourceGeometry': geometry_records,
             'choice': '85bf is the previously accepted pre-bake source with original authored corner normals and weighted UV1. It avoids another Blender normal re-encoding from b8ad and retains the current source optical PBR/maps. Its old AO and lighting extras are placeholders; fresh AO/DIFFUSE/export gates are mandatory.',
             'oldLightingBytesMayNotBePromoted': True, 'generatorSha256': H(Path(__file__).read_bytes())}
    report_path.write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps({key: proof[key] for key in ['status', 'output', 'originalBinPrefixByteExact', 'outputNodeCount', 'appendedGeometryBytes']}), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    assemble(args.base, args.candidate, args.manifest, args.out, args.report)
