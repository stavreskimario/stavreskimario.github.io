# Pennsylvania Station authoring archive

Editable sources, materials, lighting records and review evidence for the reconstruction. The custom Pages staging process excludes this directory. Legacy root Pages deployments can still serve it: **all contents are public-release material, not private storage.**

## Current editable scenes

| File | Contents |
| --- | --- |
| [penn-station-phase3.blend](penn-station-phase3.blend) | Corrected core exterior, waiting room, concourse, raised end entrances and connected access stairs. Compressed, with packed fallback material images. |
| [context-neighbourhood.blend](context-neighbourhood.blend) | Current Hotel Pennsylvania, General Post Office and period street context, including the corrected Hotel column grounding. |
| [railway-editable.blend](railway-editable.blend) | Separate source-based21-track/11-platform layout and22 supported platform-light units. |
| [model-trains.blend](model-trains.blend) | Early-production GG1 and interpreted P70 coaches. |
| [scene-manifest-phase3.json](scene-manifest-phase3.json) | Current dimensions, levels, walking bounds, end-stair/door controls and reconstruction qualifications. |

The core opens in common world coordinates: street0m and Main−4.2672m. Scene property `main_floor_world` records that level. Exported room/railway GLBs retain Main0 and receive their offset in the browser; do not apply it twice to the editable core. The separate railway authoring source retains its own Main0 coordinate contract.

## Materials, lighting and review

- [materials/](materials/): original CC0 stone PBR maps used by the delivery pipeline.
- [lighting/](lighting/): original illumination/atlas archives and bake records. The separate [Phase3 exterior reflection](lighting/phase3/exterior-reflection/) records the authored elevated Seventh Avenue panorama, its six input hashes and limitations. The superseded modern CC0 panorama remains in [originals/](lighting/phase3/originals/). Phase3 calibrated runtime derivatives and their exact promotion record are documented by the application validation and lighting pipeline; old Phase2 records remain evidence of that earlier release.
- [review/phase3/](review/phase3/): current four-corner exterior views, low/high interior views, [geometry notes](review/phase3/geometry-notes.md), [scoped bearing audit](review/phase3/architecture-contact-audit.json), [assembled walking/railway contact audit](review/phase3/assembled-route-contact-audit.json), input hashes, railway checks and lighting-calibration evidence. Source stills use review daylight and do not certify final browser lighting.
- [references/phase3/](references/phase3/): item-specific archival and passenger-asset provenance, including the actual north mural recovery.
- [Application validation](../../penn-station-1935/VALIDATION.md): delivered browser checks, lighting output locations and limitations.

Older sources remain: [penn-station-phase2.blend](penn-station-phase2.blend), [scene-manifest-phase2.json](scene-manifest-phase2.json) and [review/phase2/](review/phase2/); Phase1 backups are [penn-station-phase1.blend](penn-station-phase1.blend), [phase1-materials/](phase1-materials/) and [review/phase1/](review/phase1/). Older statements describe those earlier implementations.

## Evidence, uncertainty and rights

Read the [historical research ledger](../../penn-station-1935/RESEARCH.md), [source catalog](../../penn-station-1935/sources.json), [core geometry ledger](../../penn-station-1935/model/README.md), [railway ledger](../../penn-station-1935/model/railway-research.md), [context ledger](../../penn-station-1935/model/context-research.md), [rolling-stock ledger](../../penn-station-1935/model/rolling-stock-research.md) and [passenger ledger](../../penn-station-1935/model/passenger-research.md).

The core adopts143ft as the finished-ceiling height from Francis & O’Brien; Gibbs explicitly reports150ft in the same engineering volume, so that primary conflict remains. Five murals, concourse perimeter fenestration and glass-prism floor lights, figurative sculpture, exact1935 operations and some furnishings remain unfinished. The current railway traces the opening-era plan; its1935 electrical arrangements and other detailed qualifications remain in its own ledger. This is not a certified1:1 or completed photorealistic reconstruction.

Licensing is recorded in [ASSET_RIGHTS.md](../../penn-station-1935/ASSET_RIGHTS.md), [material-provenance.json](../../penn-station-1935/material-provenance.json), [THIRD_PARTY.md](../../penn-station-1935/THIRD_PARTY.md) and the item-specific provenance files. A historical research reference is not automatically licensed for redistribution. See the [application README](../../penn-station-1935/README.md) for the authoring, baking and runtime commands.
