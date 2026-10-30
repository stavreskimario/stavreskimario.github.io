# First eight ordinary arrival pairs

This source checkpoint reconstructs a separate platform-to-Exit route for the first eight ordinary platform correspondences. It does not complete P9, the Long Island arrangement, the streetward exits or the western Main floor correction.

Gibbs' Fig.3 and the Exit-stair photograph in plate LXXXIV, corroborated by LOC071937, support arrivals from both corridor edges, two aligned straight flights, a flat intermediate landing, solid stringers, landing posts and open ornamental metal guards. These arrivals are independent of the Main departure gates. The plan does not print the current model's individual platform numbers.

The adopted corridor width is the printed 60 ft / 18.288 m. Working X [−73.2, −54.912] retains at least ±1 m absolute registration uncertainty. The Main-to-Exit difference of 10 ft 6 in / 3.2004 m is corroborated by the northern plate LXI section; the southern section has a slight grade difference. The adopted platform absolute datum remains a separate qualified control. The source's 480 ft length and 11 ft table entry are not treated as a centred rectangle or universal clear ceiling.

The working module ends near source southern Z +71 and at a temporary northern research boundary Z −36, between the eighth and unresolved ninth row. Its end guard is a research/safety limit, not an authenticated historic partition.

## Reconstructed details and retained limits

Each of the sixteen stairs has 14 + 13 risers and 13 + 12 internal goings of 284 mm, plus a 1.2 m landing, within an 8.3 m envelope. Those counts, dimensions, profiles and the 2 m nominal clear width are inferred. The source supports the architectural family, not this exact fabrication schedule. Pale tread stone and the neutral Exit floor appearance remain interpretations; complete Exit marble or granolithic finishes were not verified.

Forty-seven lower supports retain individually traced source positions. C014 and C025 are held because their straight lower paths violate the adopted track-clearance envelope. The source includes irregular support and lift arrangements; no regular four-column family was cloned across all rows, and no railway or original structural grid was shifted. Gibbs' description supports the grouted steel jacket to 8 ft 6 in above platform, with concrete above. The 320 mm bodies, 500 mm bases, 460 mm caps, 480 mm framing and 300 mm slab remain inferred sections, not structural certification.

Twenty-one upper continuations reach an actual opaque Main underside across their complete sampled cap footprints. Twenty-six upper/transfer cases remain held. No cap is placed on an assumed −440 mm plane below glass, and an 85 mm vault-light web is not treated as a certified structural bearing. Physical contact establishes a modeled connection, not its historical fabrication or engineering capacity.

Eight different source lift outlines remain distinct keepouts. Their closed grille cages are visual enclosures, not functioning elevator simulations or authenticated assignments of the lifts that reached Main.

Forty-three whole old Exit cells are removed. Five northern cells remain exact; three crossing cells become closed partial northern pieces. All six old P9–11 fixture mounts retain actual support. Sixteen complete seven-part platform fixture groups receive new, interpreted positions selected against real new ceiling/girder geometry. Their exact mount and glower coordinates are recorded for both the instance transforms and the application's practical lights.

The existing Main floor/prisms, departure routes and P1/P2 peripheral connections remain unchanged. A later western Main floor cut must include the lower continuations of twenty definite and six boundary-dependent Main-based column feet. P9/LIRR registration, streetward routes, original fabrication schedules and retention of every opening-era detail in 1935–1940 remain unresolved.

## Source files and reproduction

The standalone [authoring helper](https://github.com/stavreskimario/stavreskimario.github.io/blob/f53091b456a5aed99150914b696771c5865c48b9/penn-station-1935/model/repair_arrivals_access.py) uses the exact pre-arrivals source SHA256 `f2e5a0e382b5d6771030055ed527546005cd18d2a3e2d77f204d570c0a9cc588`. It writes only into a new directory outside the repository. It does not modify the canonical scene, runtime assets or application bundle.

Run with the pinned Blender 4.3.0 Python package and NumPy below 2:

```sh
python penn-station-1935/model/repair_arrivals_access.py \
  --source /absolute/path/to/the/reviewed-input.blend \
  --out /absolute/path/to/a/new/external-review-directory
```

The default frozen inputs are in the [source-input archive](../../authoring/penn-station-1935/review/phase8/arrivals/sourceinputs/expected-inputs.json). `--inputs` can select another copy of those same pinned bytes; it does not waive their hash guards. Larger JSON files are retained losslessly as gzip and unpacked into the external output. All required geometry constructors are embedded in the helper; no Desktop prototype or historical raster is needed to reproduce the source model.

The [review archive](../../authoring/penn-station-1935/review/phase8/arrivals/README.md) preserves the chronological frozen candidate, input hashes, source/route/contact evidence and CLI replay receipt. Saved Blender containers and path-bearing proof metadata may differ when replayed into a different directory. The old-owned, new-module and retained raw geometry must reproduce their reviewed hashes exactly.

Source checks establish closure, outward winding, positive volume, finite UVs, exact retained source attributes and unchanged unrelated objects. Independent CPU route/loadpath checks are recorded separately. They do not replace final optimized browser, lighting, desktop-performance or deployment acceptance.
