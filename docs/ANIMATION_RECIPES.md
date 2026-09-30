# Animation implementation and review

Read the [animation guide](ANIMATION_GUIDE.md) before selecting a recipe. These buildless examples use native CSS and the apps' existing event handlers. The implementation lives in [shared/motion.css](../shared/motion.css); app-specific feedback lives in each app's CSS and JS.

## Enable the optional recipes

```html
<link rel="stylesheet" href="../shared/motion.css?v=1">
<!-- App-local styles follow shared styles. -->
<details data-motion-disclosure>
  <summary>More details</summary>
  <p>Ordinary, accessible content.</p>
</details>
<dialog data-motion-dialog aria-labelledby="dialog-title">
  <h2 id="dialog-title">Review your changes</h2>
  <!-- Use the app's existing native form and dismissal actions. -->
</dialog>
```

Each app owns input tracking so it can also settle its existing gesture engine. Register it before action handlers. Capture pointer-down, non-modifier keydown and clicks with `event.detail === 0`, updating `document.documentElement.dataset.input` to `pointer` or `keyboard`. Initial mode is `keyboard`. Do not overwrite modality merely because code calls `focus()`; pointer-opened dialogs also focus a field.

On `visibilitychange`, toggle `data-motion-paused` on the root from `document.hidden`. This removes decorative transitions while hidden. Changing the attribute back must not retrigger completed motion. Both apps implement this alongside their input listeners.

An app adopting these recipes must gate its own animated feedback by the same input and preference rules. Importing the stylesheet alone does not make an unrelated JavaScript spring keyboard-safe.

## Native details

Use `data-motion-disclosure` only for occasional, bounded content. The recipe interpolates `height: 0` to `height: auto` on `::details-content`, with a discrete `content-visibility` transition preserving the content during collapse. It is scoped to pointer input, full motion and supported CSS. Removing a transition mid-flight settles to the native open/closed state.

Keep `<summary>` as the first child, and let the browser control `open`, keyboard activation and collapsed descendants. Do not add delayed `open` changes, duplicate ARIA expansion state or measure/fix pixel heights in JS. Content remains usable with this stylesheet absent.

Examples: LA `.reservation` and `.itinerary-backup`; Journal `#filter-details` and `.backup-tools`. Native opening/closing semantics happen immediately; only the layout interpolates. A browser without intrinsic-size interpolation keeps the ordinary instant interaction.

## Native dialogs

Use `showModal()` and `close()` in the existing handlers. Entry uses `@starting-style`, opacity and centered scale `.97`, settling over 180ms. Exit follows the reverse path over 120ms. Discrete `display` and `overlay` transitions retain the visual while it exits.

Never defer saving, `close()`, focus restoration or inertness release until a timer finishes. The closed dialog and its backdrop use `pointer-events: none`, allowing immediate reopening. Keyboard activation, Escape and reduced motion skip movement. Browsers lacking the enhancement show the native dialog directly.

Keep an accessible name, initial focus, native validation, a visible cancel action and a focus-return target. The shared CSS supplies none of that behavior. Examples: LA `#itinerary-editor`; Journal `#import-dialog`.

## A moving selection underline

Journal appends one `aria-hidden` span inside `.view-buttons`, which has `position: relative`. The span is one pixel wide with a left transform origin. After updating each button's `aria-pressed`, `syncViewIndicator()` sets:

```js
indicator.style.transform = `translateX(${selected.offsetLeft}px) scaleX(${selected.offsetWidth})`;
```

Only the transform transitions for 160ms on pointer view changes. Counts, selection and page content update in the same render. Initial placement, unchanged selection, font loading and container resizing synchronize without animation. The original active-button border remains a fallback until the indicator is positioned. A `ResizeObserver` handles geometry changes without restarting every selection transition.

Keep this element stable across renders. Rapid navigation then retargets the CSS transition from its current presentation. Do not slide or fade the article list with it. The buttons keep their existing names, pressed states and keyboard behavior.

## Bookmark feedback without rebuilding the button

Journal keeps an outlined SVG bookmark and adds a decorative filled path. The fill transitions opacity and `scaleY(.7)` to `scaleY(1)` for 160ms when `aria-pressed` becomes true. The label also changes to **Saved** immediately, so feedback does not depend on motion or colour. A minimum button width avoids a Save/Saved layout shift.

`renderArticles()` retains cards only when their IDs and article object references still match. It updates saved/read state in place, removes cards no longer in the results and creates new cards for changed article data. This retains the focused button and the live fill transition for repeated saves. Removing a card from Saved still uses the existing focus-restoration behavior.

Commit local storage and ARIA state before the effect completes. Prefer transitions over restartable keyframes. Do not retain stale article metadata solely to preserve an animation.

## Packing progress

LA keeps its native labelled `<progress>` element for assistive technology. An adjacent `aria-hidden` track and fill provide the visual presentation. `updatePackingCounts()` updates the native `value`/`max`, percentage, live count and decorative `scaleX(count / total)` together. The fill has a left origin and a 160ms transform transition for pointer input.

Checking several items quickly retargets the same fill. Keyboard checks and reduced motion settle immediately. The fill uses system Highlight in forced colours, with a CanvasText track boundary. Local saving still belongs to the existing change handler; no animation completion handler touches user data.

## Review and test

Every UI-change PR includes a **Before | After | Why** table with a concrete interaction in each row. Describe observed behavior, not only CSS values. State browser/device coverage honestly.

1. Activate with pointer, touch, keyboard and zero-detail click. Confirm selection, data and focus change immediately, including while animation is running.
2. Reverse/toggle quickly, close during entry and reopen during exit. Check the intermediate presentation for jumps, invisible click blockers or lost focus.
3. Enable reduced motion during movement. Change input from pointer to keyboard. Hide/resume the page. Confirm settled feedback and no delayed replay.
4. Check narrow widths, 200% text, long labels, resize/font loading, forced colours and reduced transparency. Verify all controls and visible focus remain usable.
5. Disable the optional stylesheet. Confirm native details/dialogs and essential app actions still work.
6. Inspect real intermediate frames for the intended path and scale. Use performance tooling if adding large-area blur, repeated layout or expensive content; do not infer smoothness from property names alone.
7. Run the existing interaction suites so motion does not regress storage, imports, navigation or LA gestures. Physical iOS/Android and Safari feel require a real device/browser review beyond Chromium emulation.

Run from repository root after installing Playwright outside the repository:

```sh
npm install --prefix /tmp/site-browser-tools playwright@1.51.1
/tmp/site-browser-tools/node_modules/.bin/playwright install chromium --only-shell
export NODE_PATH=/tmp/site-browser-tools/node_modules
python3 scripts/validate.py
node tests/animations.cjs
node tests/engineering-journal.cjs
node tests/la-craft.cjs
node tests/la-scroll.cjs
```

Tests serve the repository locally and isolate browser storage. They do not poll publishers, alter trip defaults or publish the site. PR checks run these browser suites plus the existing collector validation and unit tests.
