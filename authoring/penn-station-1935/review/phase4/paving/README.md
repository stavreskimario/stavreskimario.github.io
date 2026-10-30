# Paving contact correction

The retained [audit](pavement-contact-audit.json) examines 20 upward rectangular road/sidewalk tops. It replaces two overlapping top faces on one object, removing 891.869 m² of duplicate coplanar coverage, with zero remaining overlap in that scoped set. Affine surface coordinates, street footprint, elevations, buried slabs and existing inventory are retained.

The updated editable context source is byte-identical to the reviewed export input; [source hashes](context-source-provenance.json) identify it and the corresponding raw GLB. This is a surface/contact repair, not a new historical city inventory. Street widths and parcel registration retain their existing uncertainty. Final mapped desktop rendering and runtime acceptance are separate checks.
