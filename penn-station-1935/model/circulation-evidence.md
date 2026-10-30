# Concourse circulation: Phase 7 correction

This source correction opens two southern Main-level passage bays, repairs the vertical corner-angle frames on the principal and isolated minor piers, and closes the rear of all nine departure wells. It preserves the structural grid, departure flights, platforms, existing street cover and provisional arrival deck. The [source archive](../../authoring/penn-station-1935/review/phase7/circulation/) separates primary evidence, chosen dimensions, rejected candidates and independent checks. These source records do not establish final browser or deployment acceptance.

## Evidence and scope

Gibbs' Main plan, Figure 2 on printed p.243, shows open intervals between piers in the eastern part of the southern court boundary. It also shows enclosed rooms and a street-stair compartment farther west. The correction therefore retains those western enclosures, the full-height stone piers and the upper windows. It does not shift the 320 ft roof to put the outer heads inside it. See [Gibbs' paper](https://ascelibrary.org/doi/10.1061/TACEAT.0002223) and [the original volume](https://archive.org/details/transactionsofam69amer).

The working plan overlay places the supported eastern interval at approximately X−54.62…−41.38 m, with at least ±0.75 m uncertainty. The two openings use existing bay edges within that interval:

| Source change | Bounds and retained geometry | Qualification |
| --- | --- | --- |
| Western open bay | X−54.60…−50.614979; world Z+48.493…+49.043 | The closed western residual X−56.650021…−54.60 remains. |
| Eastern open bay | X−48.303581…−42.451420; same southern wall depth | The intervening full-height pier and eastern end remain closed. |
| Removed wall-cell height | Main-relative 0…3.80 m | This is not unobstructed clearance. Retained sill/moulding gives approximately 3.65 m measured midpoint clearance; the checked crossings are clear through 3.60 m. |

World positive Z is south. Exact jamb registration, minor profiles and opening height remain reconstructed, rather than dimensions printed on the plan. Actual all-zone checks find existing cover at the peripheral approaches: exterior foundation mass over Platform 2 and the context sidewalk over Platform 1. No new under-street roof is invented.

## Column-angle repair

Francis and O’Brien describe the principal columns as 3 ft square, built from four 8×8 in angles with double lattice on all four sides. See printed p.198 of [their engineering paper](https://ascelibrary.org/doi/10.1061/TACEAT.0002221). The inspected elevations do not independently resolve every corner detail.

The former vertical beam basis mapped local X and Y to their negatives. Its corner profiles consequently extended outward from their intended anchors, giving a 4 ft 4 in angle envelope around the nominal 3 ft frame. The scoped repair rotates each affected L-profile around its unchanged corner anchor. Column centres, heights, baseplates, capplates, lattice and collars remain fixed; the general beam helper and curved arches are unchanged.

The accepted scope is **176 legs: 32 principal and 144 isolated minor legs**. All eight principal angle groups now measure approximately 0.9144 m square. Retained lattice stand-offs and fittings can project beyond the angle core; this is not a new survey of every fitting. The 0.62 m minor-pier envelope remains an authoring interpretation. Eighty-eight affected components also needed their complete face winding reversed. Their UVs remain attached to the same corners, and each repaired component is closed, outward-facing and supported by its actual base and cap.

Sixteen original legs remain unchanged on four ambiguous secondary piers: Blender plan centres X−41.3135/−40.8563, Y±40.6908. Those closely spaced interpreted supports need a separate joint/layout review. The rejected 192-leg candidate introduced four flange intersections there. The accepted candidate retains those original parts instead of moving the grid, clipping metal or inventing a compound joint. Actual new-angle cap-triangle clipping finds no inter-pier intersections; the rejected candidate remains a positive failure control.

## Rear well guards

The original concourse plan and [Detroit Publishing east-wall photograph](https://www.loc.gov/item/2016815390/) support fenced stair openings. The photograph's negative number 071935 is not a 1935 date. The new rear closures follow the existing side-guard treatment: 1.12 m top-rail height, 22 mm uprights and 45 mm rails, at X−43.30 with short returns to the side rails. Those fabrication dimensions and spacing remain interpreted.

The 90 new closed parts include 63 posts on the existing opaque infill. The source checks cover 315 footprint samples and 18 end connections. The departure gates, upper treads and intermediate landings are unchanged. The guards reuse the existing painted-iron material binding and remain outside the baked atlas.

## Preservation, lighting and limits

The retained corners of the two affected source batches preserve positions, normals and every UV layer exactly; 7,137 other source objects retain their signatures. A rejected export method changed the Euler/basis/world values of 36 font objects through a matrix round trip. The accepted exporter works on copies and keeps the authored originals exact. This failure is preserved in the archive rather than dismissed as visually negligible.

Independent native-geometry checks cover the Main-to-Platform 1/2 round trips and the Platform 3 approaches. The latter now passes both 0.32 m and 0.37 m body-radius controls. These are application checks, not historical accessibility standards. Actual optimized/browser/live acceptance belongs to the separate parent validation pipeline.

Only the closed residual wall receives the new 64-sample, 2048 px circulation atlas and its fallback. Corrected iron and rear guards remain unbaked. The `lighting-concourse-circulation-*` family is independent of `lighting-concourse-access-*` and the older room/roof maps. This is not a whole-station lighting replacement.

The departure schedule, platform mapping and approximately 1.6 m gate-registration discrepancy retain their [Phase 6 qualifications](departure-access-evidence.md). Separate arrivals, western departures and the broader Main/Exit floor registration remain unfinished. The retained provisional deck must not be presented as the printed 60 ft-wide arrival corridor. Opening-era evidence does not certify every 1935–1940 alteration or a complete 1:1 reconstruction.

## Reproduce the source correction

Run [repair_concourse_circulation.py](https://github.com/stavreskimario/stavreskimario.github.io/blob/d6d6cb169c2c109b08da6b956bf8e439e94ab8f6/penn-station-1935/model/repair_concourse_circulation.py) with the exact pre-correction input, SHA256 `ab7af4ede715cd87337117053ddc8c46e4ba393a6d5a75f4200a92294fcf9c7d`. It requires a new output directory outside the repository and uses the frozen Phase 6 departure recipe by default.

```sh
git show 4b97d5e54947084629c04b4f7307c26bf98019cb:authoring/penn-station-1935/penn-station-phase5.blend > /path/to/review/before-circulation.blend
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' --with pillow==13.0.0 python penn-station-1935/model/repair_concourse_circulation.py --source /path/to/review/before-circulation.blend --out /path/to/new-external-review
```

Create the input review directory first; the output directory must not already exist. An optional `--departure-recipe` selects the same exact recipe bytes at another path. The CLI replay reproduced all four accepted raw GLBs byte-for-byte. Blender container bytes can differ with the saved filepath; canonical source promotion is a separate explicit operation. [Backup and original hashes](../../authoring/penn-station-1935/review/phase7/circulation/source-history.json) retain the immutable input and selected review scene. Large source rasters, raw GLBs and scene duplicates stay in persistent external work.
