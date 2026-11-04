# Proposed supersession of the flat source packet

No repository files have been changed by this preparation. Root must review the exact replacement list and budget before copying this external packet into `authoring/penn-station-1935/review/phase9/p5-finish-study`.

The previous 51-file flat packet is preserved by immutable commit **89035a4f09fcf43046c3651d6473de20f270e299**. A separate lossless tar/gzip backup was made directly from that commit and all 51 archived file hashes were checked against the current replacement targets. Its external location, SHA256, decoded tar identity and full file inventory are retained in `superseded-flat-packet.json`. The archive is 6,924,597 bytes, SHA256 `e5db06b2d14cd44edd9f49b83d6d70dbdbf643de3e87f6fd6e9ec38cc3afc05d`.

The original exact flat full.blend and its earlier lossless external backup remain retained; this proposal does not delete them. The new packet recovers the exact old base/flat GLBs from the final combined BIN and their archived original headers, retains the flat builder/proposal/full manifest, and preserves the flat source evidence through the verified old packet. It replaces the duplicate old raw payload and two earlier PNGs with the new source checkpoint and one actual accepted curved-detail PNG.

To recover the old packet from Git, first create a new external destination, then archive the immutable commit rather than checking out files over a working tree:

```sh
git archive --format=tar --output=/tmp/p5-flat-89035a4.tar \
  89035a4f09fcf43046c3651d6473de20f270e299 \
  authoring/penn-station-1935/review/phase9/p5-finish-study
```

Extract into that fresh external destination and compare each recovered file against the 51 hashes in `superseded-flat-packet.json`. The stored external tar/gzip can be decoded and checked against the same inventory if Git history is unavailable. Exact file-tree recovery is the requirement; a newly serialized tar may differ from the stored archive bytes across tools.

`COPY-INDEX.json` outside this proposed tree records the complete new file list, sizes, hashes and exact additions/changes/removals relative to the old directory. No runtime asset, app code, canonical source or station geometry is part of this source-packet replacement proposal. Publishing the curved geometry remains a separate reviewed action.
