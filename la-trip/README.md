# LA trip companion

The existing December 20–28, 2026 journal now includes planning and travel tools. It remains a buildless, static GitHub Pages app. The trip’s original facts, Google maps, day rail, booking editor and packing list are retained.

## Find your way around

- **Itinerary:** choose a day, add/edit events, check the countdown or Up next, and browse that day’s numbered stops. On mobile, both the date rail and location cards scroll horizontally.
- **Trip tools → Ideas:** save a place, website and notes without assigning a date. **Add to a day** moves it into the itinerary; Undo reverses the move. Create, edit and complete your own planning tasks.
- **Trip tools → Bookings:** the existing booking records and editor remain available from the section heading, itinerary links and reservation preview.
- **Maps:** Google remains embedded; external place and individual directions links use your Google/Apple preference. Numbered day stops focus the embedded map. Multi-stop links explicitly open Google Maps, in itinerary order, in batches of at most five stops with overlapping endpoints for mobile compatibility. They use driving mode. Individual legs use each activity’s chosen travel mode.
- **Packing:** the original checklist, custom items and saved checks remain intact.

## Exact times and travel

In an event’s editor, expand **Exact times, travel & flight details**. Set optional start/departure/check-in and end/arrival/check-out times, each with its own IANA timezone. Los Angeles and San Francisco use `America/Los_Angeles`; Melbourne uses `Australia/Melbourne`. Flights can include their number, airports and terminal/gate.

Existing free-text time labels remain supported. Exact times, when supplied, drive the displayed time, Up next and calendar export. No unknown flight times are filled in. The two game times already in the published itinerary are structured without independently verifying their schedules. A version 1/2 edited event keeps its own time label and is not silently assigned the new default schedule.

Travel minutes and arrival buffers are manually entered estimates, not a traffic service. Event details show a leave-by time when possible and warn when the previous event’s end, travel estimate and buffer do not fit. An absent end or travel estimate is not guessed. Events remain in the user’s chosen order. Editing/moving an event does not automatically change its precise departure date; check both fields when rescheduling.

Up next considers non-proposed events with precise starts, and keeps an ongoing activity until its known end. A multi-night hotel stay does not hide later activities after check-in. Before the trip, the countdown uses the departure date in Melbourne. During the trip, the day context uses Los Angeles time. The clock refreshes when the page becomes visible and once a minute while visible.

## Budget and expenses

Under **Trip tools → Expenses**:

1. Set an optional total budget in AUD and your own planning conversion rate, expressed as **1 USD = X AUD**. No rate or cost is invented or fetched.
2. Add an expense in USD or AUD and mark it **Planned** or **Paid**. Changing that status moves the amount between totals; it does not create another expense.
3. Select Mario or Andreas as payer and set Mario’s percentage share. Andreas covers the rest. A 100% or 0% share makes it a personal cost.
4. For a paid USD expense, optionally enter the actual AUD card charge. It overrides the planning rate and stays fixed when that rate changes.
5. Record repayments separately in AUD. They reduce the shared balance and never increase trip spending.

Amounts are integer cents; each converted expense and share rounds once to the nearest cent. The remaining budget includes paid and planned amounts. Without a rate, unconverted USD expenses are explicitly excluded and totals/balances are marked incomplete. The shared balance includes only paid expenses and repayments. Categories, date, notes and an optional activity link are editable. Removing an activity preserves its expense record, with an unlinked-activity note.

## Tickets and documents

Use **Tickets & documents** on an activity or **Trip tools → Tickets**. PDFs, PNGs, JPEGs, WebP images and text files are stored in this origin’s IndexedDB. Limits: 5 MB per file, 20 MB combined and 40 files. Basic MIME/signature checks reject mismatched formats. Files are downloaded/opened through a blob URL, not interpolated as HTML.

Files are never uploaded by this app or committed to GitHub. Anyone using the same browser profile/origin may be able to access them. Clearing site data removes them. Keep originals. A removed document can be restored with **Undo document removal** until another removal or reload. Removing an event retains its documents and original activity label. File storage errors are shown rather than silently treating an attachment as saved.

## Reviewed import and calendars

**Import plans** accepts one idea per line, optionally in this format:

```text
Name | 24 Dec | Afternoon | Location | https://example.com
```

Review and edit each item, select its day or keep it as an unscheduled idea, and uncheck unwanted items. Imports add proposed events; they never assert a reservation is booked. At most 50 items and 30,000 characters are accepted per import. Time labels remain free text. For a screenshot/PDF, copy its text with the device’s text-selection feature, then paste it. Automatic OCR/AI extraction is not connected.

**Calendar** exports the whole trip, selected activities, or a single event’s `.ics` file. Precise times convert to UTC instants across timezones. Unknown times become all-day reminders explicitly labelled as such; proposed events are tentative. Stable UIDs and UTF-8 line folding are included. Export is not calendar sync; calendar applications may duplicate reimported files. Nonexistent or ambiguous daylight-saving clock times are rejected instead of silently picking an instant; enter ambiguous times in UTC.

