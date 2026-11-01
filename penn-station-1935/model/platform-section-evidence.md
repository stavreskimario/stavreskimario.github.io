# First-eight platform construction and finish

2 November 2026 (Melbourne). A bounded source-based upgrade to P1–8; northern P9–11 retain their earlier geometry/lighting. All21tracks, registered platform top outlines/heights, stairs and complete lamp assemblies remain coordinated. It does not complete the railway enclosure or certify an unchanged1935 inventory.

The primary source is Francis and O’Brien, ASCE Transactions69, printed201–202 andFig6, in the [original volume](https://archive.org/details/transactionsofam69amer). Native source pages and hashes are documented in the [construction controls](../../authoring/penn-station-1935/review/phase9/research/next-construction-controls.md).

| Feature | Supported by the record | Reconstruction limit |
| --- | --- | --- |
| Concrete slab |8in edge;8–16in centre range|The model chooses16in centre; no recovered individual schedule.|
| Continuous supporting sidewalls |16in plain concrete|The existing commonfoundation is retained; Fig6’slocal2ftsubgrade and complete footing system are unfinished.|
| Overhang and soffit |20in overhang beyond wallface;12inradiuscove|Tapered ends and continuous endwalls are interpretations.|
| Walking finish |3/4in stippledgranolithic dressing;approximately30in squarejointpitch|Colour,aggregate,roughness,jointorigin,3mmwidth and2mm normaldepth remain interpreted.|
| Exposed concrete |Rubbed after formremoval|Fine texture and weathering are appearance estimates.|
| Top geometry |Existing accepted outlines/datums retained|Fig6’squarter-inch-per-foot crossfall is not implemented; drain/hatch locations still need tracing.|

The standalone Blender CLI replays allthree raw geometry exports and three source PNGs byte for byte. Six exactly coincident internal dressing underside faces are removed by the standard bake join, leaving2,426triangles in two material batches. Subsequent texture packaging and Meshopt retain all32,208Float32geometry scalars, normals, UVs and index order exactly. Oldowned surfaces are compared on the exact pre-existing delivered quantization lattice, then removed at20µm/100% coverage; original raw sources are not moved or rewritten. All2,008protected old triangles retain their order.

Independent4096px/64sample sky illumination includes the current waiting room, complete concourse, exterior, retained railway and trains. It therefore accounts for the widened arrivals gallery; no directional sun is baked. Low sky illumination is512px, runtimeAO2048px. Denoising changes mean radiance by about−0.303%, passes the linear0.18 control and uses explicit storage scale2 with zero clipped derivative samples. Northern platform light and older static reflection probes remain separate retained artifacts.

[Validation](../VALIDATION.md) records final encoded contacts, routes, native controls and publication. The wider enclosure, westernMain floor/support correction, northern registration and street-to-waiting-room arcade remain unfinished. No new full canopy or invented platform/street alignment is supplied by this section upgrade.
