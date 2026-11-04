# Historical generated raw AO archive

Seven historical ambient-occlusion bake PNGs are preserved byte for byte in immutable Git commit `9aac950fca7027ee51564daf7dd0d5c63ad9eb62` and in verified persistent backups outside the public tree. [The exact receipt](historical-raw-ao-archive.json) records each path, original byte count, SHA256, Git blob and backup location. The archival saves 14,920,571 bytes of legacy public-root storage.

Three files are the earlier root lighting bakes for exterior, waiting room and concourse; four are the Phase3 raw exterior, waiting room, concourse and platform bakes. These remain historical authoring provenance. Original bake reports and controls stay present. Current runtime assets, current editable models, all filtered/denoised derivatives, detailed-order AO and every current Phase6–9 lighting source remain present and were checked byte for byte across this scoped archive.

Active asset checks read the retained HDR and denoised PNG derivatives. Restore the historical raw input before reproducing an authoring step that needs its original pixels. From the repository root, choose a receipt entry and recover it outside the public tree:

```sh
git show 9aac950fca7027ee51564daf7dd0d5c63ad9eb62:authoring/penn-station-1935/lighting/phase3/raw/lighting-platform-ao.png > ../restored-phase3-platform-ao.png
```

Compare the restored byte count and SHA256 with the receipt. The verified external backup is an alternative exact source. Recovery does not change the current delivered appearance or replace a newer atlas.
