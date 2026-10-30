# Eastern platform-access stairs: layout review

Review date: 30 October 2026. This is a research and measurement checkpoint, not a delivered stair repair. The live `5-stone-1` geometry remains unchanged.

Compact [historical registration](../../authoring/penn-station-1935/review/phase5/platform-stair-layout/historical-review.json), [geometry measurement](../../authoring/penn-station-1935/review/phase5/platform-stair-layout/geometry-review.json) and [camera review](../../authoring/penn-station-1935/review/phase5/platform-stair-layout/camera-review.json) receipts retain source, asset and capture identities. Full research rasters, raw rays and diagnostic screenshots remain in the external work directory; they are not new runtime assets.

## Historical finding

Gibbs' original main-level circulation plan, figure 2 on printed p. 243, shows nine eastern departure stair openings. The paired gate/indicator symbols are on the open-court, western ends. The original Detroit Publishing photograph of the east ticket/baggage wall corroborates that relationship: passengers enter through court-facing gates and the visible handrails descend behind them toward the eastern wall. The present model instead starts the upper flights high at the eastern, wall-facing end and descends west. Correct this direction before treating the departure circulation as historically supported.

The plan also shows space between the wall-side ends of the stair openings and the subwaiting-room wall. The model's `STAIR_HEAD_X = east - 1.4` is an authored offset; it is not a printed historical dimension. An independent reading of a 4,000 px PDF render gives approximately 23–33 px from the wall-side stair ends to the ordinary masonry face. A separate waiting-room length control gives about 0.083 m/px, suggesting a roughly **2–3 m strip away from projecting piers**. This is a raster interpretation, not a printed dimension or a construction-ready offset. A photographic perspective or this preliminary range must not be promoted into a surveyed dimension.

Sources:

- George Gibbs, ASCE Transactions 69 (1910), figure 2, printed p. 243 (scan PDF p. 427); exit-level plan p. 244 and plate LXXXIV provide additional circulation context. [Original volume](https://archive.org/details/transactionsofam69amer), [original paper](https://doi.org/10.1061/TACEAT.0002223).
- Detroit Publishing Company, *Concourse, Penn. [Pennsylvania] Station, New York, N.Y.*, LOC item 2016815390, digital file `det.4a23718`, negative `071935`. [Original catalogue](https://www.loc.gov/item/2016815390/). The catalogue dates the image broadly 1905–1915: **071935 is a negative number, not a 1935 date**. The photograph supports opening-era direction and gate/wall relationships, not an independently verified complete 1935 arrangement.

## Actual delivered geometry

Measurements use decoded full and low models with the application's world transforms. They distinguish opaque enclosure from stair guards, handrails and indicator posts. The two variants agree on the reported wall clearances.

| Condition | Measured result | Limit of the result |
| --- | --- | --- |
| Upper head to opaque east stone, heads 3, 4, 5, 7, 8 and 9 | Approximately 1.125 m, from head X −42.25630 to stone face X −41.13111 | Recessed window-centre backing can be farther away; lower and flank stone still limits the strip. This is current geometry, not a historical dimension. |
| Head 6 | Opens into the axial-passage area | No comparable opaque back-wall hit within the tested range. |
| Heads 1 and 2 | Outside the 320 ft glazed court enclosure | An absent nearby wall does not certify complete peripheral circulation. |
| Lower doglegs and landing centres | No opaque enclosure immediately terminating the sampled approaches | Sampled local clearance does not certify the whole landing or its historical configuration. |
| Lower turning-landing overhead clearance | Approximately 1.960 m at all 225 inset grid samples per variant; the exit-floor slab is the first overhead hit | Actual tread undersides and iron/bronze fittings also competed for the first hit. The result follows the working exit datum and dogleg arrangement; it is not an original dimension or a full body-volume certificate. |
| Platform receiving-landing overhead clearance | Minimum approximately 4.155 m beneath an iron fitting in the sampled grid | This is measured local geometry rather than historical placement evidence. |

Two further circulation observations need coordinated review: subsidiary masonry leaves approximately 0.756 m at the sampled ends beside the source stair-opening line, and the present transverse wall at world Z approximately 48.493 m blocks every tested direct Main-floor crossing toward the two peripheral positive-Z heads. Those samples do not rule out every alternative route, but local support at the stairheads must not be represented as proof of an uninterrupted approach.

The upper-flight source starts at world Y −4.2672 m and runs westward 5.7 m to the provisional exit datum Y −7.4676 m. Its high end is currently X −42.2563 m. The lower switchbacks are interpreted connecting geometry; their exact original layout remains to be established against the exit and platform plans.

Current full transport identities:

- `model-concourse.glb.gz`: SHA256 `7e011b54a922e0092a6b91540b97fa3c46eac21ed764a60e79a8571a72f44748`.
- `model-platform.glb.gz`: SHA256 `2a535ab684efe1a7c42fa95262e4c0fe1bcc9aaee6dbfcdb8deeb0af4c2661eb`.

Actual six-zone Chrome captures were reviewed at the upper head and lower dogleg using camera-only diagnostic poses and the current materials, shadows and lighting. They show the narrow upper wall-side approach and a physical lower platform connection. The lower view partly obscures the turning landing and shows unfinished distant platform enclosure; neither condition is evidence of the original station's arrangement. These captures are not ordinary UI presets or performance benchmarks.

## Required correction and acceptance

Reconstruct the court-facing departure entries and correct flight direction from the primary plan/photo relationship. Register the wall-side margins, then reconcile the lower flights, receiving landings, slab openings, fences, gate indicators and all affected walkable bounds together. Check peripheral access to the two heads outside the glazed court and actual overhead obstructions across the lower landing footprints. Do not implement the correction as an isolated stair translation or mirrored tread mesh.

Preserve the established track/platform elevations and distinguish an opening-era reconstruction from a surveyed 1935 layout. Validate the assembled Blender geometry, both delivered model variants, matching normal browser views, and actual walking down and back up after rebuilding. Earlier point-support tests establish local support at their sample points; they do not authenticate the original layout or certify every connecting route.

The room is the original Pennsylvania Station train concourse. Moynihan Train Hall is the modern hall in the Farley Post Office across Eighth Avenue, opened in 2021; its layout is not a source for this reconstruction. [Amtrak's opening account](https://media.amtrak.com/2020/12/a-virtual-tour-of-amtraks-moynihan-train-hall/).
