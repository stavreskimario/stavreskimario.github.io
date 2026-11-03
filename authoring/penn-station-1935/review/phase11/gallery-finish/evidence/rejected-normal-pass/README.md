# Rejected initial gallery lighting

The first full-surface bake preserved positions/UVs but reassigned some hard-edge corner normals during join/weld/UV preparation. The worst measured source-normal change was90.07degrees; lossless packing and mounting reproduced it without additional drift. This candidate was held and never published. Source triangle identity and the raw baked predecessor isolate the regression before packing.

The corrected pipeline carries authored world-space corner normals through the existing temporary corner attribute, restores them before light transport and removes that attribute before export. An independent diagnostic measures0.0286degree maximum encoding change, within the existing0.5degree Blender codec bound. Final corrected render, encoded and browser acceptance are separate subsequent records; this diagnostic is not a publication certificate.
