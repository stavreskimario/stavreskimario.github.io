# Pennsylvania Station authoring archive

Editable sources, original materials, lighting records and review evidence for the Phase 2 preview. The custom Pages staging process excludes this directory. A legacy Pages deployment from the repository root can still serve it: **all contents here are public-release material, not private storage.**

## Editable scenes

| File | Contents |
| --- | --- |
| [penn-station-phase2.blend](penn-station-phase2.blend) | Station exterior, waiting room, concourse, linked stairs and representative platform. Compressed, with packed fallback material images. |
| [context-neighbourhood.blend](context-neighbourhood.blend) | Hotel Pennsylvania, General Post Office and interpreted period street assets. |
| [model-trains.blend](model-trains.blend) | Early-production GG1 and two interpreted P70 coaches. |
| [scene-manifest-phase2.json](scene-manifest-phase2.json) | Dimensions, levels, walkable bounds and reconstruction qualifications. |

The core scene opens in common world coordinates: street at 0 m and main passenger floor at −4.2672 m. Its `main_floor_world` property records that level. Exported interior GLBs retain Main = 0 and receive their offset in the browser; do not apply it twice to the editable scene.

## Materials, lighting and review

- [materials/](materials/): original CC0 granite and travertine PBR maps used by the delivery pipeline.
- [lighting/](lighting/): original HDR illumination, AO PNGs, preview encodings and per-zone bake records. Runtime derivatives live in the application assets.
- [review/phase2/](review/phase2/): source stills, floor/stair audits, delivery hashes and [geometry review notes](review/phase2/geometry-notes.md). Source stills use simple review lighting; they do not certify the final browser appearance.
- [Application validation record](../../penn-station-1935/VALIDATION.md): delivered browser checks and limitations.

Phase 1 backups remain in [penn-station-phase1.blend](penn-station-phase1.blend), [phase1-materials/](phase1-materials/) and [review/phase1/](review/phase1/). Older review statements describe that earlier implementation, rather than certifying current historical claims.

## Evidence, uncertainties and rights

Consult the [historical research ledger](../../penn-station-1935/RESEARCH.md), [source catalog](../../penn-station-1935/sources.json), [core geometry ledger](../../penn-station-1935/model/README.md), [neighbourhood ledger](../../penn-station-1935/model/context-research.md) and [rolling-stock ledger](../../penn-station-1935/model/rolling-stock-research.md).

The implemented 150 ft waiting-room envelope remains provisional: ASCE explicitly describes a 143 ft highest ceiling. Complete murals, surveyed ornament, period operational details and the full railway layout also remain unresolved. This preview is not a certified 1:1 or completed photorealistic reconstruction.

Licensing and attribution are recorded in [ASSET_RIGHTS.md](../../penn-station-1935/ASSET_RIGHTS.md), [material-provenance.json](../../penn-station-1935/material-provenance.json) and [THIRD_PARTY.md](../../penn-station-1935/THIRD_PARTY.md). Historical references linked for research are not automatically licensed for redistribution. See the [application README](../../penn-station-1935/README.md) for reproducible authoring, baking and runtime delivery commands.
