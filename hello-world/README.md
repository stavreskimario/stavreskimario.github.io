# Hello World — copyable app starter

This is a live, working subpage and the starting point for new apps in Mario’s collection. Shared appearance and physics live one level up in `shared/`; copying this folder retains them.

## Publish another app

Create a descriptive `feature/<short-description>` branch from the latest remote `main` before editing. Work and commit on that branch. From the repository root:

```sh
cp -R hello-world my-app
```

Build the requested experience inside `my-app/`. Update its HTML title, description, favicon and visible name; replace the greeting behavior with the real app. Keep `../shared/` imports and the `../` All apps link. Keep files beside index.html or in an app-local assets/ folder.

Append this object to the `apps` array in root `apps.json` (use a unique id and real content):

```json
{
  "id": "my-app",
  "name": "My App",
  "description": "A concise description of what this app does.",
  "category": "Tool",
  "path": "./my-app/",
  "specimen": "My App"
}
```

For a real photo preview, replace specimen with `image: "./my-app/assets/preview.jpg"` and meaningful `imageAlt`. `meta` is optional short context. Do not invent images or apps. Array order controls collection order. No manual homepage card or router edit is needed.

Run `python3 scripts/validate.py`. Preview with an HTTP server (for example `python3 -m http.server 8000` from the repository root); file:// cannot load the manifest reliably. This is optional local developer guidance, not a replacement for a managed preview workflow when one is required by the environment. Check the app at `/my-app/`, its All apps link, keyboard use, phone-width layout, longer text and reduced motion. Commit and push the folder plus apps.json on the feature branch, then open a pull request targeting `main`. Never push or directly update `main`, including through connector/API tools. After the pull request is merged through the repository’s review workflow, existing GitHub Pages publishing deploys the merge; verify the matching run and live URL.

## Files

- index.html: semantic app shell, metadata, safe-area viewport, shared imports and links back to the collection.
- styles.css: app-specific layout only; shared tokens stay in shared/theme.css.
- app.js: transient greeting state, native form actions, segmented selection, direct-manipulation rail and status feedback. Data is rendered with textContent.
- README.md: this recipe. Adapt it to the new app as needed.

## What this example demonstrates

A name form and reset action; English/Spanish/Italian greetings; a simple/warm segmented control; swipeable choices with tap and keyboard alternatives; press feedback, interruptible springs, velocity projection and soft boundaries; bone-tinted floating navigation; reduced-motion, transparency and contrast support. Nothing is saved or transmitted. If shared UI fails to load, the ordinary form and option buttons still work.

Read ../DESIGN.md for the design language and ../AGENTS.md for repository conventions. Reuse the primitives that serve the requested app; remove demo controls that don't. Never add trip data to a new app just because the LA planner is the visual reference.
