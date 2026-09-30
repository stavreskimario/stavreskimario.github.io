# Engineering Journal: collection and publishing

## Cost and architecture

Static HTML/CSS/JavaScript stays on this existing public GitHub Pages repository. A scheduled GitHub Actions run retrieves public metadata and publishes the complete site as a Pages artifact. Collection uses Python’s standard library. No paid service, database, API key, AI inference, proxy subscription or separate hosting account is required. Standard GitHub-hosted Linux runners are free for public repositories under GitHub’s current policy. Stay within Pages limits; review costs before moving to a private repo or paid runner.

References: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [schedule timezones](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule), [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The reader fetches only its own catalogue when opened. It does not poll publishers, use cross-origin proxies or collect visitor data. Reading state stays on the device. Existing shared Google-hosted font imports remain.

## Daily pipeline

1. At `0 6 * * *` in `Australia/Melbourne`, check out latest `main`. This is one daily collection. Manual runs allow an intentional extra check.
2. Recover and validate the last deployed catalogue over HTTPS. Only HTTP 404, representing initial setup, permits the checked-in starter collection. Other network/schema failures stop publication so the archive cannot silently revert to the seed.
3. Fetch official RSS/Atom or HTML indexes. At most three sources run concurrently, with 20-second socket timeouts, 4 MB compressed/decompressed limits, host allowlists, redirect checks and conditional HTTP headers where available. The job has a 12-minute ceiling. No full-article crawling is required.
4. Extract titles, canonical URLs, actual publication/update dates where present and short publisher excerpts. Strip tracking parameters and filter common corporate announcements. Infer topics/types using documented keyword rules. HTML adapters isolate card headings and dates; no extracted links is a visible parser failure.
5. Deduplicate URLs while retaining stable IDs and first-seen dates. Keep a rolling 180 days, capped at 2,000 items. Undated items use first-seen time for retention only, never as a displayed publication date. Failed sources keep earlier records within these limits; if all sources fail, exit without publishing.
6. Validate data and site entrypoints; run offline collector tests. Stage root navigation, `.nojekyll`, shared assets and every app in `apps.json`, including LA photos. Exclude Git history, workflows and scripts. Upload a one-day-retention artifact and deploy with pinned official Pages actions.

Daily data updates create no commits or PRs. Code still changes only through feature branches and reviewed PRs. Code merges reuse live data without polling again. Publishing uses one concurrency group; a running deployment finishes before the next run recovers its catalogue. Every build checks out current `main`, and a final SHA check refuses code superseded during collection. The next merge-triggered run handles that newer revision.

## One-time activation — owner approval required

**This PR does not change the current Pages source or activate the scheduler.** `AGENTS.md` prohibits changing the publishing source without authorization. The workflow is gated by `ENGINEERING_JOURNAL_PAGES_ENABLED == 'true'`.

After reviewing the PR and explicitly approving the publishing change:

1. Merge through the normal PR review workflow. Existing branch-based Pages can publish the reader with its starter collection.
2. In **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. Retain the existing public destination and restrict the `github-pages` environment to `main`.
3. In **Settings → Secrets and variables → Actions → Variables**, add `ENGINEERING_JOURNAL_PAGES_ENABLED` with value `true`. No custom secrets are required; deployment uses the built-in job token.
4. Run **Engineering Journal and Pages** manually on `main`. Verify build/deployment and live `/`, `/la-trip/`, `/hello-world/`, `/engineering-journal/` and `/engineering-journal/data/catalogue.json`. Check article counts/statuses and existing app assets.
5. Verify the next Melbourne 6 am run. A commit alone is not proof of publication.

GitHub schedules are best effort, especially on the hour. They run on the default branch and can be disabled after 60 days without repository activity in a public repo. Re-enable in Actions if necessary. The reader flags data older than 36 hours. This free setup does not promise minute-exact delivery.

## Maintenance and failure handling

Edit the source registry through a feature PR. Adding a source preserves existing history; removing a source requires an explicit catalogue migration because recovery rejects unknown source IDs. Prefer dedicated engineering feeds/indexes over general news. Add an offline fixture for adapter changes. Do not silently broaden allowlists, proxy blocked sources or invent links.

Source records retain last attempt/success, endpoint, HTTP validators and a short diagnostic. The UI presents reader-friendly status and original blog links. At implementation, xAI and Perplexity returned HTTP 403 from this runtime; they may need an accessible official feed before automated collection works reliably. A separately verified starter xAI link does not imply a successful poll.

| Failure | Behavior |
| --- | --- |
| One source times out, blocks requests or changes markup | Mark unavailable, retain its metadata within retention bounds, publish successful sources |
| All sources fail | Fail the job; leave the deployed site untouched |
| Previous catalogue fetch/schema fails | Fail closed; only HTTP 404 permits the seed |
| Generated data/site validation fails | No deployment |
| New main commit during collection | Refuse outdated code; the merge-triggered run handles the latest revision |
| Browser storage blocked/full | Visit-only saves, export available, visible notice |
| Invalid reading-list backup | Reject without altering current state |

Pause publishing by setting the gate variable to `false` or disabling the workflow; the current site stays available. Roll back code with a normal revert PR. Returning to branch-based Pages requires approval: disable this workflow and switch Pages back to `main` / root. That uses checked-in starter data until collection is enabled again. Routine data repair must not change Pages settings or bypass PR review.
