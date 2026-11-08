# First bridge bay: source lighting

Historical checkpoint: superseded by Phase13. The two linear HDRs, two PNG derivatives and original single-bay Blender/GLB files are now restored from exact Git objects using `review/phase13/storage/restore-phase12-source.py` (repository-relative authoring location). See its receipt before replaying this old checkpoint; reports below describe the originally accepted files.

The accepted material revision uses a 4096 px, 128-sample Cycles Metal bake with six diffuse bounces. All seven opaque Blender owners and 8,256 triangles receive valid light/AO coordinates. Authored corner normals are retained; welding is disabled for this artifact so thin opposing girder-joint faces survive preparation.

`raw/` and `denoised/` retain the losslessly archived linear HDR sources, full/fallback PNGs and reports. Runtime WebPs are checked pixel-for-pixel against those PNGs. `source/` retains the executed helpers, input packet, accepted context-cache identity and source checks. The large pre-bake context scene stays external, pinned by its exact hash; its source inputs and existing archived lighting remain identified in the packet.

The cache contains the accepted neighboring architecture and ten registered exit lamps. The later gallery-floor micro-normal map is absent from that cache, while its calibrated mean albedo is retained. The bridge has no invented primary lamps. Light, paint hue and roughness remain appearance interpretations. Existing platform GI and older reflection captures are retained; under-bridge floor/contact illumination and the wider enclosure still need refinement. No final photorealism or measured historic photometry is claimed.

Earlier dark-paint and welded candidates were held externally and not published. The accepted source has a dielectric painted coating and preserves all source faces. Browser evidence uses two static viewpoints; no native walking walkthrough was run.
