# Asset provenance

## Newly authored assets

The architectural, neighbourhood, vehicle and rolling-stock meshes, Blender authoring scripts, procedural surface maps, lighting atlases and synthesized ambience were created for this project. Geometry interprets historical evidence; it is not a scan of the demolished station. Names such as Milford granite, travertine and Tuscan red describe the intended appearance without certifying a sampled historic material or paint colour.

Editable `.blend` files, original material maps, HDR bakes and AO PNGs are retained under repository-root `authoring/penn-station-1935/`. The custom staging process excludes that folder; the existing legacy root Pages deployment can serve it, so its entire contents are public-release material. Runtime Meshopt GLBs use lossless `.glb.gz` transport with browser decompression, requiring no backend or special response headers. The decompressed GLBs are byte-identical to the reviewed originals; geometry, material data and texture pixels are unchanged by this transport step. Shared KTX2 surface/AO textures and lossless WebP illumination atlases are served locally from `assets/`. Compression, map resizing and mechanical reference-image cropping do not introduce new historical evidence.

The [station ledger](model/README.md), [context ledger](model/context-research.md), [rolling-stock ledger](model/rolling-stock-research.md) and [research register](RESEARCH.md) identify the evidence and uncertain details. Generic 1930s-style cars and lamps are authored interpretations, not reproductions of an authenticated brand, exact street inventory or third-party 3D model.

## Stone material sources

