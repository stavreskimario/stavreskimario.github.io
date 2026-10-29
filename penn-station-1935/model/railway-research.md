# Railway plan and physical interfaces

This is a **partial railway reconstruction from an opening-era primary plan**. It replaces the former arbitrary single platform with eleven individually shaped platforms and twenty-one station tracks. It is not a surveyed 1935 track inventory, complete switch diagram, or authenticated operating assignment. The east/west throats, tunnel junctions, storage sidings, signal system and 1935 overhead contact system remain unbuilt.

## Primary evidence inspected

- George Gibbs, “The Pennsylvania Railroad Tunnels and Terminals in New York City: Station, Track, Yard, and Tunnel Equipment,” *Transactions of the American Society of Civil Engineers*, volume LXIX (1910), especially printed pp. 259–261, 266, 269–270, 305–307 and plate LXXVIII. [Original volume](https://archive.org/details/transactionsofam69amer), [original scan PDF](https://archive.org/download/transactionsofam69amer/transactionsofam69amer.pdf). The original foldout was inspected at its native 3,698 × 1,838 pixels, scan leaf 405. The native scan and derived research crops stay in scratch; the app does not bundle the book.
- Gibbs, figure 2, printed p. 243, waiting-room-level circulation plan, and printed p. 244 exit-level plan. The p. 243 raster supplies the nine east access-head centres and axial passage control. Its heavy outside border includes under-street baggage circulation and is **not** silently treated as the station facade line.
- [Library of Congress, station interior, 1910](https://www.loc.gov/pictures/item/2018722271/): paired indicator posts, departure heads and stair fencing. This is opening-era evidence, not proof of a particular 1936 timetable or passenger population.
- [New York Public Library, Berenice Abbott station interior, catalogued 1930–1939](https://old-digitalcollections.nypl.org/items/434b8be0-eb3c-013a-9d4c-0242ac110003): lower bridge, stair and pier-foot relationships. The catalog does not establish a precise exposure day.

The ASCE text and plate are a 1910 United States publication, in the US public domain. The geometry and trace coordinates are newly authored. No protected archive watermark or modern museum photograph is used as a runtime texture. Archive-host terms and each photo's item rights statement remain linked evidence.

## Verified topology and dimensional anchors

Gibbs describes 21 tracks and 11 island platforms, numbered south to north, with mixed through and stub-end use. Tracks 1–4 physically terminate at the east end. The original text assigns tracks 1–16 normally to PRR and 17–21 to LIRR; this is an opening-era operating description, not a certified 1935 allocation.

The literal numbered platform pairs on plate LXXVIII are retained: P1 (1/2), P2 (3/4), P3 (5/6), P4 (7/8), P5 (9/10), P6 (11/12), P7 (13/14), P8 (15/16), P9 (17/18), P10 (18/19), P11 (20/21). Platforms 9 and 10 share track 18. No extra 22nd track was invented to regularize that topology.

Platform surface is **3 ft 10 in / 1.1684 m above top of rail**. The prescribed horizontal edge clearance is **5 ft 3 in / 1.6002 m from track centre**. The lower cross-section's31 ft 1 in dimension is centre-to-centre across a platform; it is not the edge-to-edge platform width. Standard gauge is modelled as1.4351 m **between actual inner rail-head faces**. The authored100 lb-type rail profile and small joint/fastening details are interpretations, not a certified mill-section drawing.

The plate's concrete under-platform construction informs the foundation and embedded supports. Rails sit on tie plates, plates on timber support blocks, and blocks on the concrete base. The platforms have plain coping without a modern yellow edge or tactile strip. The four physical eastern stops are interpreted timber/steel construction; their fabrication is not documented by a detailed stop drawing.

## Registration and unresolved evidence conflicts

`railway-plan.json` records native image coordinates and the complete method. Heavy coping edges were read at native raster columns 2305–2340; the documented 5 ft 3 in offset derives the adjacent track centres. **Outer running-rail strokes are not track centre lines.** Correcting that distinction eliminated the draft's implausibly narrow bare-track intervals. Shared track 18 averages its two neighbouring edge estimates; this leaves an approximately 7 cm edge-clearance residual in the raster, recorded rather than hidden.

The native foldout is fitted to the nine stair-head centres in the separate p. 243 plan, whose central entrance/arcade/passage axis is near image U1016 in the 2,116 px-wide working raster. This fit is a registration method, not an independent survey validation. The axial passage aligns with the sixth south-to-north head/platform 6, rather than a uniformly centred fifth head. The fitting residual is under 1 m. East-west scale uses the working Seventh/Eighth Avenue axes derived from station setbacks and avenue widths. Facade bounds, street house lines and avenue centres are distinct controls.

Individual segmented asymmetric platform ends are manually traced envelopes; rounded coping profiles, exact end stations and centimetre fabrication remain uncertain. Allow approximately 3 m uncertainty at the interpreted tips. The two outer southern access heads are peripheral to the 320 ft glazed concourse rather than nine identical heads forced within that roof.

The written account gives rounded platform widths 20–40 ft and lengths 750–1170 ft. Several native outlines, especially narrow P9 and broad P10, remain outside that range after calibration. Some interpreted end lengths also conflict with the written range. **No evidence labels the plate an earlier revision.** The model preserves its named topology and documents this conflict; it neither invents a revision date nor stretches every row into the narrative range. Exact widths/ends need a second dimensioned track-level drawing before being described as verified.

Through tracks are straight partial station sections. Their switches and the western yard throat are deliberately truncated. Tracks 20/21 extend with the northern platform envelope. These continuations are not a claim that the original east fan consisted of parallel straight lines.

## Levels and integration

glTF axes are X east, Y up, Z south, in metres. The raw chunk uses Main=0 and requires `[0, −4.2672, 0]` translation. Rail localY=−8.886825; platform localY=−7.718425. Therefore world railY=**−13.154025** and platformY=**−11.985625**. These inherit the parent scene's working 1926 rail elevation and street/main datum; the exit-level uncertainty remains documented in the architectural ledger.

The suggested existing train placement is track 10, Z=**8.690045261m**, wheel tread at worldY=−13.154025. The train's authored local X positions remain unchanged. Flanges intentionally project below the railhead; wheel contact is established at the tread, not the lowest flange bound. Coach floor 1.1684 m above the tread meets the high platform surface. This selected class-level consist is not an authenticated track assignment.

All nine lower stair landings fit the common straight platform interval **X [−95, 35] m**. Exact platform polygons and each centre are in `railway-manifest.json`. The narrowest P9 polygon is approximately 3.95 m wide; a 3.3 m landing fits within it, with about 0.3 m lateral margin. The core author is responsible for the connecting stair source and final interface collision audit.

## Lighting and actual support

Gibbs printed 269 specifies platform Nernst units about 20 ft apart, mounted as high as local conditions allow. Printed269–270 describes exposed oxide glowers and downward light without reflectors. The authored units therefore have small exposed glowers rather than invented vacuum bulbs, reflector floodlights or hundreds of dynamic lights. Housing dimensions and emission strength 30 are visual interpretations, **not historical photometry** or proof the same fittings remained in 1935.

The default build places two units per platform at X −54.5 and −48.404 m beneath the core's confirmed solid exit-floor strips. Fixture top local Y=−3.5004 exactly meets that slab underside; the platform-to-mount height is 4.218025 m. No full platform roof is invented to carry them. `--support` accepts raw Main=0 core GLBs: fixtures are instead sampled every 20 ft, cast upward against actual opaque floor/deck/landing geometry, and omitted when no real overhead support is hit. Every included placement, supporting object, mounting height and omitted candidate is recorded in the manifest. Tiny iron, rails and fixture materials have `skip_lighting_atlas=true`; platform/concrete surfaces remain eligible for the parent's light bake.

## Reproduction and checks

```sh
UV_CACHE_DIR=/private/tmp/penn-uv-cache uv run --no-project --python 3.11 \
  --with bpy==4.3.0 --with 'numpy<2' python \
  penn-station-1935/model/build_railway.py \
  --out /private/tmp/penn-phase3-railway --render
```

Add repeated `--support /path/to/raw/model-concourse.glb` arguments only for unshifted Main=0 core chunks. The saved raw GLB/blend remain outside active assets. Parent optimization must preserve linked fitting instances and report the actual compressed/mobile budget before runtime integration.

`railway-manifest.json` records the intended dimensional contact chain and checks the **actual transformed mesh bounds**: platform foundations meet the concrete base; every running rail remains over its foundation footprint; all linked timber/plate chains meet; eastern stop feet embed in concrete rather than hovering. It also records actual gauge, minimum adjacent track spacing, geometry counts and all fixture coordinates. Full train-wheel/rail and stair-landing collision checks must also be performed after parent placement; the raw railway audit alone cannot certify the assembled world.

The frozen raw revision has 935,400 assembled triangles and 14,388,436 raw GLB bytes. An optimization proof reduces 66,804 authored objects to 16 nodes/meshes and 17 primitives, retaining 10 instanced fitting batches with 66,158 instances. It has 10 materials and is 5,942,440 bytes before the final Meshopt/GZip transport and light bake. These are asset statistics, not measured browser performance. The saved-blend recheck in `contact-audit.json` passes 84 contacts, including 31,280 timber blocks, 31,280 plates, 42 rails and 22 mounting flanges; maximum chain mismatch is under 0.000001 m from float precision. The actual runtime budget and assembled-scene checks remain the parent's integration gates.
