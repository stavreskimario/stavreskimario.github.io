# Pennsylvania Station authoring archive

Editable sources, materials, lighting records and review evidence for the reconstruction. **All contents are public-release material, not private storage.** The current legacy root Pages deployment can serve this directory. Its exclusion from the separate custom staging process does not make these repository files private.

## Editable scenes and historical versions

| File | Contents |
| --- | --- |
| [penn-station-phase5.blend](penn-station-phase5.blend) | Current editable source: scoped coffer-normal correction, concrete bedding below existing marble finishes, packed bounded stone-roughness maps and two photographed wall brackets. Existing room geometry, prism coverage, stairs and closed capital shells are retained. Source checks are separate from runtime visual acceptance. |
| [penn-station-phase4.blend](https://github.com/stavreskimario/stavreskimario.github.io/blob/60563ab11c1d83c9b21badcd7fbd7b21efa66473/authoring/penn-station-1935/penn-station-phase4.blend) | Immutable previous source, with exact bytes and a verified persistent backup recorded in the Phase5 source-history receipt. |
| [scene-manifest-phase4-architecture.json](scene-manifest-phase4-architecture.json) | Current architectural source metadata and revision 3 broad-floor coverage, including retained bearing cells and navigation datums. |
| [penn-station-phase4-maintenance.blend](https://github.com/stavreskimario/stavreskimario.github.io/blob/cefcd2bd366ee236bd2e748b9922d34e4cbf3305/authoring/penn-station-1935/penn-station-phase4-maintenance.blend) | Immutable historical maintenance checkpoint, retaining the Phase 3 scene with all four office labels turned toward the hall, nine closed floor-to-tread slots, and complete gate indicators moved onto supported stair flanks. The separate appearance pipeline applies the reviewed stone derivatives. |
| [penn-station-phase3.blend](https://github.com/stavreskimario/stavreskimario.github.io/blob/cefcd2bd366ee236bd2e748b9922d34e4cbf3305/authoring/penn-station-1935/penn-station-phase3.blend) | Immutable historical corrected core exterior, waiting room, concourse, raised end entrances and connected access stairs. Packed fallback material images are preserved in the original Git object. |
| [context-neighbourhood.blend](context-neighbourhood.blend) | Current Hotel Pennsylvania, General Post Office and period street context, including the corrected Hotel column grounding. |
| [railway-editable.blend](railway-editable.blend) | Separate source-based21-track/11-platform layout and22 supported platform-light units. |
| [model-trains.blend](model-trains.blend) | Early-production GG1 and interpreted P70 coaches. |
| [scene-manifest-phase4.json](scene-manifest-phase4.json) | Current dimensions, levels, walking bounds and repaired main-stair opening edges. Railway and end-stair registrations remain those of Phase 3. |

The core opens in common world coordinates: street0m and Main−4.2672m. Scene property `main_floor_world` records that level. Exported room/railway GLBs retain Main0 and receive their offset in the browser; do not apply it twice to the editable core. The separate railway authoring source retains its own Main0 coordinate contract.

## Current finish source and earlier appearance checkpoints

The [Phase5 source proofs](review/phase5/source/) record the combined editable scene, exact preservation checks and correct world datum. Its three selected roughness maps are packed and also retained under [materials/phase5/](materials/phase5/). They use unit multipliers and explicitly interpreted ranges, rather than multiplying the near-black modern source maps again. [Material controls](review/phase5/material-finish/) separate these appearance choices from historical evidence. Final mapped-ceiling and runtime acceptance remain separate gates. Superseded source/HDR archives use verified immutable Git references and persistent backups; see [source history](review/phase5/storage/canonical-scene-history.json) and [Phase3 HDR history](lighting/phase3/HDR_ARCHIVE.md).

The [stone-finish derivatives and reproduction notes](materials/phase4/) retain original-map hashes, interpreted palettes, clipping, compressed-image error and decoded linear means. The [isolated browser comparison](review/phase4/material-finish/) contains actual before/after Metal captures and a separate geometry/material preservation check. These are a modest appearance change, separate from final integrated navigation and asset checks.

The earlier revision4 maintenance checkpoint applied runtime albedo and normal-strength derivatives through [prepare_surface_library.py](../../penn-station-1935/model/prepare_surface_library.py) and [apply_surface_finish.mjs](../../penn-station-1935/model/apply_surface_finish.mjs). That narrow maintenance pass retained Phase3 indirect lighting; the subsequent Phase4 visual delivery rebuilt split atlases and room probes. Its [immutable validation](https://github.com/stavreskimario/stavreskimario.github.io/blob/60563ab11c1d83c9b21badcd7fbd7b21efa66473/penn-station-1935/VALIDATION.md) identifies that completed implementation. Historical checkpoint descriptions do not describe a newer candidate's acceptance status.

## Materials, lighting and review

- [materials/](materials/): original CC0 stone PBR maps used by the delivery pipeline.
- [lighting/](lighting/): original illumination/atlas archives and bake records. The separate [Phase3 exterior reflection](lighting/phase3/exterior-reflection/) records the authored elevated Seventh Avenue panorama, its six input hashes and limitations. The superseded modern CC0 panorama remains in [originals/](lighting/phase3/originals/). Phase3 calibrated runtime derivatives and their exact promotion record are documented by the application validation and lighting pipeline; old Phase2 records remain evidence of that earlier release.
- [review/phase3/](review/phase3/): current four-corner exterior views, low/high interior views, [geometry notes](review/phase3/geometry-notes.md), [scoped bearing audit](review/phase3/architecture-contact-audit.json), [assembled walking/railway contact audit](review/phase3/assembled-route-contact-audit.json), input hashes, railway checks and lighting-calibration evidence. Source stills use review daylight and do not certify final browser lighting.
- [references/phase3/](references/phase3/): item-specific archival and passenger-asset provenance, including the actual north mural recovery.
- [Application validation](../../penn-station-1935/VALIDATION.md): delivered browser checks, lighting output locations and limitations.

The Phase 4 checkpoint review lives in [review/phase4/](review/phase4/): actual browser checks, scoped physical stair repairs, office-sign evidence and material comparisons. [The archived Phase 3 validation](review/phase3/VALIDATION.md) describes the previous release. A restart removed temporary, uncommitted work for a larger visual pass; that work is not included in this checkpoint or claimed as delivered. That maintenance delivery predates the new architectural source pass. The current editable scene now contains corrected arch/coffer geometry, concourse windows and broad prism flooring, refined furnishings and candelabra; its final baked-lighting/browser acceptance is recorded separately by the parent pipeline. The original mural scan was rechecked: enlarging its native crop would not recover new detail.

Older sources remain: [penn-station-phase2.blend](https://github.com/stavreskimario/stavreskimario.github.io/blob/cefcd2bd366ee236bd2e748b9922d34e4cbf3305/authoring/penn-station-1935/penn-station-phase2.blend), [scene-manifest-phase2.json](scene-manifest-phase2.json) and [review/phase2/](review/phase2/); Phase1 backups are [penn-station-phase1.blend](https://github.com/stavreskimario/stavreskimario.github.io/blob/cefcd2bd366ee236bd2e748b9922d34e4cbf3305/authoring/penn-station-1935/penn-station-phase1.blend), [phase1-materials/](phase1-materials/) and [review/phase1/](review/phase1/). Older statements describe those earlier implementations.

## Evidence, uncertainty and rights

Read the [historical research ledger](../../penn-station-1935/RESEARCH.md), [source catalog](../../penn-station-1935/sources.json), [core geometry ledger](../../penn-station-1935/model/README.md), [railway ledger](../../penn-station-1935/model/railway-research.md), [context ledger](../../penn-station-1935/model/context-research.md), [rolling-stock ledger](../../penn-station-1935/model/rolling-stock-research.md) and [passenger ledger](../../penn-station-1935/model/passenger-research.md).

The core adopts143ft as the finished-ceiling height from Francis & O’Brien; Gibbs explicitly reports150ft in the same engineering volume, so that primary conflict remains. Five murals, figurative sculpture, exact 1935 operations and some furnishings remain unfinished. The authored concourse perimeter and broad prism flooring retain inferred minor dimensions, exact panel boundaries and surface values; their source checks do not certify final photographic fidelity. The current railway traces the opening-era plan; its1935 electrical arrangements and other detailed qualifications remain in its own ledger. This is not a certified1:1 or completed photorealistic reconstruction.

Licensing is recorded in [ASSET_RIGHTS.md](../../penn-station-1935/ASSET_RIGHTS.md), [material-provenance.json](../../penn-station-1935/material-provenance.json), [THIRD_PARTY.md](../../penn-station-1935/THIRD_PARTY.md) and the item-specific provenance files. A historical research reference is not automatically licensed for redistribution. See the [application README](../../penn-station-1935/README.md) for the authoring, baking and runtime commands.

## Recover older sources and lighting

Older Phase 1, 2, 3 and Phase 4 maintenance station scenes remain byte-for-byte in the immutable Git commit linked above and in earlier history. Their Blender files were already Zstandard-compressed; redundant gzip envelopes are not kept in the active public tree. The current Phase 4 architecture, context, railway and train scenes remain directly editable. [The lossless history receipt](review/phase4/history-storage/lossless-history-receipt.json) records original SHA-256 hashes, Git blob identities, immutable downloads and verified local backups. This organization reduces hosted storage without reducing model, image or lighting quality.

Restore a historical scene from the repository root into a review file alongside the checkout, outside the published tree:

```sh
git show cefcd2bd366ee236bd2e748b9922d34e4cbf3305:authoring/penn-station-1935/penn-station-phase3.blend > ../penn-station-restored-phase3.blend
```

All older HDR files under `lighting/` outside `phase4/` use lossless `.hdr.gz` archives, including the root lighting library and Phase 3 raw, denoised, corrected-platform, reflection and superseded-environment sources. Every original encoded HDR byte and recorded decoded SHA-256 is preserved; this changes storage transport only, not image encoding or quality. Restore one outside the published tree with:

```sh
gzip -dc authoring/penn-station-1935/lighting/phase3/denoised/lighting-exterior-sky-denoised-linear.hdr.gz > ../penn-station-restored-phase3-exterior.hdr
```

Current Phase 4 source radiance, image files and provenance are not removed by this historical storage step.
