# Engineering Journal

A daily reader for official engineering and research blogs, using the collection’s bone paper, Instrument Serif, DM Sans, Caveat and shared controls.

## Read and save

- **Latest:** newest dated articles first; undated articles follow with “Date unavailable”. Search titles, publisher excerpts, teams and topics. Combine company, topic, date, type and unread filters. Filters are shareable in the URL; Back restores earlier choices.
- **Saved:** save articles and mark them read on this browser. Clearing browser data removes the list. No account, tracking or cloud sync. **Back up or move your reading list** exports JSON; import previews and merges saves/read status without discarding existing saves. Saved metadata survives removal from the rolling public catalogue.
- **Sources:** see the official blog, collected count and latest check status. A failed check retains prior links within the catalogue’s retention window. Empty sources still link to their original blog.

State uses `mario-engineering-journal-v1` in `localStorage`, with a visit-only fallback and visible notice when storage is blocked, full or unreadable. Tabs merge updates by timestamp; this is lightweight browser state, not transactional sync. Export before moving browsers or clearing data.

Articles open on the publisher’s website. The app contains links, dates and short publisher excerpts, not full articles or generated AI summaries. Topic/type labels use deterministic keyword rules and can be imperfect. Publication dates are never invented; first-seen time is separate.

## Sources and collection

The Python standard-library collector reads the [source registry](../scripts/engineering-feed/sources.json). It uses RSS/Atom where suitable and official HTML indexes for dedicated engineering content or publishers without feeds. OpenAI uses its engineering index rather than general news. Uber is first in the source picker. Other sources include Anthropic, Google Research, DeepMind, Meta, xAI, Cursor, Perplexity, Thinking Machines, Together AI, Databricks, GitHub, Cloudflare, Netflix and Spotify.

The starter collection was fetched from official sources during implementation. Its xAI link was separately verified on the [official article](https://x.ai/news/designing-grok-bot). At implementation, xAI and Perplexity returned HTTP 403 to the collector, so their automated checks still report failure. Restrictions are not bypassed and full coverage is not promised. Some indexes omit dates/excerpts; those fields remain absent.

The prepared workflow targets **06:00 Australia/Melbourne**, including daylight saving. GitHub may queue a run, so the interface says “around 6 am”. It is initially disabled pending approval of the Pages publishing change. See the [publishing runbook](../docs/ENGINEERING_JOURNAL.md).

## Local development

From the repository root, run `python3 -m http.server 8000`, then open `http://localhost:8000/engineering-journal/`. No frontend build or package install is required. To intentionally collect once, run `python3 scripts/engineering-feed/collect.py`.

```sh
python3 scripts/validate.py
python3 scripts/engineering-feed/collect.py --validate-only
python3 -m unittest discover -s tests -p 'test_engineering_feed.py'
```

For browser checks, install Playwright 1.51.1 outside the repository, install its Chromium headless shell, then run `tests/engineering-journal.cjs` with that installation’s `node_modules` in `NODE_PATH`. Tests start their own local server and do not poll publishers. Chromium emulation covers narrow layouts and accessibility preferences; physical iOS/Android and Safari checks still need a person/device.

## Motion implementation

The view underline and bookmark fill provide brief pointer feedback. Search/results and saved state update immediately; unchanged article cards retain focus and DOM continuity. The native import dialog and filter/backup disclosures opt into `shared/motion.css`. Keyboard/AT actions, reduced motion and hidden tabs settle to the current state without decoration. See the [animation guide](../docs/ANIMATION_GUIDE.md), [recipes](../docs/ANIMATION_RECIPES.md) and `tests/animations.cjs` for input switching, interruption and fallback checks.
