# The shared design language

## Purpose and identity

A calm, tactile collection of useful small apps. Start with the task, visible controls and useful content. Safety/predictability, understanding, achievement and joy are the goals. Purpose, agency, responsibility, familiarity, flexibility, simplicity, craft and delight guide trade-offs. Simplicity means understandable, not stripping away the personality or hiding every action.

The visual reference is the LA travel journal, refined with fluid interactions. Keep bone paper, warm ink, rust and coastal blue; editorial serif headings; occasional handwritten annotations; rounded corners; clear grouping and generous but economical spacing. Do not replace this with generic white cards and system-font headings. System fonts remain fallbacks: the custom faces are an intentional, user-approved exception.

## Tokens (shared/theme.css)

| Role | Value |
| --- | --- |
| Paper / raised surface / canvas | `#faf7ef` / `#fffdf7` / `#e9e2d7` |
| Ink / secondary text | `#39362f` / `#71685d` |
| Rust / coast / dark coast | `#ad5738` / `#63828a` / `#436672` |
| Border / quiet fill | `#e2d8c7` / `#efe7d9` |
| Controls / panels | `.875rem` / `1.5rem` corners |
| Display / body / handwriting | Instrument Serif / DM Sans / Caveat |
| Default body | `1rem`, line-height `1.5–1.6`, tracking near zero |
| Display | responsive clamp, leading `1.03–1.08`, tracking `-.025–.03em` |
| Secondary labels | usually `.875rem`; `.8125rem` only for short metadata |
| Touch targets | at least `2.75rem` (44px at default text size) |

Use rem/em and flexible grids; support 200% text enlargement, long names and narrow viewports. Do not fix heights around variable text. Handwriting is an accent, never essential small-print instructions. Use explicit, specific action labels.

## Shared primitives

Load `../shared/theme.css`, then app-local CSS. Load the deferred `../shared/ui.js` before app JS. The global `SiteUI` exposes:

- `Spring(value, render, response = .34, epsilon = .08)`: `.set(value)` for direct manipulation; `.to(target, {velocity, damping})` for spring settling; `.stop()` retains the presentation value. `.value`, `.velocity` and `.running` expose current state. Velocity is in value units per second, not relative velocity. Response is a tuning parameter, not a promised duration.
- `SelectionPill(group, selectedSelector)`: `.sync()` after updating ARIA selection; `.sync(true)` after layout changes. An anchored solid selection surface follows independent X/Y springs. Keep segment sizes equal and handle resize/font loading as Hello World does.
- `mountRail(element, onSelect)`: put sequential `button[data-slide="0"]`, `1`, etc. inside `.snap-rail`; use `aria-pressed` for selection. Returns `.choose(index)`, `.center(index)`, `.refresh()`. Supports taps, keyboard arrows/Home/End, pointer dragging, horizontal wheel input, momentum and cancellation. Call once after content exists. The static HTML/native overflow remain usable without the enhancement. Flicks browse; taps choose.
- `motionPreference`, `project(velocity)`, `rubberband(distance, dimension)` for relevant custom controls.

Press feedback is delegated automatically to buttons, links, summaries and optional `[data-press]` targets. Don’t initialise a second press controller. CSS `:active` provides immediate colour feedback; the spring carries press/release scale continuously. Native keyboard activation remains intact.

`../shared/motion.css` is a separate optional import before app-local CSS. Its explicit data attributes enable native details/dialog recipes; it also supplies easing and 160ms feedback, 200ms disclosure, 180ms dialog-entry and 120ms dialog-exit tokens. See the [animation guide](docs/ANIMATION_GUIDE.md) and [implementation/review recipes](docs/ANIMATION_RECIPES.md). Apps own input tracking and instant semantic state updates.

## Fluid behavior

