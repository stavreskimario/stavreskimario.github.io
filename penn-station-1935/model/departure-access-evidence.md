# Departure stairs: Phase 6 source correction

This correction replaces the nine reversed upper flights and unsupported shared Exit-floor/U-dogleg route with court-facing departure entries and three straight eastward flights to the existing platforms. It is a qualified reconstruction of opening-era circulation, not a surveyed stair schedule or a certified 1935 arrangement. The exact [recipe and review receipts](../../authoring/penn-station-1935/review/phase6/departure-access/) distinguish primary evidence, chosen dimensions, source geometry and browser checks.

## Primary evidence

Gibbs' 1910 passenger-circulation account and Main/Exit plans distinguish departures from arrivals: departing passengers descend from Main gates to their platforms; arriving passengers use separate stairs to a narrower Exit concourse. Figure 2 on printed p.243 establishes the eastern departure heads, while Figure 3 on p.244 describes the separate arrival corridor. See [the original ASCE volume](https://archive.org/details/transactionsofam69amer) and [Gibbs' paper](https://doi.org/10.1061/TACEAT.0002223).

The Pennsylvania Railroad's original booklet describes gently inclined stairs from Main gates to individual platforms; its platform photograph shows straight flights with intervening landings. It does not certify the implemented flight or riser counts. See [the original booklet](https://archive.org/details/pennsylvaniastat00penn), PDF pp.27–28 and33.

The [Detroit Publishing east-wall photograph](https://www.loc.gov/item/2016815390/), digital file `det.4a23718`, corroborates court-facing paired indicators with the stairs descending behind toward the eastern wall. Negative number `071935` is not a 1935 date: the catalogue dates the photograph broadly between1905 and1915. Gibbs p.256 supports ornamental cast iron/steel stair and fence work; the pale tread finish and small profiles remain interpreted.

## Implemented interpretation

| Control | Current source | Qualification |
| --- | --- | --- |
| Direction and routes | Main court → western gate → eastward departure stairs → platform | Separate arrival circulation is retained as unfinished work. No departure landing joins the provisional Exit deck. |
| Flights and risers | Three flights of15 risers:45 per row; each flight runs5.05m and drops2.572808m | Construction subdivisions chosen to reach the established platform level; not original riser measurements. |
| Width and landings | 2.0m clear width;2.25m Main opening; two1.2m intermediate landings | Minor dimensions are inferred. The real platform provides the final receiving surface, without a duplicate landing slab. |
| Registration | Stair gate X−48.40; indicator assemblies X−48.20 | Nominal plan reading suggests approximately X−50.0. Its roughly1.6m difference from the adopted gate remains unresolved. The adopted position preserves the existing structural-pier grid rather than clipping its bases. |
| Vertical datum | Main worldY−4.2672; platform nominal worldY−11.985625 | Existing independent track/platform registration remains. Departure landings are independent of the provisional Exit datum. |
| Main floor | Four closed infill strips per old opening, preserving the surrounding slab and prism field | Central axial marble remains separate from its buried concrete bedding. No broad floor remesh or new prism extent is claimed. |

Indicator shafts, cabinets, cards and numerals move together. The final0.20m indicator-only adjustment preserves their intrinsic positions, normals, UVs and topology; all1,904 other module primitives remain exact. The new dark guards use the painted-iron material family. Cards remain unassigned and existing track-number interpretation is not a verified 1935 operating schedule.

## Geometry, navigation and remaining limits

The source replacement removes441old tread components,27landings,54stringers,684stair/fence components and the old indicator assemblies. The retained portions of the affected source batches preserve their corner positions, normals and UV layers;5,034unrelated source objects remain exact. The editable file keeps the established common world coordinates and filename. [The integration receipt](../../authoring/penn-station-1935/review/phase6/departure-access/source-integration.json) identifies the new scene, verified previous input and persistent backup.

Actual raw and optimized triangle checks cover all nine local approaches and18down/up routes, with a0.32m body radius and1.85m body-height envelope. The sampled minimum headroom is approximately1.962m at the Main slab lip; the first landing centre has approximately2.133m. These are scoped geometry results, not building-code certification. Platform3 remains narrow: a stricter0.37m comfort-radius approach fails even with its indicators omitted. No further post drift was selected to conceal that structural limitation.

Platforms1/2 have usable local stair approaches, but the retained transverse wall still blocks the tested Main-court crossings toward those peripheral heads. This correction does not establish uninterrupted access to every platform from the central court. The old arrival/Exit deck and its22platform-light supports remain provisional; the separate source-registered arrival corridor/stairs have not been reconstructed.

The archived earlier Platform5 browser harness used a camera-only initial preset, normal six-zone shaders and real W/S descent/ascent. It predates final floor-contact and synchronous UI wiring. Its [compact receipt](../../authoring/penn-station-1935/review/phase6/departure-access/earlier-p5-browser-review.json) retains actual source/bundle identities, endpoints and nonzero blocked/aborted-request counts. It is not final production-bundle or deployment acceptance. The parent validation pipeline records those subsequent checks separately.

## Lighting and reproduction

The access module has its own64-sample,2048px diffuse atlas, separate AO and512px fallback. `lighting-concourse-access-*` is separate from the retained older concourse, waiting-room and roof lighting maps. This correction does not publish the unaccepted roof-filtering experiments or claim a new whole-station illumination pass.

`build_station.py` remains the older broad authoring baseline; running it alone does not reproduce this scoped departure correction. Run [repair_departure_access.py](repair_departure_access.py) against the exact previous Blender input recorded in the integration receipt, with the archived final recipe and decompressed census:

```sh
git show f7f4c23a68e8c59884a61ef48c048b85446d9a60:authoring/penn-station-1935/penn-station-phase5.blend > /path/to/review/penn-station-phase5-before-departure.blend
gzip -dc authoring/penn-station-1935/review/phase6/departure-access/old-access-batched-census.json.gz > /path/to/review/old-access-batched-census.json
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' --with pillow==13.0.0 python penn-station-1935/model/repair_departure_access.py --source /path/to/review/penn-station-phase5-before-departure.blend --recipe authoring/penn-station-1935/review/phase6/departure-access/layout-recipe.json --census /path/to/review/old-access-batched-census.json --out /path/to/review/rebuilt-departure
```

Use a separate review directory and verify the recorded input hashes. The previous source is recoverable from its immutable Git commit; the full raw GLBs, scene comparisons and browser images remain in the persistent Desktop work directory rather than duplicated in the public evidence archive. Geometry reproduction and source proofs remain separate from material compression, lighting and final browser acceptance.
