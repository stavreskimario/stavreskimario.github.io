# Mario’s Codex sites

This repository is a public, buildless GitHub Pages collection. Read `DESIGN.md` and `hello-world/README.md` before creating an app.

## Branch and pull request workflow

- Make every repository change on a feature branch, including app work, fixes and documentation. Start a descriptive `feature/<short-description>` branch from the latest remote `main` before editing.
- Commit and push only to the feature branch. Never commit directly to `main`, push to `main`, or update the `main` ref directly through a GitHub connector/API.
- Open a pull request from the feature branch to `main`, with a concise explanation and relevant validation results. Keep changes on the feature branch until the pull request is merged through the repository’s review workflow; do not bypass the pull request to publish.
- Re-read the remote base and feature branch before writing, preserve concurrent changes, and do not force-push.
- GitHub Pages continues to deploy from `main`. A feature-branch push or open pull request does not publish the site. When a pull request is merged, verify the matching Pages deployment and live URLs before reporting a change as published.

## Add an app

1. Copy `hello-world/` to a new, unique, lowercase kebab-case folder at repository root.
2. Adapt that copy’s title, description, favicon, visible content, styles and behavior to the requested app. Keep `../shared/` imports and the `../` All apps links.
3. Add its entry to the root `apps.json`. The collection reads that file at runtime; no additional card markup or route configuration is required.
4. Run `python3 scripts/validate.py`, then verify the actual requested interactions. Commit all new app files and the manifest together on the feature branch and open a pull request to `main`. Merging the pull request triggers the existing GitHub Pages deployment; verify that deployment and the live subpage after merge.

Do not overwrite another app, remove unknown files, force-push, or change the publishing source. Re-read remote main before editing/publishing and preserve concurrent changes. Use the requested GitHub Pages destination rather than creating a separate Sites-hosted copy.

## Design and implementation

- Preserve the established bone paper, Instrument Serif display type, DM Sans body and Caveat handwriting. Mario explicitly rejected a generic white/system-font redesign. Apple-inspired behavior belongs on top of this visual identity.
- Reuse `shared/theme.css` and `shared/ui.js` for new apps. Put app-specific CSS and JS inside the app folder. Shared-file changes affect every consuming app: verify the collection and Hello World when changing them.
- `la-trip/` is the original, self-contained reference implementation. It is intentionally not silently migrated to shared assets: preserve its appearance, Google map embeds, Google/Apple link choice, all nine days and device-local packing state unless explicitly asked to change them.
- Do not put implementation instructions in a product’s main flow. The Hello World README and DESIGN.md carry the developer instructions.
- Keep app paths relative: `./app.js`, `./assets/photo.jpg`, `../shared/theme.css`, `../` for the collection. Avoid root-absolute paths so the collection can also live under a project Pages URL.
- Use semantic buttons, links, forms, labels and native details. Scope delegated clicks to actionable elements, e.g. `button[data-style]`, not a broad `[data-view]` selector that can accidentally match the body and swallow unrelated clicks.
- Never block clicks while animation runs. Spring retargeting preserves live position and velocity. Commit actions on click/submit, with immediate pointer-down feedback.
- Use textContent / DOM construction for input and catalog data, not interpolated untrusted HTML. Validate manifest paths; no external script URLs or traversal paths in entries.
- New apps default to transient state. Persist only requested device-local preferences with an app-specific versioned key, try/catch and honest feedback when storage is unavailable. No credentials, private booking references, or secrets in this public repository. GitHub Pages has no private server runtime.
- Do not invent trip facts, reservations, app entries or capabilities. List only working, published app folders.

## Checks and handoff

`python3 scripts/validate.py` verifies manifest structure, app entrypoints, relative HTML asset/link targets and JavaScript syntax. It is a delivery gate, not browser or accessibility certification. Check keyboard use, narrow layout/text enlargement, reduced-motion behavior and any real gesture added. Test concrete regressions, not redundant implementation details. State any physical-device/browser limitation honestly.

Retain the existing Pages setup and `.nojekyll`. A successful commit is not proof of deployment: check the matching Pages run and live paths. Future edits follow the user’s requested app scope and current publication authorization; this document does not grant new permissions.
