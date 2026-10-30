# Phase 7: concourse circulation evidence audit

30 October 2026. Read-only architectural research for the checkpoint following source commit `4b97d5e` / runtime `b31036f`. This is an adapted archival copy of the original external research note. It does not authorize moving the structural grid, publish a complete 1935 circulation layout, or certify dimensions read from a raster.

## Immediate conclusion

Restore the eastern **open intervals between retained piers** at the southern Main-court boundary. Do not shift the entire 320ft roof to enclose Platforms1/2, remove the western rooms/street-stair compartment, or connect the departure stairs to the provisional arrival deck. The continuous ground-level stone belt currently across the whole southern boundary conflicts with the eastern open intervals shown in Gibbs Fig.2.

The two southern departure heads genuinely lie outside the central roof/court envelope. Their Main-level circulation is not evidence that the high glazed roof continued over them. The current physical roof/sidewalk coverage must be checked separately before claiming complete enclosure.

## Existing source IDs and primary controls

| ID | Primary evidence inspected | Relevant controls |
| --- | --- | --- |
| S9 | A.J. Francis and C.S. O’Brien, ASCE69 (1910), paper1164, printed pp197–200, platesLXIX/LXX. [Original paper](https://ascelibrary.org/doi/10.1061/TACEAT.0002221), [original volume](https://archive.org/details/transactionsofam69amer). | Three E–W barrel spans85ft10,95ft4,85ft10; N–S cross-barrel98ft; roof overall320ft N–S. Main columns described on p198 as3ft square, made of four8×8in angles. |
| S10 | George Gibbs, ASCE69 (1910), paper1165, printed pp240–244,252,259–262; plateLXXXIV. [Original paper](https://ascelibrary.org/doi/10.1061/TACEAT.0002223), [original scan PDF](https://archive.org/download/transactionsofam69amer/transactionsofam69amer.pdf). | Fig.2 Main/Waiting-room-level plan, printed243 / PDF427; Fig.3 Exit-level plan, printed244 / PDF428; dimensions table printed252 / PDF438; photograph plateLXXXIV / PDF439. |
| S6 | Pennsylvania Railroad, *Pennsylvania Station in New York City* (1910). [Library of Congress scan](https://tile.loc.gov/storage-services/public/gdcmassbookdig/pennsylvaniastat00penn/pennsylvaniastat00penn.pdf), [archive catalogue](https://archive.org/details/pennsylvaniastat00penn). | PDF27–28 describes gated departure stairs terminating on each platform and the distinct intermediate arrivals/Exit concourse; PDF33 shows straight platform stairs with landings. No printed riser or flight counts. |
| S36 | Detroit Publishing, LOC2016815390, negative071935, digital `det.4a23718`. [Item and rights](https://www.loc.gov/item/2016815390/). | Court-facing paired indicators and perimeter stair fences. The negative number is **not** the date1935; catalogue1905–1915. |
| S24 | Berenice Abbott, NYPL58514805, catalogue1930–1939. [Archive item](https://old-digitalcollections.nypl.org/items/434b8be0-eb3c-013a-9d4c-0242ac110003). | Target-decade context for layered stairs, piers and bridges; does not establish the exact southern connection or every gate number. |

The source numbering above follows the **current** repository ledger, where the Detroit concourse image is S36. Older scratch notes calling it S37 are superseded.

## Orientation and registration

In both Gibbs plans, image top is west/Eighth Avenue, bottom east/Seventh Avenue, left south/31st Street, and right north/33rd Street. Coordinates below refer to the unrotated **2462×4000** direct render `phase5-stair-evidence/gibbs-243-full-4000.png`; they must not be applied unscaled to the older2116×3439 raster.

The visible southern and northern central court/room limits are approximately U604 andU1762. Their midpointU1183 coincides with the central axial passage nearU1182. This is consistent with the adopted court centred approximately at worldZ0. The first two eastern stair-head centres are nearU356 andU524, south ofU604. No plausible sub-metre registration adjustment places both inside that court. This is **not** an independent survey of the curtain wall or facade; it is sufficient to reject moving the whole court several metres to make all nine heads fit.

The prior local scale is95.8088m /1158px =0.0827364m/px, based on the314ft4 room control. Scale, line thickness, raster distortion and the exact finished-face control limit precision. No minor stair/door dimension in this note is a printed dimension.

For a provisional comparison to the preserved world, use the previous east ordinary wall face control V1543→worldX−41.13111:

`X = −41.13111 + (V −1543) ×0.0827364`

This conversion is a working overlay, with **at least±0.75m** uncertainty. It does not resolve the already-recorded approximately1.6m departure-gate/pier registration difference.

## Southern connection: what Fig.2 supports

The relevant boundary is around U604. The plan is not a continuous masonry partition along that whole line:

| Native V range at U≈604 | Approximate worldX | What is actually drawn |
| --- | ---: | --- |
|805–1100|−102.2…−77.8m|Enclosed western rooms with heavy wall lines. Preserve them. |
|1200–1360|−69.5…−56.3m|Street-stair/vestibule compartment and its enclosing returns. Preserve the compartment pending a full stair trace. |
|1380–1540|−54.62…−41.38m|Open intervals with isolated piers; no continuous heavy wall line across these eastern intervals. This is the source-supported connection region. |
|Pier near1460|about−48.0m|Retained pier interrupts the connection. The source does not support one uninterrupted opening across that pier. |

The exact opening jambs, clear widths, stone profiles and overhead shape remain reconstructed. Any candidate should retain the existing load-bearing grid and use actual body/headroom checks; matching this approximate overlay alone is not acceptance. The small plan marks below the cut and thin projection lines must not be mistaken for continuous solid walls.

The mechanically cropped research images remain in the external work directory and are not duplicated here. Exact crop rectangles, original coordinates and hashes are recorded in [research-sources.json](research-sources.json). The original ASCE scan linked above remains the primary source; enlargement and grid overlays add no detail.

## Floor extents, cover and elevation

Gibbs printed252 distinguishes a340×210ft **court**,475×125ft **Main concourse floor**, and480×60ft **Exit concourse floor**. The engineering roof has a distinct320ft structural span. These are different controls, not interchangeable dimensions. The source therefore supports peripheral Main-level circulation beyond the high court, but does not establish a centred rectangular475ft slab with identical cover on both ends.

The building's reported N–S width is430ft. A floor longer than the building is consistent with under-street continuation; Gibbs p242 explicitly connects both concourses at their respective levels to a two-deck33rd Street passage. Francis printed168–169 describes the lower33rd Street viaduct deck as part of Exit, and an entrance-concourse gallery15ft wide×457ft long. These northern facts must not be mirrored automatically to31st Street.

At P1, runtime measurements put the approach under the actual sidewalk underside, approximately4.115m above Main, rather than open sky. This is an **application measurement**, not a primary ceiling dimension. No exact31st Street peripheral ceiling height has yet been extracted. Keep the working street/Main14ft registration separate from local beams, slab depth, gradients and the reported11ft Exit height. Gibbs’s table does not explicitly identify that11ft as clear height or floor-to-floor height.

Working assembled levels remain streetY0; MainY−4.2672; provisional ExitY−7.4676; platformY−11.985625; railY−13.154025. Platform3ft10 above rail is independently supported by Gibbs261. The Exit/Main10ft6 drop derives from the difference between the published27ft6 and17ft lift travels; conflicting absolute rail/floor datums prevent treating those travel lengths as a complete surveyed vertical section.

## Platform3 and the principal-pier section

Francis printed198 calls the principal columns3ft square, with four8×8in angles and four-sided double lattice. A4ft4 overall angle envelope around a nominal3ft lattice core is inconsistent with that description. The section elevations on platesLXIX/LXX do not provide a sufficiently clear angle cross-section to certify corner-leg rotation by themselves. Mechanically reconcile the angle orientation to the stated3ft envelope, while retaining column centres, height, attachment points and the lattice frame. This supports investigating the source profile rotation before shrinking or moving a real pier to improve Platform3 access.

The exact Platform3 gate clear width and card/post setbacks are not printed in Fig.2. Prior0.32m and0.37m body-radius results are scoped application tests, not evidence that the original platform was inaccessible or a historical accessibility standard.

## Separate arrivals: verified topology, incomplete geometry

Gibbs242 identifies the lower Exit concourse as narrower than Main and fed by separate stairs on both sides from each platform. The PRR booklet independently describes the intermediate concourse as an exit route, connected to platforms by short stairs/elevators. Fig.3 draws a longitudinal N–S corridor, transverse to the E–W platform tracks, with access along **both** its eastern and western edges. It does not support one identical U-dogleg shared with every Main departure stair.

A preliminary translation of Fig.3 into Fig.2 of approximately(+51,+75)px places that corridor aroundX−72…−54.4. This is schematic registration, not a certified60ft corridor placement. The current provisional deckX[−55.2563,−47.7563] is much narrower and farther east than that preliminary reading; do not silently call it the reconstructed arrival corridor. A second registered trace is required before replacement.

Gibbs259 numbers tracks from the south and documents11 platforms/21 tracks, including separate Long Island arrangements. The nine Main eastern heads are **not explicitly numbered** in Fig.2. Their mapping to Platforms1–9 is the existing raster registration against plateLXXVIII, not a labelled gate schedule or proven1935 operating assignment. No new platform numbering or complete1935 arrival inventory is established here.

The closed eastern end of the Main stair symbol and contemporary photos support perimeter fencing at the stair void. A rear guard is source-consistent; its height, fabrication and small profile remain reconstructed. Guarding must be coordinated with the actual opening, railings and supported floor.

## Rights, reproduction and limits

ASCE1910 and the PRR1910 booklet are US public-domain publications; the archive catalogue labels the latter NOT_IN_COPYRIGHT. The Detroit item reports no known restrictions. The current work reuses those authenticated scans; no modern station or Moynihan plan is substituted. The crops are mechanical research aids, with no invented, generative or inpainted content. Full scans remain in external work. Source hashes, crop rectangles and links are in [research-sources.json](research-sources.json).

All supported layout findings describe opening-era evidence. The Abbott target-decade photo provides limited corroboration; unchanged1935–1940 retention of every compartment, stair, sign and sash remains unverified. No claim of a1:1 replica is justified.
