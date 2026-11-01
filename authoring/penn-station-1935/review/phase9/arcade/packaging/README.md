# Connected entrance: source packaging checkpoint

This packet preserves the bounded old-surface removal and manifest review for accepted authored`connected-v12`. Its four ownership/protection GLBs are byte-identical to acceptedv11; the twenty-source-interface classification and four retained outputs remain valid. The source record is separate from new illumination/compression, assembled navigation and browser acceptance.

The [archive index](archive-index.json) records compressed and decoded SHA256/size for every gzip receipt. Decoding a receipt preserves the exact observed JSON bytes, including original machine paths. Large raw GLBs, retained model candidates, full manifest duplicates and copied helper snapshots are excluded. Original machine paths are provenance; the commands below use explicit portable input paths.

## Verified results

Full and low were processed independently at4mm tolerance, normal cosine0.90 and100% source-centroid coverage. Exterior removes12,626actual triangles per variant; Waiting removes2,376. Every changed retained index sequence and every untouched primitive/payload was checked independently. No positions, normals, UVs, runtime material bindings, atlas images, transforms or original buffer payloads were rewritten.

| Retained output | Decoded GLB SHA256 |
|---|---|
| Exterior full |`5f537bd24b8d6aaed3846adff0706ea7c189331c9e56e3916403fdbda155b17d`|
| Exterior low |`a143b23aa4f6bc381411f287699aa201e205870af4a1a89c29a76eb14e433e84`|
| Waiting full |`8ac3f5c137326e4459a85d09a19f8593d4ebd8682f918a4b09fe5e6b5e475ebc`|
| Waiting low |`415756f48ef804efd6c85019eda41dffac8c6ecbfdb6581b343ce158c178b20d`|

Thirty original Milford source-oriented faces have exact reverse-oriented delivered twins. Raw-source classification assigns twenty twins to owned geometry and ten to protected neighbours. Both quality tiers retain all ten protected faces and remove the twenty owned twins. The initial alternate-diagonal explanation failed and is preserved, not claimed as fact. No historical cleanup operation is inferred from this geometry result.

The existing matcher already vetoed deletion of an oriented protected neighbour, but omitted those retained faces from source-coverage bookkeeping. The accepted-v11 baseline consequently failed at2,014/2,024=99.5059%. The bounded fix counts already-kept, positively protected faces in the coverage set; matching, tolerances, normals and index selection are unchanged. Actual/synthetic failures are preserved under`failures/`. The removal suite passes38 controls; platform ownership passes18 negative controls and both prior retained output hashes remain unchanged.

Five Ashlar names normalize to Travertine in **comparison exports only**. Exact source vertices/oriented triangles map to Main masonry material4 and none to the separate material14order lattice. Historical raw BIN/geometry remains exact. Original alias cores/receipts and the source-family code evidence remain available. A portable replay emits a new comparison receipt tied to its own input paths/current code hashes; its authority metadata hash can differ while its geometry and resulting retained decoded output must match the table.

## Reproduce source authorities

Use the existing [source CLI and controls](../source/README.md), the immutablec96Blender input and a fresh external output directory. Run`export_retained_main.py --candidate YOUR_NEW_SOURCE_DIRECTORY` afterward to produce Main protection in Main0. The exact helper used by acceptedv12 is included in`../source/`. The full portable producer plus this exporter has already reproduced **all five raw GLBs byte-for-byte**, recorded in`receipts/source-portable-replay-v12.json.gz`.

Match all four original authority hashes against`../source/source-freeze.json` before using them. New moduleSHA`4cd4dbbf7f20652953f764ba50de4cb73afed5862460270ab8eeb4c7c15b442f` is separate from the four removal inputs. Never replace or simplify an authority to make matching pass.

## Recover immutable delivered bases

From the repository root, set task-specific external directories and recover exactly the four old transports. The unchanged manifest is available from the same commit.

```sh
ARCADE_BASE_DIR=/private/tmp/penn-arcade-old-bases
ARCADE_REPLAY_DIR=/private/tmp/penn-arcade-removal-review
mkdir -p "$ARCADE_BASE_DIR" "$ARCADE_REPLAY_DIR"
for ARCADE_FILE in model-exterior.glb.gz model-exterior-low.glb.gz model-waiting-room.glb.gz model-waiting-room-low.glb.gz; do
  git show "96641fd2fc9ca8906e74fe636fa950eab5354223:penn-station-1935/assets/$ARCADE_FILE" > "$ARCADE_BASE_DIR/$ARCADE_FILE"
done
git cat-file blob 2f53f4f4328c323a491180f0fb0ec00938a45325 > "$ARCADE_REPLAY_DIR/base-manifest.json"
```

Transport hashes are pinned by the original removal receipts and`authority-reuse-v12.json.gz`. The manifest is686,298bytes, SHA256`973b13bfee2809385b055ad5767b7526c95af9c90abe7e1878400504593c1d12`. Set`PENN_TOOLS` to the existing pinned tool installation; no dependency update is needed. Set`ARCADE_SOURCE_DIR` to the fresh source-CLI output directory.

