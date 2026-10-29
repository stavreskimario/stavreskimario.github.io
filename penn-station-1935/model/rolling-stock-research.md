# PRR electric locomotive and heavyweight coaches

The authored train is an **unnumbered early production GG1 interpretation with two P70 coach interpretations**, suitable as a class-level study for the 1935–1940 target. It is not an authenticated consist, operating assignment, train number, departure or exact individual vehicle. The museum locomotive No. 4935 was built in 1943 and is **not** assigned to this reconstruction.

## Evidence inspected

1. **Railroad Museum of Pennsylvania, “Our Trains,” electric locomotive and passenger-car entries.** [Museum collection record](https://www.rrmuseumpa.org/our-trains). The museum explains the production GG1's welded body and Raymond Loewy's five-stripe treatment, distinguishing it from the riveted prototype. Its present photographs were inspected for class morphology and mechanical detail; a restored 1943 locomotive is not proof of every 1935 modification or paint arrangement.
2. **Harrisburg Chapter, National Railway Historical Society, GG1 No. 4859 fact sheet, 7 August 2024.** [Owner's specification sheet](https://static1.squarespace.com/static/60d4047b4ab96c060b0672f5/t/6719cccf0cb69b6e9d4fa07e/1729744079266/Harrisburg%2BChapter%2BNRHS%2B-%2BGG1%2B4859%2BFact%2BSheet.pdf). Records the class's articulated 2-C+C-2 layout, 79 ft 6 in length, 10 ft 4 in width, 57 in drivers, central cabs and dark-green/gold treatment. This preserved locomotive dates from 1937; its identity is not copied into the asset.
3. **ASME / Railroad Museum of Pennsylvania / Friends of GG1 4800, National Historic Mechanical Engineering Landmark booklet, 23 April 1983.** [Engineering record](https://www.asme.org/wwwasmeorg/media/resourcefiles/aboutasme/who%20we%20are/engineering%20history/landmarks/83-penn-rr-gg1-electric-locomotive-4800-1943.pdf). Describes two articulated frames with three driving axles and a two-axle pilot truck each, 57 in drivers, a 13 ft 8 in rigid wheelbase, and production deliveries in 1935. The prototype alone retained its riveted shell; the model uses a welded production shell.
4. **Railroad Museum of Pennsylvania, passenger car No. 1006 exhibit label.** [Original museum label](https://www.rrmuseumpa.org/wp-content/uploads/2022/03/PRR-1006.jpg); [museum side photograph](https://www.rrmuseumpa.org/wp-content/uploads/2022/03/PRR_1006.jpg). The label identifies a P70 built in 1928 by Standard Steel Car Company, an 80 ft 4 in length, and 80 passengers. The label does not state its length datum. Its archival interior photograph depicts P70 No. 3695 on 1 June 1927, supporting paired sash, clerestory lighting and walkover seats. Modern museum rasters are linked for evidence, not bundled or sampled as materials.
5. **Original PRR P70 side/end diagrams, archival research leads.** [Diagram catalog](https://prr.railfan.net/diagrams/PRRdiagrams.html?diag=P70-.gif&fr=&sel=coa&sz=sm); [1933 family sheet E94787](https://prr.railfan.net/diagrams/PRRdiagrams.html?diag=P70b_P70c_P70r_P70_P70d-E94787-.gif&fr=&sel=coa&sz=sm). Retrieval was blocked/timed out, so the original dimensioned drawing was **not** used as if inspected. P70 cross-section and truck spacing remain interpretations.
6. **Pennsylvania Railroad, mechanical drawing F406591, Altoona, 17 July 1935, issued 25 July 1935, revision A.** [Conrail Historical Society archive record](https://archives.thecrhs.org/object/2020001077-locomotive-drawing-gg1-locomotive-f-406591), accession 2020.001.077. The drawing's original title block and dimensions were visually inspected; the archive's catalog date of 1969 does not date the depicted original sheet. This primary drawing establishes the dimensions and axle locations below. Its watermarked research image is not included in the application or authoring assets.

## Implemented anchors and uncertainties

| Feature | Implemented | Status |
| --- | --- | --- |
| GG1 length | 24.2316 m, corresponding to 79 ft 6 in over coupling faces | Supported class anchor; coupling jaws were set to this envelope. |
| GG1 body length / cab width / drivers | 23.3727625 m body length; 3.1543625 m cab width; 1.4478 m driver diameter | F406591: 76 ft 8 3/16 in, 10 ft 4 3/16 in, and 57 in respectively. Handrails, decorative trim and minor fittings are interpreted. |
| Wheel arrangement and spacing | Two three-axle driving frames, each with a two-axle leading truck: twenty wheels total. Driver spacing 2.0828 m; inner driven axle gap 3.048 m; pilot axle spacing 2.4384 m | F406591: 6 ft 10 in driver spacing, 10 ft inner gap, 8 ft pilot wheelbase, and 36 in pilot wheels. Pilot axle centres are ±8.0772 m and ±10.5156 m from the body centre. Journal castings, springs and brakes remain reconstructed. |
| Body | Rounded long hoods, raised central directional cabs, split glazing, five gold stripes, side access panels and louvres | Class appearance informed by the museum photographs; no number, later corporate branding or modern locomotive type. Curvature and individual louvre placement are not factory-certified. |
| Pantographs | Two articulated diamond frames; one folded to nominal 4.572 m, one raised to an interpreted 6.1 m contact height | F406591 explicitly dimensions 15 ft railhead to locked pantograph, resolving the 1935 production outline in favour of 15 ft rather than the later ASME booklet's 16 ft statement. The raised collector must be reconciled with a verified station wire height before claiming an operating replica. |
| P70 length | 24.4856 m, equivalent to the museum label's 80 ft 4 in | Anchor from No. 1006, not a universal claim for every P70 subclass. Coupler datum is a modelling interpretation because the label does not specify it. |
| P70 section | 3.00 m body width, 4.2672 m roof height; steel body, curved clerestory and enclosed vestibules | Width, roof height, trucks and exact subclass remain interpreted until the original diagram is inspected. |
| P70 passengers | Eighty seats per coach, with paired sash and a central aisle | Museum capacity and 1927 interior photograph inform the arrangement. Upholstery pattern/colour and precise seat placement are original interpretations. |
| Paint and details | Dark-green locomotive enamel, gold lining, Tuscan-red coaches, black roof/diaphragms | Period appearance study. No calibrated paint sample, maintenance state, precise 1935 lettering specification or individual train inventory is certified. |

The locomotive is electric. No steam locomotive or smoke plume has been introduced into the tunnel station. A small train-heating vent is a body fitting, not a claim that a steam engine operated there.

## Asset placement and geometry

The asset uses the common metre coordinate system: glTF X along the track/east–west, Y up, Z south. The GG1 centre is X −30 m. Coach centres are X −54.6086 m and −79.3442 m. All transverse centres are Z 0. The main scene may translate this assembly to a selected track; these local coordinates do not authenticate an assigned platform.

**Wheel tread contact is local Y 0.** Flanges project 0.026 m below railhead. Placement must use the tread datum rather than the minimum mesh bound. Coach interior floor is Y **1.1684 m**, aligning with the documented 46 in representative platform height selected by the parent station model. This is an integration choice, not a separately verified P70 floor-height measurement.

The final authoring build contains **95,548 assembled triangles**, including repeated wheel and coach placements. Its raw GLB is **7,010,720 bytes**. A proof glTF-Transform optimization pass emits **EXT_mesh_gpu_instancing**, with **4 batches / 40 instances**, **16 meshes/nodes** and **12 materials**. The proof file is **5,899,476 bytes**, before the parent's Meshopt/KTX2 compression; compressed byte counts must be recorded from the actual final runtime asset.

The open annular wheel rims retain visible cast spokes. Small spring sweeps share continuous tube geometry, and painted lettering uses flat glyph silhouettes rather than unnecessary bevels. Coach rivet rows use an original subtle normal map, while the welded production GG1 avoids the prototype's full riveted shell. These are newly authored meshes and deterministic PBR maps; no historical image is used as a texture.

## Reproduction and review

```sh
UV_CACHE_DIR=/private/tmp/penn-uv-cache uv run --no-project --python 3.11 --with bpy==4.3.0 --with 'numpy<2' python penn-station-1935/model/build_rolling_stock.py --out /private/tmp/penn-phase2-trains --render
```

Outputs are `model-trains.glb`, editable `model-trains.blend`, `rolling-stock-manifest.json`, original paint maps and three inspection PNGs in that scratch folder. The inspection rail, ballast, cameras and lighting are added only after saving/export, so they are absent from the delivered train asset. No live app asset or JavaScript file is written by this tool.

The source and rendered reviews correct the initial closed-disc wheel rims, overly flat cab/hood profile and nonessential geometry overhead. The result is a detailed authored class interpretation, **not** final photogrammetric rolling stock or a fully verified 1935 train. Close-up running gear, exact cab contours, lettering, brake rigging and the coach drawing still need engineering-reference reconciliation before such a claim is warranted.
