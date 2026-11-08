# Conservative walking-query reduction — 2 November 2026 (Melbourne)

The static six-metre grid previously sent every object in a matching cell and height range to the triangle raycaster. The query now also rejects world bounds outside the finite ray's horizontal envelope. The existing 1mm allowance, collision geometry, first-seen ordering and final triangle tests remain intact.

[Decoded-asset comparison](asset-query.json) reconstructs 5,025 colliders and reuses 1,536 prior native-route camera positions. All26,112 body/floor probes preserve1,574 exact actual triangle hits, order, positions and face indices. The32,624 discarded bounds independently miss the finite Three.js ray. Candidate count falls155,444→122,820, maximum67→12. Paired CPU query/raycast timings are a component microbenchmark, not FPS or proof that sustained lag is fixed.

[Actual native Chrome loop](native-query-summary.json) passes all34 legs from Main via departure/platform/eastarrival, both gallery aisles, westarrival/platform and back to Main. All six zones remain mounted and visible. No page/server errors; local cancellations and intentional blocked fonts remain recorded. The complete compressed trace is retained alongside this summary. This run predates the separately requested15% Shift-speed adjustment.
