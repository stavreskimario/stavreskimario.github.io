# Victoria, by the odds

A public, buildless GitHub Pages map of **all 88 Victorian Legislative Assembly electorates** for the **28 November 2026 state election**. Derived from `hello-world/`, keeping the parent collection's shared bone palette, fonts, controls and relative links.

## Data and accuracy

- `odds.json` contains **a manually verified snapshot from 9 November 2026**, sourced from [Sportsbet's Victorian State Election - Seat Betting](https://www.sportsbet.com.au/betting/politics/vic-politics/victorian-state-election-seat-betting-10944986).
- There is **no live odds feed**, automatic sync or Sportsbet API integration. Never present snapshot prices as current.
- Where Sportsbet's page has a collapsed "Show All" market, the visible selections are recorded; some additional outcomes may exist on the source page.
- Electoral district polygons are requested on page load from the [Victorian Government's state_electoral_boundary MapServer](https://spatial.planning.vic.gov.au/gis/rest/services/state_electoral_boundary/MapServer), layer 4 (STATE_ASSEMBLY_2022), falling back to [Vicmap Admin layer 15](https://vicmap.land.vic.gov.au/agsgis/rest/services/vicmap/Vicmap_Admin/MapServer/15). Copyright State of Victoria, Vicmap Admin; CC BY 4.0.
- The map uses Leaflet 1.9.4 and CARTO's light map tiles, both loaded externally. When mapping dependencies or government GIS are inaccessible, the complete keyboard-accessible electorate directory still functions.
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

Open `http://localhost:8000/victorian-election-odds/`. Confirm all 88 list entries, search, source attribution, filter, Melbourne/state framing, a map selection and responsive layout with reduced-motion preferences. Map integration requires access to Leaflet CDN, CARTO tiles and Vicmap's public cross-origin GeoJSON endpoint; the repository validator cannot guarantee their uptime. The app stores no personal information.