## Backups, migration and conflicts

The itinerary storage key stays `mario-la-dec2026-itinerary-v1`. Its payload is now **version 3**: the existing days, places and reservations plus `companion` (ideas, tasks, expenses, repayments, budget and rate). Events may have a `schedule`. Version 1/2 saved plans and complete nine-day itinerary backups remain readable. Old backups preserve existing companion data, because they do not contain it. Version 1 backups restore the original booking/location collections as before.

- **Itinerary-only backup**, including the original **Back up or move your plan** control, includes the plan, all companion records and exact timing. It excludes file contents, packing and map preference. The existing import preview and immediate trip Undo still apply.
- **Complete backup** additionally includes document contents, packing checks and map preference. It is a private JSON download, limited to 32 MB on import. A preview must be accepted before replacing the plan/packing/preference. Invalid input does not change the plan. Documents are merged transactionally; identical IDs/content are deduplicated, differing collisions get new IDs, and existing files are kept.
- Complete restore does not promise an atomic transaction across localStorage and IndexedDB. If a concurrent tab saves during document merge, the plan restore is blocked, packing/preferences are unchanged, and the UI explains that documents were added. Trip Undo does not undo file merges, packing or map preference; download a backup first to preserve those states.
- Cross-tab revision checks prevent an old tab overwriting a newer saved itinerary. Download that tab’s plan and reload to resolve the conflict. Blocked/full localStorage falls back to a visibly labelled visit-only plan. Document writes report failure and keep originals with the user.

Nothing syncs automatically to GitHub, other visitors, other devices or the old Sites origin. Browser storage is shared by origin, not URL path. A future move from `/la-trip/` to `/apps/la-trip/` on the same hostname retains localStorage/IndexedDB, but must migrate or retire the old service-worker scope separately.

## Offline and external services

**Travel & backup → Save / update offline copy** installs a service worker scoped to the app folder, including project Pages prefixes. It caches only an explicit list of this app’s shell/assets. It does not cache maps, weather, external websites, credentials or sibling apps. Edits and stored documents work offline. Maps and fresh forecasts need a connection; externally hosted fonts may use local fallbacks if they have not been cached by the browser. Saving offline is not a backup, and browser storage can be evicted. Update the offline copy before departure.

The service worker does not force a reload over an open editor. New deployments must bump asset query versions and the worker cache version together, and keep `CORE` complete. Activating an update only removes older caches with the same app-scope prefix. The manifest uses relative start/scope paths; no install prompt is forced.

Weather is an explicit request to Open-Meteo’s forecast API for the centre of LA or San Francisco, with attribution. It sends coordinates/timezone, not itinerary or documents, and never requests location permission. Only trip dates within the available forecast horizon (up to 16 days) are shown. Before that, the app says the forecast is unavailable; errors do not generate substitute weather. See [Open-Meteo documentation and terms](https://open-meteo.com/en/docs) for its non-commercial service and limits.

For a multi-stop route **inside** the Google iframe, optional **Google route map setup** accepts a browser key restricted to the website and Maps Embed API. It is device-local, excluded from backups, and necessarily visible to that browser/Google. Configure [website and API restrictions](https://developers.google.com/maps/documentation/embed/get-api-key) in Google Cloud. Without it, ordinary place embeds and external day routes remain working. Google draws route markers; the numbered UI list is linked to events. Routes over the Embed API waypoint limit fall back to individual place maps and external route batches. Map route times are not written into event estimates. See [Embed directions](https://developers.google.com/maps/documentation/embed/embedding-map) and [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

Live flight alerts, automatic image/document extraction, calendar synchronization and simultaneous shared editing are **not connected**. Flight cards link to United/Delta’s official status pages. Complete backup transfer is manual. A future connected release needs an authenticated backend, private file storage, per-trip membership and conflict handling, server-held provider keys, explicit document-processing consent, rate limits and deletion controls. No mock sync, public upload bucket, client-side secret or fake flight status is included in this PR.

## Verification

```sh
python3 scripts/validate.py
node tests/la-travel-core.cjs
# With Playwright installed outside the repository:
PLAYWRIGHT_MODULE=/path/to/playwright node tests/la-scroll.cjs
PLAYWRIGHT_MODULE=/path/to/playwright node tests/la-craft.cjs
PLAYWRIGHT_MODULE=/path/to/playwright node tests/la-travel.cjs
```

The core checks cover cent math, splits/repayments, rates, validation, timezone/DST conversion, calendar folding, routes and import parsing. Browser checks cover the user flows, backup/restore and migration, unsafe data rejection, cross-tab conflicts, narrow/large-text layouts, and offline behavior under a project prefix. Existing gesture/craft checks remain delivery gates. Physical iPhone/Safari, screen-reader use, paid Google key authorization and real upcoming-trip forecasts require separate real-device/provider validation.
