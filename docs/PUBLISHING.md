# Static site publishing and staging

The existing branch/root GitHub Pages source is retained. Its last verified source is `feature/penn-station-1935-reconstruction` / root; it must not be inferred from the default branch. This change does not alter hosting settings, activate another deployment method or schedule external collection. All apps are static; the collection and staging tool read `apps.json`.

## Validate and stage

From the repository root:

```sh
python3 scripts/validate.py
python3 -m unittest discover -s tests -p 'test_site_staging.py'
python3 scripts/site-publishing/stage.py /path/to/new-pages-directory
```

Choose a staging directory that does not already exist and does not contain the source checkout. The stager copies the root shell, `.nojekyll`, shared assets and every registered app, including its images and local runtime assets. Git history, workflows, source/review archives and unrelated directories are excluded. Hidden files and symlinks within an app are rejected. The current custom artifact budget remains 160,000,000 bytes; the complete legacy-root public site has its separate below-1GB requirement. A custom staging exclusion does not make repository files private.

The stager was moved without content changes from its former feed-specific location. It performs no network requests or catalogue updates. Site checks run these static/staging controls for pull requests; app-specific browser checks remain separate.

## Optional Actions publisher

`site-pages.yml` preserves the optional whole-site Actions publisher, with pinned official actions, serialized deployments, current-`main` checkout and a final revision check. It has manual and `main`-push triggers, with no schedule, feed fetch or catalogue recovery. Its build is disabled unless `PAGES_ACTIONS_ENABLED` is explicitly set to `true`.

That generic gate does not activate itself and does not change the current branch-based Pages source. Switching the Pages source to GitHub Actions still requires separate owner authorization and a matching deployment check. No repository variables or hosting settings were changed during app removal. A successful commit or PR does not establish a live deployment.
