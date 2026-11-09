# Victoria, by the odds

A public, buildless GitHub Pages map of **all 88 Victorian Legislative Assembly electorates** for the **28 November 2026 state election**. Derived from `hello-world/`, keeping the parent collection's shared bone palette, fonts, controls and relative links.

## Data and accuracy

- `odds.json` contains **a manually verified snapshot from 9 November 2026**, sourced from [Sportsbet's Victorian State Election - Seat Betting](https://www.sportsbet.com.au/betting/politics/vic-politics/victorian-state-election-seat-betting-10944986).
- There is **no live odds feed**, automatic sync or Sportsbet API integration. Never present snapshot prices as current.
- Where Sportsbet's page has a collapsed "Show All" market, the visible selections are recorded; some additional outcomes may exist on the source page.
- **All 88 electorates (including Narracan) are self-hosted** in `electorates.geojson`. The map is rendered with a small local SVG renderer (`atlas.js`): no map API key, basemap tiles, Leaflet CDN, external JS dependencies or live government GIS requests.
- **Boundary source and attribution:** [State of Victoria / Vicmap Admin State Assembly Polygon 2022](https://discover.data.vic.gov.au/dataset/vicmap-admin-state-assembly-polygon-2022), copyright State of Victoria (Victorian Electoral Commission), licensed **CC BY 4.0**. Source coordinates were retrieved through the 2022 WFS dataset and provenance was cross-checked with [this public source record](https://github.com/auraofintelligence/p4a-xyz-cinema/blob/main/assets/maps/vic-provenance.json).
- **Display precision:** the official 1,116,354 boundary vertices were simplified to 49,293 with a 0.00025° (~25-30m) cartographic tolerance, preserving every original feature and ring. The map is accurate for exploring seats but **is not a legal address-level boundary determination**. Consult the VEC for definitive borders.

- A map colour denotes the party with the **shortest decimal odds**, not an election result. If two markets share the shortest odds, the seat is marked **Tied**; bookmaker prices include a margin and are not calibrated probabilities. `Any Other` and named independents are not merged with party candidates.
- Markets may change or be withdrawn, so update `odds.json` and the capture date in a *new feature branch + PR*, using the source page. Do not auto-scrape/push to main or claim real-time price updates.

## Interactions

- Click/tap a map polygon to inspect published odds for that district.
- Search all 88 districts by name, with a complete keyboard-operable button list.
- Filter by market favourite; two map framing controls switch statewide/Melbourne views.
- Map labels, source link, data provenance and last capture date are explicit.

## Running and validation

From the repository root:

```sh
python3 -m http.server 8000
python3 scripts/validate.py
```

Open `http://localhost:8000/victorian-election-odds/`. Confirm all 88 list entries, search, source attribution, filter, Melbourne/state framing, a map selection and responsive layout with reduced-motion preferences. The map runs from local files without a third-party mapping service. The repository validator does not test real touch/pinch interactions. The app stores no personal information.
