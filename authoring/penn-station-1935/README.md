# Pennsylvania Station authoring archive

Editable sources, materials, lighting records and review evidence for the reconstruction. **All contents are public-release material, not private storage.** The current legacy root Pages deployment can serve this directory. Its exclusion from the separate custom staging process does not make these repository files private.

## Current editable scenes

| File | Contents |
| --- | --- |
| [penn-station-phase4-maintenance.blend](penn-station-phase4-maintenance.blend) | Current core checkpoint, retaining the Phase 3 scene with all four office labels turned toward the hall, nine closed floor-to-tread slots, and complete gate indicators moved onto supported stair flanks. The separate appearance pipeline applies the reviewed stone derivatives. |
| [penn-station-phase3.blend](penn-station-phase3.blend) | Corrected core exterior, waiting room, concourse, raised end entrances and connected access stairs. Compressed, with packed fallback material images. |
| [context-neighbourhood.blend](context-neighbourhood.blend) | Current Hotel Pennsylvania, General Post Office and period street context, including the corrected Hotel column grounding. |
| [railway-editable.blend](railway-editable.blend) | Separate source-based21-track/11-platform layout and22 supported platform-light units. |
| [model-trains.blend](model-trains.blend) | Early-production GG1 and interpreted P70 coaches. |
| [scene-manifest-phase4.json](scene-manifest-phase4.json) | Current dimensions, levels, walking bounds and repaired main-stair opening edges. Railway and end-stair registrations remain those of Phase 3. |

The core opens in common world coordinates: street0m and Main−4.2672m. Scene property `main_floor_world` records that level. Exported room/railway GLBs retain Main0 and receive their offset in the browser; do not apply it twice to the editable core. The separate railway authoring source retains its own Main0 coordinate contract.

## Appearance revision4 checkpoint

The [stone-finish derivatives and reproduction notes](materials/phase4/) retain original-map hashes, interpreted palettes, clipping, compressed-image error and decoded linear means. The [isolated browser comparison](review/phase4/material-finish/) contains actual before/after Metal captures and a separate geometry/material preservation check. These are a modest appearance change, separate from final integrated navigation and asset checks.

Editable Blender scenes retain their authored base material definitions. Revised runtime albedo and normal strength are applied after export using [prepare_surface_library.py](../../penn-station-1935/model/prepare_surface_library.py) and [apply_surface_finish.mjs](../../penn-station-1935/model/apply_surface_finish.mjs). A saved geometry scene alone therefore does not reproduce the final PBR derivative pipeline. Architectural UV revision3 and grain scale are unchanged. Existing Phase3 indirect-light atlases and static probes are retained; the effect of revised albedo on secondary bounce light has not been rebaked in this narrow checkpoint. This work does not reinstate the lost split-atlas bakes, new concourse detail or reflection captures.

## Materials, lighting and review

- [materials/](materials/): original CC0 stone PBR maps used by the delivery pipeline.
- [lighting/](lighting/): original illumination/atlas archives and bake records. The separate [Phase3 exterior reflection](lighting/phase3/exterior-reflection/) records the authored elevated Seventh Avenue panorama, its six input hashes and limitations. The superseded modern CC0 panorama remains in [originals/](lighting/phase3/originals/). Phase3 calibrated runtime derivatives and their exact promotion record are documented by the application validation and lighting pipeline; old Phase2 records remain evidence of that earlier release.
- [review/phase3/](review/phase3/): current four-corner exterior views, low/high interior views, [geometry notes](review/phase3/geometry-notes.md), [scoped bearing audit](review/phase3/architecture-contact-audit.json), [assembled walking/railway contact audit](review/phase3/assembled-route-contact-audit.json), input hashes, railway checks and lighting-calibration evidence. Source stills use review daylight and do not certify final browser lighting.
- [references/phase3/](references/phase3/): item-specific archival and passenger-asset provenance, including the actual north mural recovery.
- [Application validation](../../penn-station-1935/VALIDATION.md): delivered browser checks, lighting output locations and limitations.

The Phase 4 checkpoint review lives in [review/phase4/](review/phase4/): actual browser checks, scoped physical stair repairs, office-sign evidence and material comparisons. [The archived Phase 3 validation](review/phase3/VALIDATION.md) describes the previous release. A restart removed temporary, uncommitted work for a larger visual pass; that work is not included in this checkpoint or claimed as delivered. New ceiling atlases, corrected arch normals with rebakes, concourse windows/prisms, refined candelabra, mural enlargement and new reflection captures remain outstanding.

Older sources remain: [penn-station-phase2.blend](penn-station-phase2.blend), [scene-manifest-phase2.json](scene-manifest-phase2.json) and [review/phase2/](review/phase2/); Phase1 backups are [penn-station-phase1.blend](penn-station-phase1.blend), [phase1-materials/](phase1-materials/) and [review/phase1/](review/phase1/). Older statements describe those earlier implementations.

## Evidence, uncertainty and rights

Read the [historical research ledger](../../penn-station-1935/RESEARCH.md), [source catalog](../../penn-station-1935/sources.json), [core geometry ledger](../../penn-station-1935/model/README.md), [railway ledger](../../penn-station-1935/model/railway-research.md), [context ledger](../../penn-station-1935/model/context-research.md), [rolling-stock ledger](../../penn-station-1935/model/rolling-stock-research.md) and [passenger ledger](../../penn-station-1935/model/passenger-research.md).

The core adopts143ft as the finished-ceiling height from Francis & O’Brien; Gibbs explicitly reports150ft in the same engineering volume, so that primary conflict remains. Five murals, concourse perimeter fenestration and glass-prism floor lights, figurative sculpture, exact1935 operations and some furnishings remain unfinished. The current railway traces the opening-era plan; its1935 electrical arrangements and other detailed qualifications remain in its own ledger. This is not a certified1:1 or completed photorealistic reconstruction.

Licensing is recorded in [ASSET_RIGHTS.md](../../penn-station-1935/ASSET_RIGHTS.md), [material-provenance.json](../../penn-station-1935/material-provenance.json), [THIRD_PARTY.md](../../penn-station-1935/THIRD_PARTY.md) and the item-specific provenance files. A historical research reference is not automatically licensed for redistribution. See the [application README](../../penn-station-1935/README.md) for the authoring, baking and runtime commands.
