# Raw sky and AO provenance recovery

Exactly five original bake inputs are reversibly archived to leave room for the connected entrance delivery within the legacy Pages root budget. [The exact receipt](raw-sky-headroom-archive.json) records immutable commit `9d722ff846b11ca78b4f1d0f56c30ff34393c9f1`, Git blob, byte count, SHA256 and verified persistent backup for every file. The saved payload is 15,758,140 bytes.

The inputs are Phase4 original exterior/platform raw sky HDR archives, Phase3 corrected-platform raw sky HDR, and Phase4 original exterior/concourse AO PNGs. They remain current or historical source provenance, not discarded assets. Restore an original before reproducing an authoring operation that needs its pixels. The original bake/denoise JSON records remain present.

Every runtime asset, every remaining lighting file (including all filtered derivatives, current Phase6–9 sources and the detailed-order AO), and each current editable model source was checked byte for byte across this bounded archival. The original order sky HDR was already archived under the separate Phase8 receipt; this step does not archive it again.

Restore a selected receipt entry outside the public tree, for example from the repository root:

```sh
git show 9d722ff846b11ca78b4f1d0f56c30ff34393c9f1:authoring/penn-station-1935/lighting/phase4/originals/lighting-exterior-sky.hdr.gz > ../restored-phase4-exterior-sky.hdr.gz
```

Compare byte count and SHA256 with the receipt before use. The verified persistent backup supplies the same bytes. Gzip HDR entries also record decoded radiance hashes; `gzip -dc` recovers that original HDR. All current filtered/runtime derivatives retain their existing quality.
