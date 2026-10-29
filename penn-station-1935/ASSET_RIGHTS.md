# Asset provenance

## Newly authored assets

The architectural, neighbourhood, vehicle and rolling-stock meshes, Blender authoring scripts, procedural surface maps, lighting atlases and synthesized ambience were created for this project. Geometry interprets historical evidence; it is not a scan of the demolished station. Names such as Milford granite, travertine and Tuscan red describe the intended appearance without certifying a sampled historic material or paint colour.

Editable `.blend` files, original material maps, HDR bakes and AO PNGs are retained under repository-root `authoring/penn-station-1935/`, outside the GitHub Pages staging tree. Runtime Meshopt GLBs use lossless `.glb.gz` transport with browser decompression, requiring no backend or special response headers. The decompressed GLBs are byte-identical to the reviewed originals; geometry, material data and texture pixels are unchanged by this transport step. Shared KTX2 surface/AO textures and lossless WebP illumination atlases are served locally from `assets/`. Compression, map resizing and mechanical reference-image cropping do not introduce new historical evidence.

The [station ledger](model/README.md), [context ledger](model/context-research.md), [rolling-stock ledger](model/rolling-stock-research.md) and [research register](RESEARCH.md) identify the evidence and uncertain details. Generic 1930s-style cars and lamps are authored interpretations, not reproductions of an authenticated brand, exact street inventory or third-party 3D model.

## Stone material sources

Created using **Granite005A** and **Travertine009** from ambientCG, licensed under the **Creative Commons CC0 1.0 Universal License**. ambientCG permits use, modification and redistribution of its downloadable assets under its [published licence](https://docs.ambientcg.com/license/).

| Source | Included maps and derivatives | Historical limitation |
| --- | --- | --- |
| [ambientCG Granite005A](https://ambientcg.com/view?id=Granite005A) | Original `2K-JPG` Color, Roughness and NormalGL maps in the authoring library; shared KTX2/UASTC runtime derivatives | A modern material interpretation for granite. It is not a Penn Station scan or calibrated Milford granite sample. |
| [ambientCG Travertine009](https://ambientcg.com/view?id=Travertine009) | Original `2K-JPG` Color, Roughness and NormalGL maps in the authoring library; shared KTX2/UASTC runtime derivatives | A modern material interpretation for travertine. Historic colour, cut, weathering and surface scale remain reconstructed. |

[material-provenance.json](material-provenance.json) records source URLs, original filenames, byte lengths and SHA-256 hashes. Colour maps are treated as sRGB; roughness and OpenGL normal maps as data. Desktop derivatives are capped at 2K; mobile derivatives at 512 px. The project’s own procedural maps remain on other materials. No museum photograph, archival drawing or historical photograph is sampled into a surface texture.

## Lighting and environment

`assets/sky.hdr` is **Spruit Sunrise** by Greg Zaal, from [Poly Haven](https://polyhaven.com/a/spruit_sunrise), redistributed under [CC0](https://polyhaven.com/license). The modern environment supplies reflections. It does not depict historical New York and is not displayed as a period skyline. Daylight presets are interpretations, not a dated solar or weather reconstruction.

The `lighting-*-sky.webp` and `lighting-*-sky-low.webp` atlases are newly generated Cycles neutral-dome diffuse illumination with bounce for the exterior, waiting room and concourse, separate from the Poly Haven image. The bounded bake is encoded as Standard/sRGB 8-bit PNG, then lossless WebP preserving those RGB pixels; browser sRGB decoding restores linear lighting. Original HDR bakes remain in authoring storage. AO is newly baked and delivered as KTX2. Settings use 2048 px and 64 samples, with 512 px mobile illumination derivatives. Directional sunlight and neighbouring city occluders are excluded. The separate platform uses unbaked PBR materials and runtime point lights. See the per-zone lighting reports for actual exported settings.

## Historical reference photographs

The three `reference-*.jpg` files are mechanical crops/rotations from McKim, Mead & White’s early twentieth-century monograph, volume IV: plate 303 exterior, plate 306 waiting room and plate 307 concourse. Credit: **McKim, Mead & White; Getty Research Institute / Internet Archive scan, via Wikimedia Commons**. The original work is identified as public domain in the United States by the [scan’s rights record](https://commons.wikimedia.org/wiki/File:A_monograph_of_the_work_of_McKim,_Mead_%26_White,_1879-1915_.._(IA_gri_33125006526038).pdf).

These are opening-era references with unspecified exposure dates, not verified 1935 photographs. No architectural content was added. Individual scan links and crop/orientation records appear in [sources.json](sources.json) and [RESEARCH.md](RESEARCH.md). Approximate model framing does not establish a calibrated camera match. The full reference PDF is not bundled with the site.

## Research images retained as links

Modern museum photographs and labels, municipal-archive reproductions, and NYPL/NGA imagery with unresolved item-level reuse terms are linked for research only. Their availability online does not establish redistribution rights. The Conrail Historical Society’s research view of original PRR drawing **F406591**, dated July 1935, was inspected for geometry; its watermarked raster is not included in the app or authoring assets. Original Hotel Pennsylvania and Farley plans inform newly authored geometry; research rasters are not runtime textures. The dedicated ledgers retain the source citations and distinguish original documents from later preserved examples.

## Bundled software

The Basis Universal decoder in `assets/basis/` is distributed with Three.js; its Apache 2.0 licence and notices are included beside it. Bundled rendering-library licences and minifier notices are retained in [THIRD_PARTY.md](THIRD_PARTY.md) and `dist/*.LEGAL.txt`. There is no external script CDN, analytics service, credential or required backend. Optional Google Fonts requests follow the collection’s shared typography convention.
