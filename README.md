# Mario’s sites

A collection of small apps built with Codex. Live at **[stavreskimario.github.io](https://stavreskimario.github.io/)**, published from this repository with GitHub Pages.

## Apps

| App | What it does | Open |
| --- | --- | --- |
| Nine Days in Los Angeles | December 20–28, 2026 trip journal with editable plans, ideas, shared expenses, local tickets, calendar export, Google maps, weather, offline access and packing. | [LA trip](https://stavreskimario.github.io/la-trip/) |
| Hello World | A working, copyable starter with the collection’s typography, colours, accessible controls and fluid interactions. | [Hello World](https://stavreskimario.github.io/hello-world/) |
| Engineering Journal | Searchable daily engineering and AI reading list with device-local saves. | [Engineering Journal](engineering-journal/) |

## Engineering Journal

The new [Engineering Journal](engineering-journal/) collects official technical articles into a searchable, filterable reading list. Saves and read status stay in your browser; JSON backup import/export moves them between devices. See its [reader guide](engineering-journal/README.md) and [daily publishing runbook](docs/ENGINEERING_JOURNAL.md).

The daily workflow targets 6 am Australia/Melbourne and is initially disabled. Enabling it requires approval to change the existing Pages source to GitHub Actions; this branch does not change any Pages setting. The initial collection is included with the app.

## LA trip companion

The LA planner now groups **Ideas**, **Expenses**, **Tickets**, **Import plans**, **Calendar** and **Travel & backup** under **Trip tools**. Bookings remain available in its heading and from linked itinerary events. The itinerary adds a countdown/Up next card, exact timezone-aware activity times, manual travel estimates and numbered day stops.

Expenses support AUD/USD, a manual exchange rate, actual AUD card charges, Mario/Andreas splits and repayments. Documents stay in this browser’s IndexedDB. A complete private backup transfers the plan, expenses, documents, packing and map preference. Explicit offline saving keeps the app and plan usable without a connection. Google map tiles and fresh weather still need internet.

See the [LA trip guide](la-trip/README.md) for all workflows, backup compatibility, data limits, offline updates and service boundaries. Shared live editing, automatic image extraction and flight alerts need connected services and are not enabled; manual transfer, reviewed text import and official airline status links work now.

## Edit the LA itinerary

Choose a day, then **Add event** or **Edit** beside an existing event.

- Change the name, free-text time (including its timezone), location, notes and status: **Proposed**, **In itinerary** or **Booked**.
- Move an event to another trip day or choose its position in that day. Events stay in the chosen order; free-text times are not automatically sorted.
- Expand **Map, links & appearance** to edit the saved map location, custom map destination, website, linked booking record, icon and highlight. A custom destination takes priority over a saved location. Directions respect the Google/Apple Maps choice; embedded maps remain Google.
- **Remove event** deletes it from that day. **Undo** restores the last change, including edits, removals, moves and imports, until another change or a reload. Cancelling the editor leaves the itinerary unchanged.
- **Edit day** changes its title, selector label, description, handwritten caption, notes and overview map. Trip dates remain December 20–28, 2026.

Changes save automatically when you press **Save event**, **Add event** or **Save day**. Trip changes are saved together in this browser’s `localStorage` under `mario-la-dec2026-itinerary-v1`. The key is retained for compatibility; its current payload is version 3 and contains day overrides, booking records, map locations and companion data (ideas, tasks, expenses, repayments and budget settings). Events can include exact timing and travel estimates. Untouched days continue using the published defaults. Version 1 and 2 saved itinerary edits load automatically and upgrade on the next save. Reloading keeps saved changes in the same browser and origin. Clearing website data removes them. Private browsing may discard them when the session ends. If storage is blocked or full, the app displays a visit-only notice and keeps the current edits in memory.

**Back up or move your plan** downloads a JSON copy of all nine days, booking records and map locations. The Bookings and Maps toolbars link directly to this backup control. Import that file on another device, review the day/event count and choose **Import itinerary**. Import replaces the local itinerary, bookings and locations together and can be undone immediately. Invalid files leave the current plan intact. Itinerary-only backups include events, exact timing, day notes, booking fields, locations and companion records, but not document contents, packing checks or map preferences. **Trip tools → Travel & backup → Download complete backup** includes those too; see the guide for its reviewed restore and document-merge behavior. Older version 1/2 backups preserve the current companion records because those backups do not contain them. Version 1 backups remain supported: their import preview explains that original booking and location records will be restored because those backups contain only itinerary days. Cancel leaves the current records intact.

This is a static app with no accounts or cloud sync. Local edits do not modify GitHub, change other visitors’ plans or move automatically between the old Sites address and this Pages address. Keep backups somewhere private if you add personal details. Website links accept only HTTP(S) URLs; input is escaped before display. Changes detected from another browser tab are blocked from overwriting that tab’s saved plan; download a backup and reload to resolve it.

## Edit bookings and map locations

Open **Trip tools → Bookings**, then use **Add booking** or **Edit booking**. Edit the name, summary, status, icon, linked map location, website and notes. **Add field** creates a labelled detail such as dates, seats, guests or a confirmation number. Edit or remove any field, then save the record. Cancel discards the draft.

In **Maps**, use **Add location** or **Edit** beside a location. Edit its short/full name, area, label, address, map destination, visitor website and linked trip day. The map destination can be a place name, address or coordinates. It controls the embedded Google map and Google/Apple search and directions links. Saved locations are immediately available in event, day and booking editors. A linked day adds a **See linked day** shortcut; use **Edit day → Day map** to choose that day’s overview map.

Names and details refresh across previews, lists, links and editor choices. Bookings and locations have the same device-local saving, visit-only fallback, cross-tab conflict protection and last-change **Undo** as events.

- **Remove booking** removes the record and clears its links from itinerary events. The events remain.
- **Remove location** removes the saved location and clears its links from day maps and bookings. Events keep their directions by converting that location’s destination to a custom destination; any existing custom destination is preserved.
- **Undo** restores the removed record and its links. Empty Bookings and Maps sections still offer Add controls and stay empty after a reload.

**Booking and event statuses are independent planning labels.** Selecting “Booked” does not buy tickets or make a reservation. Edit the booking record in Bookings and the event in Itinerary as needed. Clearing a booking record does not cancel an actual reservation.

Backups now include any booking details you enter, including confirmation numbers. Keep those files private. Local editing does not publish these details to this public repository.

## Add a new app

First create a descriptive `feature/<short-description>` branch from the latest remote `main`. Make all edits and commits on that branch. From the repository root:

```sh
cp -R hello-world my-app
```

1. Build the new app inside that folder. Update its title, description, favicon and content. Keep its `../shared/` imports and `../` All apps links.
2. Add an entry to the `apps` array in [`apps.json`](apps.json), using a unique folder name and ID:

   ```json
   {
     "id": "my-app",
     "name": "My App",
     "description": "What this app does.",
     "category": "Tool",
     "path": "./my-app/",
     "specimen": "My App"
   }
   ```

3. Run `python3 scripts/validate.py` and check the app’s actual interactions, mobile layout and accessibility.
4. Commit and push the app folder and manifest together on the feature branch, then open a pull request to `main`. Do not push directly to `main`. The collection reads `apps.json`; no homepage card or routing edit is needed. After the pull request is merged, verify the matching Pages deployment and live app URL.

See the [starter recipe](hello-world/README.md), [design language](DESIGN.md), [UI craft reference](docs/UI_CRAFT_REFERENCE.md) and [Codex repository instructions](AGENTS.md). Shared bone colours, Instrument Serif headings, DM Sans body, Caveat accents and motion primitives live in `shared/`. The LA app remains self-contained as the original reference.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html`, `apps.json` | Collection shell and ordered app catalog |
| `shared/` | Common theme, controls, catalog styles and rendering |
| `hello-world/` | Copyable app starter |
| `engineering-journal/` | Daily engineering reader and public article catalogue |
| `scripts/engineering-feed/` | Bounded, standard-library collection and whole-site staging |
| `la-trip/` | Trip app, itinerary/booking/location editor, photos and source attributions |
| `DESIGN.md`, `docs/UI_CRAFT_REFERENCE.md`, `AGENTS.md` | Design decisions, UI craft reference, interaction rules and development lessons |
| `scripts/validate.py` | Manifest, local HTML links/assets and JavaScript syntax checks |

## Development and publishing

All changes, including fixes and documentation, use a `feature/<short-description>` branch and a pull request targeting `main`. Never push or directly update the `main` ref, including through GitHub API/connector tools. Preserve concurrent changes and do not force-push. An open pull request is not a deployment; changes reach the live site after the pull request is merged.

No build step or package install is required to serve the apps. Python 3 and Node.js are needed for the validator:

```sh
python3 scripts/validate.py
python3 -m http.server 8000
```

Open `http://localhost:8000/` and `/la-trip/` or `/hello-world/`. Use HTTP rather than `file://` so the catalog can load its manifest. Localhost has its own browser storage, separate from the live site.

GitHub Pages deploys the **root of `main`** using the existing Pages workflow. Keep `.nojekyll`, preserve relative paths and check the deployment result, not only the commit. The validator is not a substitute for keyboard, touch, reduced-motion, narrow-screen and storage-failure checks. All repository files are public; never commit credentials or private booking references.


UI changes follow the [motion decision rules](DESIGN.md#ui-craft-and-motion-decisions) and include a Before/After/Why review table. The LA planner keeps keyboard navigation immediate and uses restrained pointer feedback while preserving its journal styling. Its saved edits remain device-local.

Browser regressions are in `tests/la-scroll.cjs`, `tests/la-craft.cjs` and `tests/la-travel.cjs`; pure travel-data checks are in `tests/la-travel-core.cjs`; setup commands are at the top of each file. These supplement the static validator and cover relevant touch, keyboard, layout and motion behavior.
