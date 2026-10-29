# Pennsylvania Station — geometry revision 2

This Blender source reconstructs the original station from the architects' drawings, Pennsylvania Railroad publications and the engineers'1910 construction record. Revision2 replaces flat coffer patches, a generic roof cage, uniform floor levels and five painted stair wells with actual relief, source-based steelwork and connected circulation. Remaining uncertainties are identified individually below.

The browser consumes exported glTF geometry; it does not construct the station from JavaScript primitives. The compressed editable scene belongs at repository-root `authoring/penn-station-1935/penn-station-phase2.blend`, separate from runtime assets. The parent pipeline documents materials, lighting, compression and browser validation.

## Rebuild and review

```sh
uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/build_station.py --out /tmp/penn-station-review --no-context
```

`--out` writes all raw GLBs, nine fallback material maps, a compressed editable `.blend` and `scene-manifest.json` into a review directory. It leaves delivered app models untouched. Without it, raw geometry goes to app assets and the editable scene to the repository's `authoring/` folder. Run the parent lighting/compression pipeline before promoting raw output.

`--no-context` omits superseded unverified neighbours, street lamps and outside road/sidewalk surfaces. Station foundations, entrances and arcade paving remain; authenticated surroundings are separate assets. `--hall-only` limits GLB export, while still authoring a consistent common scene. `--only concourse` preserves the exterior and waiting-room exports while updating concourse and linked platform assets; add `--preserve-platform` for an architectural correction that leaves that representative bay untouched. `--only core` exports the three architectural chunks while preserving the existing platform GLB.

Geometry Nodes retain the repetitive Doric colonnades. Static geometry is batched by material; structural members use actual swept profiles and masonry has bevelled arrises. UV0 is `ArchitecturalUV`. Painted structural iron is dielectric; exposed running metal has its own metallic material. The independent lighting atlas uses another UV channel. Six separate mural planes have normalized UV0 coordinates for authenticated reproductions.

## Coordinates and levels

Units are metres. Blender uses X east, Y north and Z up. glTF uses X east, Y up and Z south.

- `model-exterior.glb`: street=0. Its waiting-room lantern is already lowered4.2672m; entrance colonnades and arcade stay at street level.
- `model-waiting-room.glb` and `model-concourse.glb`: main passenger floor=0. The browser translates both by Y=−4.2672m.
- The compressed editable `.blend` is saved **after** raw export, with waiting-room, concourse and platform collections lowered4.2672m. All collections therefore open in the same common world as the browser. Scene property `main_floor_world` records−4.2672; do not apply that translation a second time when rendering the editable scene.
- Manifest walkable rectangles, stair endpoints and floor values are explicitly WORLD coordinates after those translations. Architectural dimensions remain relative to Main=0.

The14ft working street/main drop reconciles streetE334 in the original section with the later floor drawing nearE320. Small gradients and Seventh Avenue curb registration remain qualified. The waiting room and main concourse share a level. The east stair's published width is39ft6in. Its28 six-inch risers and300mm treads reconstruct that working drop; the original exact riser count is not independently established. Physical threshold floors and walkable permissions connect the hall, stair, loggia, arcade and concourse passage.

Exit is provisionally10ft6in below Main, derived from lift travels and qualified against a later plan's circa10ft difference. Platform height is independently anchored: Gibbs specifies New York platform edges3ft10in above rail. With railE290ft10⅛in and MainE320, rail is−8.886825m and platform−7.718425m relative to Main. Do not derive platform elevation from the conflicting lift travel.

## Evidence and implementation

| Feature | Primary anchor | Revision2 geometry |
| --- | --- | --- |
| Waiting-room boundaries | PRR; Francis&O'Brien pp188/194 |277×103ft clear;314ft4×108ft8 room;320×112ft10 frame;325×119ft external lantern. These are different datums. |
| Heights | PRR; architects' section; Francis&O'Brien p194 | The model retains the150ft public room-height envelope. The engineering paper instead gives143ft to the highest ceiling; that source/datum discrepancy is unresolved.167ft Main-to-roof and153ft above the working street level are consistent. |
| Colossal order | Architects' plates302/310 | Eight fluted Corinthian columns; granite shafts use a distinct material from the travertine wall facing.48ft shaft,3ft3in base,8ft3in capital,9ft4in pedestal;13ft5in entablature. Overall order top20.9804m. Separate projecting imposts sit over the individual columns; a continuous band must not cut across the mural fields. |
| Smaller order | Plates308/310 |30ft Ionic base-to-capital order; actual scrolls, echinus, abacus and trabeation. Unlabelled pedestal reconstructed photographically. |
| Upper windows | Plate302; PRR1910p12 | Three lunettes per long wall, one per end,33ft4in radius. Each has FIVE primary lights, stone reveals and finer glazing bars. The section's E421.25 control crosses the exterior clock centres near the sill; the precise glazing-to-control offset remains a photographically registered approximation. |
| Long-wall bays | Plate302 | Central axial bay has19ft3in-radius lower arch. Outer bays have rectangular recessed mural fields over ticketing screens. |
| Vault | Plates302/306 | Octagonal pockets in square framing, with five actual levels of moulding, bevel, deep returns and curved backs. No dark decal substitutes for depth. |
| Mural fields | Pencil Points October1920p27 | Six25×70ft Guérin railway-map fields. Neutral receiving surfaces replace no artwork with generic paintings. |
| Concourse roof | Francis&O'Brien pp197–200, platesLXIX/LXX | E–W barrel N–S spans85ft10,95ft4,85ft10 intersect98ft N–S barrel. Overall320ft N–S×210ft11 E–W; crossing barrel is asymmetrically positioned. |
| Concourse structure | Same engineering record |3ft square principal piers from four8in angles, double lattice on four faces and ten-foot diaphragms; arch webs2ft apart,2ft crown depth and about6ft7in haunch depth;12in I-purlins. |
| Secondary structure | Sections and monograph photograph | Curved double-web groin ribs, fine glazing frames, groined Guastavino cloisters and lower double-lattice ornamental arcades on north, south and west. The11-bay west chain is taken directly from plateLXIX. Known adjoining accommodation closes their outer backs; unverified shop fronts are not invented. |
| Circulation | Gibbs pp240–244, plan243 | Nine traced east stair heads, real floor cutouts, receiving landings, linked exit strip and lower dogleg flights. Individual platform-number mapping is not certified. |
| Platforms | Gibbs p261, plateLXXVIII | Eleven original platforms; edge3ft10in above rail and5ft3in from track centre. A representative bay must use these offsets without claiming the entire21-track layout. |

