# Default walking behavior

Fresh entry and Reset use the existing Walk spawn/physics. Ordinary Exterior, Waiting Room and Concourse viewpoints preserve the selected Walk or Orbit mode. Reset clears cinematic/neighbour framing, preserving only the valid platform walking framing. Explicit archive framing, neighbour views and guided tours still request Orbit; stopping a tour changes only its active flag.

The focused actual-browser check passed against current floor assets through a separate scratch bundle, with no production/dist writes or camera setters. It checks the street spawn at [124,1.68,0], real W movement with loaded collision/support queries and human eye height, drag-to-look, ignored flight-only height keys, selected Walk/help HTML, mode persistence through all three viewpoints, Walk reset, reset from the Hotel framing, and guided tour start/Escape. All six zones remain loaded. No browser/resource errors occurred; Chrome closed cleanly.

The native screenshot remains in work/walk-default-browser/default-walking.png. Flight/cinematic tests now explicitly select Orbit. Test syntax checks passed for penn-navigation.cjs, penn-station.cjs and penn-final-acceptance.cjs. This receipt does not claim final asset acceptance, a broad train-route rerun, mobile certification or FPS performance.

The rebuilt production bundle was subsequently checked with the same focused real-input group against unchanged floor-checkpoint assets. [Production receipt](production-report.json) passes with bundle `2a925da8a33ad307e0a9014641a74f08871f1446b2da43cffe5cb2e55c6aa581`. This is functional validation, separate from any later ceiling/material update.
