# Independent arrivals illumination

This atlas lights the first eight ordinary arrival pairs, widened Exit floor and associated opaque support surfaces. It does not replace earlier room, platform or reflection maps. The existing platform bake and static probes still need reconciliation with the enlarged floor.

The raw input is `arrivals-module.glb`, SHA256 `ba0969961ed97c854742e86c43fd16326f142f8e4289b3acd55acb8a910f58cc`. Blender 4.3 Cycles Metal used 4096 px / 64 diffuse samples, a neutral sky and six diffuse bounces. The separate contact AO uses four outer samples and 24 AO rays per shader evaluation; its runtime KTX2 derivative is 2048 px. Fine ironwork remains unbaked and uses the retained environment/direct lighting.

Registered occluders include the actual retained concourse, unchanged exterior, complete relocated platform geometry and trains. Their identities and frame offsets are recorded in [the bake report](raw/lighting-concourse-arrivals.json). The texture-free platform occluder preserves every decoded geometry/instance value and the authored glower emission; texture removal is an occluder approximation, not a new surface specification.

[The denoising record](denoised/lighting-concourse-arrivals-denoise.json) preserves linear input, source and retained HDR hashes, the 0.18 transfer check, full 4096 px / fallback 512 px derivatives and byte-identical lossless WebP pixels. The relative mean change is approximately −0.0233%; neither PNG derivative clips radiance at its recorded scale 4. Source HDRs are losslessly gzip archived. These are authored illumination maps, not historical photographs, calibrated period weather or measured original lamp photometry.

The broader appearance and first-eight scope remain qualified in [the architectural evidence ledger](../../../../penn-station-1935/model/arrivals-evidence.md). Native browser acceptance and publication receipts are separate from this source bake.
