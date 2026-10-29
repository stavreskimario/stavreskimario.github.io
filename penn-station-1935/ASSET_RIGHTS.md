# Asset provenance

The architectural geometry, Blender source, procedural PBR stone maps and synthesized ambience were created for this project. The geometry interprets public-domain architectural evidence; it is not a scan of the demolished station. Material names describe the intended stone, not calibrated historic samples.

The three `reference-*.jpg` photographs are mechanical crops/rotations from the early twentieth-century McKim, Mead & White monograph, volume IV, plates 303, 306 and 307. They are opening-era references, not verified 1935 photographs. See [sources.json](sources.json) for individual credits, original scans and the Wikimedia Commons public-domain rights record. Modern photographs and municipal-archive images with unresolved item-level reuse rights are linked only.

`assets/sky.hdr` is **Spruit Sunrise** by Greg Zaal, from [Poly Haven](https://polyhaven.com/a/spruit_sunrise), redistributed under [CC0](https://polyhaven.com/license). It supplies ambient illumination/reflections only. It does not depict historical New York, and is not displayed as a skyline. Lighting presets are interpretations, not a dated solar/weather reconstruction.

The Basis Universal decoder in `assets/basis/` is distributed with Three.js; its Apache 2.0 licence and notices are included beside it. Bundled rendering-library licences and minifier notices are retained in [THIRD_PARTY.md](THIRD_PARTY.md) and `dist/*.LEGAL.txt`. No external script CDN, analytics, credentials or backend service is required.
