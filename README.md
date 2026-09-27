# Mario’s sites

A collection of small apps built with Codex. Live at **[stavreskimario.github.io](https://stavreskimario.github.io/)**, published from this repository with GitHub Pages.

## Apps

| App | What it does | Open |
| --- | --- | --- |
| Nine Days in Los Angeles | December 20–28, 2026 trip journal with an editable daily itinerary, editable booking records and map locations, Google map embeds, Google/Apple directions and a packing checklist. | [LA trip](https://stavreskimario.github.io/la-trip/) |
| Hello World | A working, copyable starter with the collection’s typography, colours, accessible controls and fluid interactions. | [Hello World](https://stavreskimario.github.io/hello-world/) |

## Edit the LA itinerary

Choose a day, then **Add event** or **Edit** beside an existing event.

- Change the name, free-text time (including its timezone), location, notes and status: **Proposed**, **In itinerary** or **Booked**.
- Move an event to another trip day or choose its position in that day. Events stay in the chosen order; free-text times are not automatically sorted.
- Expand **Map, links & appearance** to edit the saved map location, custom map destination, website, linked booking record, icon and highlight. A custom destination takes priority over a saved location. Directions respect the Google/Apple Maps choice; embedded maps remain Google.
- **Remove event** deletes it from that day. **Undo** restores the last change, including edits, removals, moves and imports, until another change or a reload. Cancelling the editor leaves the itinerary unchanged.
- **Edit day** changes its title, selector label, description, handwritten caption, notes and overview map. Trip dates remain December 20–28, 2026.

Changes save automatically when you press **Save event**, **Add event** or **Save day**. Trip changes are saved together in this browser’s `localStorage` under `mario-la-dec2026-itinerary-v1`. The key is retained for compatibility; its current payload is version 2 and contains day overrides, booking records and map locations. Untouched days continue using the published defaults. Version 1 saved itinerary edits load automatically and upgrade on the next save. Reloading keeps saved changes in the same browser and origin. Clearing website data removes them. Private browsing may discard them when the session ends. If storage is blocked or full, the app displays a visit-only notice and keeps the current edits in memory.

**Back up or move your plan** downloads a JSON copy of all nine days, booking records and map locations. The Bookings and Maps toolbars link directly to this backup control. Import that file on another device, review the day/event count and choose **Import itinerary**. Import replaces the local itinerary, bookings and locations together and can be undone immediately. Invalid files leave the current plan intact. Backups include itinerary events, day notes, booking fields and locations, but not packing checks or map preferences. Older version 1 backups remain supported: their import preview explains that original booking and location records will be restored because those backups contain only itinerary days. Cancel leaves the current records intact.

This is a static app with no accounts or cloud sync. Local edits do not modify GitHub, change other visitors’ plans or move automatically between the old Sites address and this Pages address. Keep backups somewhere private if you add personal details. Website links accept only HTTP(S) URLs; input is escaped before display. Changes detected from another browser tab are blocked from overwriting that tab’s saved plan; download a backup and reload to resolve it.

## Edit bookings and map locations

In **Bookings**, use **Add booking** or **Edit booking**. Edit the name, summary, status, icon, linked map location, website and notes. **Add field** creates a labelled detail such as dates, seats, guests or a confirmation number. Edit or remove any field, then save the record. Cancel discards the draft.

In **Maps**, use **Add location** or **Edit** beside a location. Edit its short/full name, area, label, address, map destination, visitor website and linked trip day. The map destination can be a place name, address or coordinates. It controls the embedded Google map and Google/Apple search and directions links. Saved locations are immediately available in event, day and booking editors. A linked day adds a **See linked day** shortcut; use **Edit day → Day map** to choose that day’s overview map.

Names and details refresh across previews, lists, links and editor choices. Bookings and locations have the same device-local saving, visit-only fallback, cross-tab conflict protection and last-change **Undo** as events.

- **Remove booking** removes the record and clears its links from itinerary events. The events remain.
- **Remove location** removes the saved location and clears its links from day maps and bookings. Events keep their directions by converting that location’s destination to a custom destination; any existing custom destination is preserved.
- **Undo** restores the removed record and its links. Empty Bookings and Maps sections still offer Add controls and stay empty after a reload.

**Booking and event statuses are independent planning labels.** Selecting “Booked” does not buy tickets or make a reservation. Edit the booking record in Bookings and the event in Itinerary as needed. Clearing a booking record does not cancel an actual reservation.

Backups now include any booking details you enter, including confirmation numbers. Keep those files private. Local editing does not publish these details to this public repository.

## Add a new app

From the repository root:

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
4. Commit the app folder and manifest together to `main`. The collection reads `apps.json`; no homepage card or routing edit is needed. Verify the matching Pages deployment and live app URL.

See the [starter recipe](hello-world/README.md), [design language](DESIGN.md) and [Codex repository instructions](AGENTS.md). Shared bone colours, Instrument Serif headings, DM Sans body, Caveat accents and motion primitives live in `shared/`. The LA app remains self-contained as the original reference.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html`, `apps.json` | Collection shell and ordered app catalog |
| `shared/` | Common theme, controls, catalog styles and rendering |
| `hello-world/` | Copyable app starter |
| `la-trip/` | Trip app, itinerary/booking/location editor, photos and source attributions |
| `DESIGN.md`, `AGENTS.md` | Design decisions, interaction rules and development lessons |
| `scripts/validate.py` | Manifest, local HTML links/assets and JavaScript syntax checks |

## Development and publishing

No build step or package install is required to serve the apps. Python 3 and Node.js are needed for the validator:

```sh
python3 scripts/validate.py
python3 -m http.server 8000
```

Open `http://localhost:8000/` and `/la-trip/` or `/hello-world/`. Use HTTP rather than `file://` so the catalog can load its manifest. Localhost has its own browser storage, separate from the live site.

GitHub Pages deploys the **root of `main`** using the existing Pages workflow. Keep `.nojekyll`, preserve relative paths and check the deployment result, not only the commit. The validator is not a substitute for keyboard, touch, reduced-motion, narrow-screen and storage-failure checks. All repository files are public; never commit credentials or private booking references.