## Comparison aliases and strict removal

The portable owned-lattice audit can regenerate the source/batch correspondence. The archived exact audit also suffices for replaying the same accepted inputs.

```sh
node tests/penn-arcade-owned-lattice.mjs --bases "$ARCADE_BASE_DIR" --sources "$ARCADE_SOURCE_DIR" --out "$ARCADE_REPLAY_DIR/owned-lattice.json"
```

Prepare only the Main comparison exports. Use the accepted source freeze as the producer receipt; it pins both original files. These commands preserve all source BIN and geometry/accessor/node JSON.

```sh
node penn-station-1935/model/prepare_arcade_comparison.mjs --input "$ARCADE_SOURCE_DIR/old-arcade-owned-main-main0.glb" --input-sha b8da605c17114cea4f6bf6a67e6ba8fb1826550677b0ff2617efaf254052c03f --role owned --zone waiting-room --producer-proof authoring/penn-station-1935/review/phase9/arcade/source/source-freeze.json --owned-mapping-audit "$ARCADE_REPLAY_DIR/owned-lattice.json" --out "$ARCADE_REPLAY_DIR/main-owned"
node penn-station-1935/model/prepare_arcade_comparison.mjs --input "$ARCADE_SOURCE_DIR/retained-main-occluder-main0.glb" --input-sha 5e56cfc2a135c499eb40a1a9c6ad5516359c7bbee95043a8f0d32ebba58ad511 --role protected --zone waiting-room --producer-proof authoring/penn-station-1935/review/phase9/arcade/source/source-freeze.json --owned-mapping-audit "$ARCADE_REPLAY_DIR/owned-lattice.json" --out "$ARCADE_REPLAY_DIR/main-protected"
```

Run the existing scoped remover independently for each original variant. Both Main authority and delivered Waiting use Main0; Exterior uses Street0. **source-y0** is intentional. The new module is appended separately in Street0.

```sh
for ARCADE_LOD in full low; do
  ARCADE_SUFFIX=
  if [ "$ARCADE_LOD" = low ]; then ARCADE_SUFFIX=-low; fi
  node penn-station-1935/model/remove_platform_access.mjs --input "$ARCADE_BASE_DIR/model-exterior$ARCADE_SUFFIX.glb.gz" --components "$ARCADE_SOURCE_DIR/old-arcade-owned-exterior-street0.glb" --protected "$ARCADE_SOURCE_DIR/retained-exterior-occluder.glb" --scope arcade-architecture --source-y 0 --tolerance .004 --minimum-coverage 1 --out "$ARCADE_REPLAY_DIR/retained/model-exterior$ARCADE_SUFFIX.glb.gz" --report "$ARCADE_REPLAY_DIR/retained/exterior-$ARCADE_LOD-removal.json"
  node penn-station-1935/model/remove_platform_access.mjs --input "$ARCADE_BASE_DIR/model-waiting-room$ARCADE_SUFFIX.glb.gz" --components "$ARCADE_REPLAY_DIR/main-owned/comparison-authority.glb" --protected "$ARCADE_REPLAY_DIR/main-protected/comparison-authority.glb" --scope arcade-architecture --source-y 0 --tolerance .004 --minimum-coverage 1 --out "$ARCADE_REPLAY_DIR/retained/model-waiting-room$ARCADE_SUFFIX.glb.gz" --report "$ARCADE_REPLAY_DIR/retained/waiting-$ARCADE_LOD-removal.json"
done
```

Compare decoded output hashes to the verified table. A mismatch is a review failure, not permission to widen bounds. `tests/penn-arcade-removal-audit.mjs` independently checks output indices/payloads with`--base`, `--candidate`, `--removal-report`, `--out`. `tests/penn-arcade-source-interfaces.mjs` takes`--audit`, `--base`, `--sources`, `--out`; `tests/penn-arcade-interface-outcome.mjs` takes`--base`, `--candidate`, `--interface-proof`, `--out` to reproduce the ten-kept/twenty-removed interface proof.

## Manifest review

```sh
node tests/penn-arcade-manifest.mjs --base "$ARCADE_REPLAY_DIR/base-manifest.json" --proof authoring/penn-station-1935/review/phase9/arcade/source/source-proof.json --freeze authoring/penn-station-1935/review/phase9/arcade/source/source-freeze.json --out "$ARCADE_REPLAY_DIR/manifest" --label accepted-v12
```

The observed current helper passes25corruption cases and six CLI controls against acceptedv12. Every previous field and walkable prefix remains exact; exactly five reviewed permissions are added and require actual floor intersections. The cases cover coherent source-pin mutations, all frame declarations, semantic area corruption, duplicate/malformed materials, base corruption, double application and external-only path/overwrite guards. No permission supplies a physical floor or collision.

The generic audit/normalizer wrappers in this packet change path handling/imports and add gzip-receipt support; their retained mathematical/comparison bodies come from the observed external audits. Syntax checks pass. No additional matcher or browser run was required for this packaging-only copy. Root owns final copy, assembly, fresh lighting, encoded-contact checks and publication.
