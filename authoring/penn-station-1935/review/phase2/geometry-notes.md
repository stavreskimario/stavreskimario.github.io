# Phase 2 source geometry review

The editable scene is `../../penn-station-phase2.blend`. It is saved in common world coordinates: street at 0 and main passenger floor at −4.2672 m. Scene property `main_floor_world` records that level. Raw waiting-room and concourse GLBs retain Main = 0; the browser applies their −4.2672 m offset.

`source-waiting.png` and `source-concourse.png` show the final source geometry under a simple daylight review setup. They are geometry evidence, not the final browser material/radiance result or an acceptance claim of photorealism.

The source geometry includes separate projecting waiting-room imposts, octagonal relief coffers, five-light thermal windows, granite colossal shafts, source-based main concourse spans, lower ornamental arcades and Guastavino cloisters, connected bearing branches and actual stair cutouts.

The waiting-room vault retains an implemented 150 ft envelope for this preview. Francis & O'Brien, ASCE 1910 p194, explicitly gives 143 ft to the highest ceiling; the PRR general 150 ft room-height description does not resolve that ceiling datum. The 150 ft ceiling is not certified. The eight monumental column-order dimensions remain independently anchored to plate 310.

`route-audit.json` samples 1,059 floor positions from the Seventh Avenue entrance through the arcade and main stair to the concourse, plus doorway clearance at three body heights. It found zero floor gaps and zero doorway blockers. `route-audit-final.json` checks all nine main stair flights and lower doglegs, and the representative platform registration. Lower steps remain below the runtime 0.24 m step limit. The platform position and width, minor truss profiles and lower arcade rises remain reconstructed interpretations; this is not a certified complete track/platform survey.

The blend is compressed and includes packed fallback material images. The browser uses separately processed PBR and baked lighting assets. See the model README and research ledger for the complete evidence/uncertainty record.