The separate `model-platform.glb` registers one linked platform at Z11, spanning X−85…25m. Its14ft width and longitudinal assignment are representative, while the3ft10in rise and5ft3in rail offset are primary anchors. Track centre Z7.2662 matches the rolling-stock group's normalized rail centre. The track has a modelled head/web/foot profile,33ft joints, six-hole joint bars, one-inch bolts and embedded timber support blocks. Gibbs p306 explicitly puts smooth concrete-base track adjacent to station platforms; generic ballast and full-length exposed sleepers are not substituted here. Minute running-rail cross-section dimensions remain an interpretation of the100lb Pennsylvania type.

The whole-building784×430ft nominal envelope remains distinct from another period passage's788ft9×430ft6 outside-edge wording.

## Primary sources

1. **McKim, Mead & White, monographIV (1915), plates300–310.** [Public-domain Getty/Internet Archive scan](https://upload.wikimedia.org/wikipedia/commons/b/b3/A_monograph_of_the_work_of_McKim%2C_Mead_%26_White%2C_1879-1915_.._%28IA_gri_33125006526038%29.pdf). Plan300, section302, photograph306, order photograph308 and dimensioned details310 were visually inspected. Section302 corrects both five-light windows and different central/outer wall bays.
2. **Pennsylvania Railroad, Pennsylvania Station in New York City (1909/1910).** [Library of Congress scan](https://tile.loc.gov/storage-services/public/gdcmassbookdig/pennsylvaniastat00penn/pennsylvaniastat00penn.pdf). Numerical room, arcade and exterior-order descriptions. The340×210ft concourse description includes an adjoining court; it is not the enclosed roof span.
3. **Francis&O'Brien, Certain Engineering Structures, ASCE Transactions69 (1910), pp152–225.** [Primary paper](https://doi.org/10.1061/TACEAT.0002221). Relevant pp188,194,197–200 and platesLXIX/LXX. E356ft5in truncates columns in the roof section; it is not the passenger floor.
4. **George Gibbs, Station, Track, Yard, and Tunnel Equipment, ASCE Transactions69 (1910), pp226–387.** [Primary paper](https://doi.org/10.1061/TACEAT.0002223). Circulation pp240–244, platform specificationp261 and plateLXXVIII.
5. **NYC Municipal Archives.** [Original elevations and1936 photographs](https://www.archives.nyc/blog/2024/6/7/re-discovering-the-old-pennsylvania-station). Later Gibbs&Hill drawingD-4088/2 qualifies the working floor/rail registration rather than forcing lift travel into a platform elevation.
6. **Pencil Points, October1920, Guérin profile, printedp27.** [Period journal](https://www.usmodernist.org/PA/PP-1920-10.pdf). Six25×70ft perspective railway maps, including Lines West of Pittsburgh and Lines on Long Island. Its unrelated Lincoln Memorial artwork must not be substituted.

## Specific reconstruction limits

- Octagonal coffer topology is evidenced. Exact pocket count,360mm relief and tiny moulding profiles are reconstructed from photographs, not a complete carving schedule.
- Acanthus, volutes, concave abaci, Ionic scrolls and ashlar relief interpret authenticated orders; they are not scans of surviving fragments. Monumental overall heights are independently dimensioned.
- The six mural-field dimensions are published. Complete authenticated imagery and original colours of every map are not established; neutral fields honestly preserve their locations.
- Principal concourse spans and structural roles are measured. Minor glazing pitch, rivet spacing, angle thickness and every fabrication splice are not individually certified.
- The concourse cantilever spring and glazing valley are different levels: plateLXX labels E367ft3in and E393ft6in respectively. The main glazed vault/valley system stays above the latter; the lower west perimeter roof descends toward adjoining accommodation. Exposed structural arches continue down to their bearing branches. Lower ornamental arch rises and tile-groin profiles are traced interpretations, rather than a complete Guastavino fabrication survey.
- The north–south barrel's lower arch-foot registration remains inferred from its elevation; E356ft5in is a truncated drawing baseline and must not be represented as the passenger floor or an independently verified spring datum.
- The nine east stair heads are evidenced. Individual shaft dimensions, exact longitudinal registration and platform-number association are qualified. Peripheral LIRR access and floor extensions must not be described as nine identical interior stairs.
- Minor floor gradients, exact curb registration and the relationship between277ft clear floor,314ft4 room ends and end porticos need a registered survey comparison. The exit-floor difference has its own recorded uncertainty.
- Ticketing changes, advertisements, furnishings and operational signs during1935–1940 are not fixed by opening-day records. Do not invent timetables or describe every furnishing as dated1935.

Use matching-view primary photographs, exported dimensions and actual browser screenshots for further review. A finished interactive exhibition is distinct from a certified1:1 survey model; neither photorealism nor exactness should be claimed without corresponding evidence.