1. **Response:** highlight on pointer-down, commit on click/touch-up. No arbitrary debounces, timers or transition locks in the input path. `touch-action: manipulation` on controls avoids legacy tap delay. Update form state immediately and report meaningful completion inline.
2. **Direct manipulation:** Pointer Events track from the original grab point. A 10px direction threshold distinguishes horizontal drag from vertical page scrolling; capture starts when horizontal intent wins, then movement follows 1:1. Keep vertical scrolling and pinch zoom available. Cancel drag-generated clicks.
3. **Interruptibility:** every retarget starts from the live spring value and retains velocity. A pointer-down stops the moving rail at its current presentation so it can be grabbed and reversed. Never set a new start position from the previous target. Use independent springs for X and Y.
4. **Springs:** default damping `1`, response `.3–.4`; rail `.38`. Only momentum releases use damping `.8`. Press feedback uses a smaller `.19` response; frequent content changes stay immediate. No decorative bounce on ordinary menus or toggles. Gesture motion must not use fixed CSS transitions/keyframes.
5. **Velocity handoff:** sample up to eight positions over the last 100ms. Treat a stopped finger as zero velocity. A direction reversal drops stale samples from the prior direction. Pass release velocity directly into the settling spring, in px/s for translation.
6. **Projection:** `current + (velocity/1000) * .998 / (1-.998)`, then choose the nearest valid snap point. Clamp the destination to the content range. Do not use the ballistic `v²/(2a)` formula.
7. **Boundaries:** while dragging, apply `distance * dimension * .55 / (dimension + .55 * abs(distance))` beyond an edge. Settle back with a spring. Cancellation uses zero momentum. Reduced motion clamps edges without elasticity.
8. **Spatial consistency:** selection indicators remain anchored inside their control; state changes are immediate. If a future app needs a sheet/popover, use symmetric entry/exit paths, an origin tied to its trigger for popovers (centered for viewport modals) and accessible dismissal/focus restoration. Do not add a sheet just to show an animation.
9. **Direction and continuity:** intermediate motion must show where the content is going. Preserve velocity through retargets; avoid jumps at reversals. Don’t add whole-page slides or animated backgrounds.
10. **Frame discipline:** one requestAnimationFrame scheduler runs only while springs are active. Animate transform/opacity; apply will-change only while needed. Cancel/settle work when hidden. Motion blur/stretch is reserved for a genuinely fast physical object, not normal navigation.

## Materials and depth

`.material` is a floating bone-tinted layer with 24px blur, restrained saturation, a light top edge and a contextual shadow. Place it over scrolling content with safe-area spacing. Active segments use a solid fill; don't stack translucent pale layers. Text is higher-contrast and slightly heavier on floating chrome. Reserve a scrim for an actual modal task; a parallel panel should not dim the whole app. Use a soft scroll-edge fade only where content passes under floating chrome.

Persistent toolbars do not need entrance theatrics. A future transient material can materialize with subtle scale/opacity (and, if justified by measured performance, blur); reduced-motion users get a static/opacity equivalent. The current starter intentionally has no modal, audio or haptic effects. If adding those for a meaningful action, synchronize feedback with the causal event, make sound opt-in and avoid unsupported promises about iPhone vibration.

## Accessibility and agency

- Respect three independent media signals: reduced motion (static settling, no elastic overshoot), reduced transparency (solid surfaces, no backdrop blur), and increased contrast (stronger text and defined boundaries). Also handle forced colours.
- Reduced motion never removes state feedback. Use colour, ARIA state and polite text announcements.
- Controls work with keyboard and touch. Keep visible focus, labelled inputs, status messages and a direct All apps route. Do not leave focus inside a hidden view.
- Keep native click semantics, modifier keys and link destinations. A drag away cancels press feedback; a return can restore it. Avoid double-tap recognizers unless the product actually needs double tap.
- Show common actions first; place details beside their subject. Confirm genuinely destructive irreversible actions, not routine toggles. Make reversible actions easy to undo/reset.
- Never claim testing beyond what was run. Automated interaction checks are not a substitute for physical-phone feel or real-user review.

## Lessons from the LA app

- Broad delegated selectors can swallow every click: `[data-view]` once matched the body. Scope to `a[data-view], button[data-view]` and test nested icon/text clicks.
- Keep a legible solid backing behind text over photos; preserve photo attribution and actual maps without colour filters that obscure labels/attribution.
- Embedded maps and external links are separate capabilities. The LA app keeps a Google embed and lets users choose Google or Apple for search/directions links. Build URLs from the same destination; preserve origin/destination parameters and save only an explicitly device-local preference.
- Handle blocked localStorage honestly, using try/catch and a visit-only fallback. State doesn't migrate automatically between the old Sites origin and GitHub Pages.
- On mobile, remove duplicated previews rather than flattening the typography or hiding the primary controls. Keep the journal's personality.
- Use relative assets and folder entrypoints. Publish code, image assets and manifest changes atomically. Keep images within their owning app and retain licence/source notes.

## Extending the collection

The collection renders apps.json with DOM APIs; invalid data or a failed fetch leaves usable static links and an honest status message. The manifest is navigation, not access control: unlisted folders remain public. Never put secrets in a static app. New product-specific behavior belongs inside the copied folder; shared primitives should stay generic. LA retains its local theme and gesture engine, with an explicit opt-in to shared native motion recipes.


## UI craft and motion decisions

Read the full [UI craft reference](docs/UI_CRAFT_REFERENCE.md) for the supplied philosophy, component examples and review checklist. Train taste by studying useful interfaces, understanding why their details work, and checking the result in motion. Small, predictable details and good defaults compound. Apply this craft on top of our bone-paper journal identity.

These application rules resolve overlapping advice in the reference and this document:

1. **Decide whether to animate first.** Keyboard and assistive-technology activations are immediate, including scrolling and selection indicators. High-frequency content changes (day navigation, list changes, form input) should not fade or stagger. Keep direct feedback through colour, focus, ARIA and status text. Occasional modal transitions can be restrained; rare decorative moments need a clear purpose.
2. **Name the purpose.** Motion must explain position, state, feedback or continuity. Do not add a tooltip, toast, drawer, hold-to-delete control, image reveal, duplicated tabs or a new dependency solely to demonstrate an effect. The reference's examples are optional patterns for relevant tasks.
3. **Choose the right mechanism.** Keep 1:1 functional dragging and our interruptible springs, release velocity, projection, capture handoff and soft boundaries. Decorative mouse tracking may spring toward a pointer; a functional drag must stay under it. Use explicit-property CSS transitions for simple retargetable state changes; use WAAPI when programmatic control is useful. Avoid restarting keyframes on rapidly repeated actions. `@starting-style` is progressive enhancement, with an instant usable fallback.
4. **Tune to frequency and intent.** Simple transitions normally take 125–250ms and stay under 300ms; press feedback is roughly 100–160ms. Use `--ease-out: cubic-bezier(.23,1,.32,1)` for entrances/exits, `--ease-in-out: cubic-bezier(.77,0,.175,1)` for deliberate on-screen morphs, and `--ease-drawer: cubic-bezier(.32,.72,0,1)` where a drawer warrants it. Avoid slow-start `ease-in`. Springs have response rather than fixed duration, so retain their existing physical tuning. A deliberate hold can take longer; do not apply the reference's 2s hold example to normal navigation.
5. **Preserve spatial continuity.** Popovers originate at their trigger; viewport modals stay centered. Enter and exit along the same path, starting at a subtle scale of .95–.98 and opacity rather than scale zero. Exit may be faster (the LA editor uses 180ms in / 120ms out). Do not lock input or delay saving/focus restoration until an animation finishes.
6. **Keep touch honest.** Gate hover styling behind `(hover: hover) and (pointer: fine)`. Give immediate press feedback, commit on release, and retain cancellation, direction thresholds, multitouch protection, vertical scrolling and pinch zoom. Keep the native Maps rail scrollable and its editable card wrappers non-shrinking. Ignore a child's bubbling capture-loss event when capture is moving to the day rail; genuine rail capture loss must still cancel.
7. **Spend rendering work deliberately.** Prefer transform/opacity and update only the moving element. Avoid per-frame inherited CSS custom properties. Use `will-change` only during movement, and stop work when hidden. Blur, clip-path, layout animation and 3D effects are optional measured exceptions; they are not guaranteed to be compositor-accelerated. CSS, WAAPI, JavaScript and library shorthands do not by themselves guarantee GPU/off-thread animation. Test the actual property, browser and workload rather than copying an acceleration claim from an example.
8. **Respect access preferences.** Reduced motion removes positional motion and overshoot while preserving instant feedback. Keyboard actions remain instant even when reduced motion is off. Retain reduced-transparency, contrast, forced-colours, focus management, large text and native form semantics. Stagger never blocks input and is omitted for routine planner tasks. Do not replace reversible deletion plus Undo with an inaccessible hold-only gesture.
9. **Review the whole interaction.** Test fast repetition, reversal, keyboard-to-pointer switching, touch cancellation, background/resume, narrow layouts and enlarged text. Inspect representative transitions mid-flight and with slower playback when useful. Physical-device checks and later fresh-eye review are valuable; report them as outstanding if they have not happened.

### Required UI review format

Every UI code review and UI-change PR description must include one actual Markdown table with **Before**, **After** and **Why** columns, one row per finding. Do not use separate Before/After bullet lists. Include specific validation and distinguish implemented changes from optional patterns that do not apply.

| Before | After | Why |
| --- | --- | --- |
| Keyboard action animates selection or scroll | State, focus and position update immediately | Repeated keyboard input must not wait for visual settling |
| Frequent day changes fade the timeline | New content is fully visible immediately | Reduce repeated visual noise |
| Hover styles also respond to touch | Fine-pointer, hover-capable media query | Avoid sticky touch hover |
| Popover and modal share a trigger origin | Trigger origin for popovers; center for viewport modals | Match the surface's spatial relationship |
| Dynamic UI uses broad or restarting effects | Explicit properties and retargetable motion | Keep interruptions predictable |

### Current implementation scope

LA Trip and Engineering Journal explicitly use `shared/motion.css` for short native dialogs and occasional disclosures. LA adds a decorative packing fill alongside native progress and retains its gesture engine. The Journal adds a view underline and bookmark fill while updating list content instantly and retaining unchanged article DOM. Both keep keyboard/AT and reduced-motion feedback immediate, gate hover rules and stop decorative transitions while hidden. Native disclosure height is a bounded 200ms layout exception, with an instant unsupported-browser fallback. The collection and shared starter retain their existing implementation; new work must apply this policy and verify any shared primitive changes across consumers. Documentation is not a claim that every existing app has been migrated.