Created using **Granite005A** and **Travertine009** from ambientCG, licensed under the **Creative Commons CC0 1.0 Universal License**. ambientCG permits use, modification and redistribution of its downloadable assets under its [published licence](https://docs.ambientcg.com/license/).

| Source | Included maps and derivatives | Historical limitation |
| --- | --- | --- |
| [ambientCG Granite005A](https://ambientcg.com/view?id=Granite005A) | Original `2K-JPG` Color, Roughness and NormalGL maps in the authoring library; shared KTX2/UASTC runtime derivatives | A modern material interpretation for granite. It is not a Penn Station scan or calibrated Milford granite sample. |
| [ambientCG Travertine009](https://ambientcg.com/view?id=Travertine009) | Original `2K-JPG` Color, Roughness and NormalGL maps in the authoring library; shared KTX2/UASTC runtime derivatives | A modern material interpretation for travertine. Historic colour, cut, weathering and surface scale remain reconstructed. |

[material-provenance.json](material-provenance.json) records source URLs, original filenames, byte lengths and SHA-256 hashes. Colour maps are treated as sRGB; roughness and OpenGL normal maps as data. Desktop derivatives are capped at 2K; mobile derivatives at 512 px. The project’s own procedural maps remain on other materials. Stone surface textures do not sample museum photographs, archival drawings or historical photographs. The separately credited mural image below is a photographic reproduction of actual artwork.

## Lighting and environment

Phase 4 adds interpreted MilfordFine, InteriorFine, RomanTravertine and HonedMarble colour derivatives from the original CC0 maps, with reduced normal-strength scalars. The algorithm, palettes, original and derivative hashes, KTX decoded-image checks and nine unchanged original maps are recorded in `authoring/penn-station-1935/materials/phase4/`. These are newly authored appearance adjustments, not new photographic evidence. Original roughness, metal, AO, UVs and baked illumination remain unchanged. The retained illumination/probe source hashes describe their original Phase 3 inputs and predate these appearance and small geometry repairs.

`assets/sky.hdr` is a new Blender capture of the assembled authored station, street and limited neighbouring buildings at the representative elevated Seventh Avenue position `[142,12,0]`. The separate waiting-room, concourse and platform HDR captures use the same frozen geometry and material library. The source hashes, positions and settings are recorded in `assets/reflection-exterior-probe.json` and `assets/reflection-probes.json`. These static environments approximate architectural reflections; they are not historical panoramas or complete 1935 streetscapes, and have no positional parallax or time-specific rebaking.

The earlier **Spruit Sunrise** by Greg Zaal, from [Poly Haven](https://polyhaven.com/a/spruit_sunrise), is preserved under `authoring/penn-station-1935/lighting/phase3/originals/` with its [CC0](https://polyhaven.com/license) provenance. It is no longer the active environment. Daylight presets remain interpretations, not a dated solar or weather reconstruction.

The `lighting-*-sky.webp` atlases are new Cycles neutral-dome illumination for the exterior, waiting room, concourse and platform floors, with registered station/city/railway occluders and six diffuse bounces. Each diffuse bake uses 2048 px and 64 samples; mobile derivatives use 512 px. Fine ironwork stays outside the masonry atlas. Linear Rec.709 radiance is explicitly encoded through Standard/sRGB, normalized per atlas and transported as pixel-identical lossless WebP. The browser restores that scale and multiplies by π for Three.js irradiance. A measured CPU/Metal/browser reference verifies the units and transfer. Original HDR/AO outputs remain in authoring storage. The separate contact-AO pass uses its recorded outer and shader samples; CPU/Metal devices and exact settings are recorded per zone. Directional sun stays dynamic. Material colour, exposure, source-era lamp intensity and weather are not historically calibrated.

## Historical reference photographs

The three `reference-*.jpg` files are mechanical crops/rotations from McKim, Mead & White’s early twentieth-century monograph, volume IV: plate 303 exterior, plate 306 waiting room and plate 307 concourse. Credit: **McKim, Mead & White; Getty Research Institute / Internet Archive scan, via Wikimedia Commons**. The original work is identified as public domain in the United States by the [scan’s rights record](https://commons.wikimedia.org/wiki/File:A_monograph_of_the_work_of_McKim,_Mead_%26_White,_1879-1915_.._(IA_gri_33125006526038).pdf).

These are opening-era references with unspecified exposure dates, not verified 1935 photographs. No architectural content was added. Individual scan links and crop/orientation records appear in [sources.json](sources.json) and [RESEARCH.md](RESEARCH.md). Approximate model framing does not establish a calibrated camera match. The full reference PDF is not bundled with the site.

## North-end mural photographic recovery

`assets/mural-north-archival.png` reproduces the actual north-end mural visible in Detroit Publishing Co. negative 071928, [Library of Congress item 2016815386](https://www.loc.gov/item/2016815386/), LC-DIG-det-4a23713. The catalog dates the original photograph approximately 1905–1915 and states **no known restrictions on publication**; it is an original pre-1931 US publication. Credit: **Library of Congress, Prints and Photographs Division, Detroit Publishing Company Collection**.

The 728×260 PNG is an exact copy of a mechanically perspective-rectified photographic crop, preserving its original monochrome tones. It is 76,559 bytes; SHA-256 `3fe44b7afcbd89a26bb1db1cdc1108bd525643ae4f556378340168b7afc49076`. Repository-root `authoring/penn-station-1935/references/phase3/mural-north-provenance.json` records the original TIFF URL/hash, image corners and treatment. There is no generated painting, inpainting, invented lettering or colourisation. The global-contrast inspection derivative is research-only and is not bundled.

Only the north-end field may use this image. Its official title and original colours are unverified; low resolution, exposure falloff, dust and photographic defects remain visible. It does not reconstruct the other five murals, which remain neutral. The [interior evidence ledger](model/interior-evidence.md) records the placement reasoning and limitations.

The [1911 US Copyright Office catalog](https://archive.org/details/catalogofcopyrig64libr), printed p. 80, independently records Detroit negative 071928, copyright 16 January 1911, registration J151601, with copies deposited 6 February 1911. This corroborates the original-publication era rather than relying solely on the LOC catalog's broad date range.

## Newly inspected interior references

The LOC Gottscho 1910 concourse photograph LC-DIG-gsc-5a18544 and Detroit loggia view LC-DIG-det-4a23714 have item-specific **no known publication restrictions** advisories. NYPL image 58514805, a separate Abbott print catalogued 1930–1939, is expressly **free to use without restriction** on its [item page](https://old-digitalcollections.nypl.org/items/434b8be0-eb3c-013a-9d4c-0242ac110003). This does not establish common rights across other Abbott prints. Originals and mechanical connection/detail crops are retained in research scratch storage, not runtime assets. Their facts and source links appear in the interior ledger and source manifest.

## Research images retained as links

Modern museum photographs and labels, municipal-archive reproductions, and NYPL/NGA imagery with unresolved item-level reuse terms are linked for research only. Their availability online does not establish redistribution rights. The Conrail Historical Society’s research view of original PRR drawing **F406591**, dated July 1935, was inspected for geometry; its watermarked raster is not included in the app or authoring assets. Original Hotel Pennsylvania and Farley plans inform newly authored geometry; research rasters are not runtime textures. The dedicated ledgers retain the source citations and distinguish original documents from later preserved examples.

## Bundled software

The Basis Universal decoder in `assets/basis/` is distributed with Three.js; its Apache 2.0 licence and notices are included beside it. Bundled rendering-library licences and minifier notices are retained in [THIRD_PARTY.md](THIRD_PARTY.md) and `dist/*.LEGAL.txt`. There is no external script CDN, analytics service, credential or required backend. Optional Google Fonts requests follow the collection’s shared typography convention.

## Scanned passenger proof: not a bundled runtime asset

One review-only figure uses **Eric Rigged 001 - Rigged 3D Business Man, by Renderpeople**, released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) on the [creator's exact Sketchfab item](https://sketchfab.com/3d-models/eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f). The public API confirms the specific CC BY 4.0 grant. FBX and original 8K textures were obtained from the named public files in [PacktPublishing's official mirror, commit e752af943e8cf035def41f17d9efa8e50b1bc135](https://github.com/PacktPublishing/Godot-4-Game-Development-Cookbook/tree/e752af943e8cf035def41f17d9efa8e50b1bc135/Chapter%209/Eric). No Packt code was executed. The original scan licence, rather than the mirror's general MIT code licence, supplies the reuse basis. Downloaded FBX/colour/normal Git blob hashes match the pinned mirror metadata.

Treatment: posed through the original skeleton; original photographed body, clothes, colour and normal map preserved; restrained material estimates assigned from original masks/UV islands; static evaluated pose exported, with the original rig retained in the editable review file. No generated imagery, synthetic body or replacement clothing was used. The source file hashes and changes are recorded in the scratch proof's `source-and-review.json`; the source grant and mirror are retained in the research manifest. Any future redistribution must preserve the model title, Renderpeople credit, original item link, CC BY 4.0 link and modification notice. The original creator's NoAI tag is retained in provenance.

The scan, original files and renders remain outside the website in research/review scratch storage. **The current proof was rejected for this release; no passenger is approved for the live scene by this licence entry.** Contemporary low-waist/slim tailoring, short waistcoat, moulded scanned hair and stiff fingers fail the current visual/period threshold. Realistic period passengers remain outstanding. Dennis Posed 004 and Fabienne & Percy 001 have separate creator-published CC BY 4.0 records but have not been imported or bundled. Ordinary Renderpeople shop downloads under its redistribution-restricting terms are not substituted for these specific licensed sources. Museum garment photos and 1936 newspaper references remain link-only.
