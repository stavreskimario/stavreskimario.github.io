# Clearer station viewport — 2 November 2026 (Melbourne)

Remove the large location card requested by the owner. Camera names remain in the existing viewpoint controls and the existing screen-reader status. Old card styling is removed, while native movement/navigation remain in place.

| Before | After | Why |
| --- | --- | --- |
| A persistent title and description card covers the architecture | Open viewport with names in existing navigation and a nonvisual status | Keep the station visible |

[Actual local Chrome verification](local-browser.json) uses the built app under `/exhibition/`: all three main viewpoints, six persistent world zones and a supported 1.80m W movement pass. No page or HTTP errors; duplicate cancelled requests each have a separately observed successful response. The earlier overly strict cancellation assertion and its correction are recorded. This is neither a new geometry release nor a performance certificate. Physical-mobile testing was not repeated for this removal; existing emulated-layout tests were adjusted to use the retained navigation controls.

Production publication is checked after the feature-branch push. PR11 remains draft and unmerged.
