# Rejected passenger prototype — excluded from release

The MakeHuman-based passenger prototype was rejected during visual review. It does **not** meet the requested anatomical, garment, face or material realism. Passenger production and promotion of this prototype are paused. Its raw GLB, blend and renders remain in `/private/tmp/penn-phase3-passengers/` for review only; none is an approved runtime asset.

The experimental `build_passengers.py` and `fetch_passenger_assets.py` are retained outside the repository in `/private/tmp/penn-phase3-passenger-experiments/`; they are not delivered app sources. The attempt used full human anatomy and fitted clothing data, but its rendered hands, poses, garment silhouettes, eye/skin treatment and hair/hat intersections were visibly insufficient. Further subdivision alone would not correct those problems.

A second, real scanned Eric figure was also rejected for this release after actual Cycles and browser review. Moulded-looking hair, stiff fingers, contemporary low-waist/slim trousers and a short waistcoat failed the current visual/period threshold. Its original licensed files and proof data remain in `/private/tmp/penn-phase3-passenger-sources/` and `/private/tmp/penn-phase3-scanned-passenger/`. Its experimental builder is retained with the other scripts outside the repository. The [interior evidence ledger](interior-evidence.md#scanned-passenger-sources-review-only) and source/rights records preserve the specific CC BY source and rejection reasons. Neither attempt is pending acceptance or promoted to the station. Realistic period passengers remain outstanding.

## Source rights

Only graphical data was fetched. No MakeHuman program source was copied into the site. [MakeHuman's official licence explanation](https://static.makehumancommunity.org/about/license.html) and the [project licence](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md) distinguish CC0 core graphical assets from separately licensed application code.

- Official base OBJ and macro targets: fixed core commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`; original OBJ header identifies CC0 and the named graphic-data authors.
- Selected official [system graphics pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html): body maps, eyes, hair, shoes and fedora, each listed CC0 in the official catalog.
- [Margaret Toigo formal-suit graphics pack](https://static.makehumancommunity.org/assets/assetpacks/suits01.html): individually listed CC0 graphical assets. The clothing pack is a modern asset, not authenticated 1930s tailoring; attempted period adaptations were new geometry interpretations.

Download provenance, fixed URLs, SHA256 hashes, ZIP-entry CRC checks and individual credits are saved in the scratch prototype's `source/passenger-source-provenance.json`, outside the served app. The original downloaded texture packs are not approved additions to the active site budget. Archive photographs used for clothing research remained linked references, not sampled textures.

## Grounding and review

The prototype's analytic per-foot and luggage grounding checks passed within 3 mm, but physical contact did not make its visual quality acceptable. No claim of photorealistic passengers, historically authenticated individuals, or approved period costume follows from those checks.

Review files: `passenger-group-review.png`, `passenger-face-review.png`, `model-passengers.glb`, `passengers-editable.blend`, `passenger-manifest.json` in the scratch directory above. These are rejected review artefacts and must remain excluded from release unless a materially revised asset is explicitly reviewed and accepted.
