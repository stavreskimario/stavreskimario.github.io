# Animation guide

Use motion to explain a change, confirm an action or preserve a spatial relationship. Keep the collection's bone paper, editorial typography and calm reading experience. Start with [DESIGN.md](../DESIGN.md); use the [implementation recipes](ANIMATION_RECIPES.md) for code and review checks.

## Decide before building

1. Name the action and what movement helps someone understand. If colour, focus or a label already explains it, an animation may add nothing.
2. Consider frequency. Search results, article lists, day content and typing update immediately. A short selection indicator or bookmark fill can give pointer feedback without animating the content itself. Occasional disclosures and dialogs can explain opening and closing.
3. Choose the mechanism. Use a CSS transition for a retargetable state change. Keep the existing springs for dragging and momentum. Use WAAPI only when an interaction needs explicit timeline control; no animation package is required for these apps.
4. Define interruption and the static state first. Saving, ARIA state, focus and navigation must never wait for a visual transition. Reversing an action starts from its current presentation. Reduced motion and keyboard/AT activation reach the final state immediately.
5. Check the result at full speed and during interruption. A screenshot cannot establish whether an animation feels responsive.

Do not add effects to meet an animation quota. No daily-reader list staggers, entrance animations on every visit, decorative scroll reveals, animated backgrounds or new controls solely to demonstrate motion.

## Timing and easing

`shared/motion.css` is an optional stylesheet, currently used by LA Trip and Engineering Journal. Import it before app-local CSS. It does not install JavaScript or animate an app automatically; native recipes require explicit data attributes and input tracking.

| Token | Value | Use |
| --- | --- | --- |
| `--motion-feedback` | `160ms` | Journal view underline / bookmark fill, LA packing meter |
| `--motion-disclosure` | `200ms` | Occasional native details expansion and collapse |
| `--motion-dialog-in` | `180ms` | Native dialog and backdrop entry |
| `--motion-dialog-out` | `120ms` | Native dialog and backdrop exit |
| `--ease-out` | `cubic-bezier(.23,1,.32,1)` | Prompt response that settles into place |
| `--ease-in-out` | `cubic-bezier(.77,0,.175,1)` | Available for a justified on-screen morph; unused by these additions |
| `--ease-drawer` | `cubic-bezier(.32,.72,0,1)` | Available for a future justified drawer; neither app adds one |

Simple transitions should normally remain below 300ms. Avoid slow-start easing for direct feedback. Do not confuse duration with spring response: preserve the LA/shared spring response of `.34`, press response `.19` and rail response `.38`, with damping `1` and `.8` only for momentum releases. Gesture updates follow the finger 1:1 and hand off release velocity; fixed CSS durations would break that behavior.

## Input, access and interruption

- Start in `data-input="keyboard"` on the document element. A real pointer-down enables pointer motion. A non-modifier key or zero-detail click (including programmatic/AT activation) returns to immediate behavior. This describes the current input, not a device category: a laptop may use both touch and keyboard.
- Animate only when pointer input and `prefers-reduced-motion: no-preference` permit it. Changing either during a transition must settle the visual without hiding state feedback.
- Preserve native buttons, summaries, dialogs and form validation. Dialog open/close, focus restoration and saved data commit immediately. A visually exiting dialog and backdrop cannot intercept another click.
- Keep repeatable controls enabled. Stable DOM nodes let transitions retarget rather than restarting. Do not debounce clicks, add transition locks or wait for `transitionend` before completing an action.
- Scope hover effects to `(hover: hover) and (pointer: fine)`. Press cancellation and normal page scrolling still work on touch.
- Stop decorative transitions when the page becomes hidden; resume with the current state, without replaying an entrance. Existing gesture engines retain their own visibility cleanup.
- Retain visible focus, polite status text, forced-colour feedback, reduced-transparency support and usable controls at 200% text size. Motion is never the only indication of selection or progress.

## Rendering choices

Prefer explicit `transform` and `opacity` transitions on the moving element. Never use `transition: all`. Avoid per-frame updates to inherited custom properties and permanent `will-change`. CSS, WAAPI and libraries do not guarantee compositor acceleration; profile the actual browser and workload if an effect is costly.

Native disclosure height is a deliberate, bounded layout exception: expanding a booking or filter panel should move the following content with it. `interpolate-size` and `::details-content` progressively enhance that interaction for 200ms. Browsers without support use ordinary instant details. Do not reuse this recipe for article result lists or large nested animated layouts.

Viewport dialogs use a centered `.97 → 1` scale and opacity, with the reverse path on exit. A future anchored popover should originate at its trigger. Do not scale a whole panel from zero or translate a centered modal from an unrelated edge.

## Applied in these apps

| Before | After | Why |
| --- | --- | --- |
| LA packing progress jumped between values | A 160ms decorative fill settles to the new count; native progress and saved checks update immediately | Connect the check action to overall progress |
| Enlarged packing headings/counts could exceed a narrow screen | The summary and checklist wrap, and the fill fits its container | Keep progress readable at 200% text, including fallback fonts |
| LA bookings and backup details opened abruptly | Pointer disclosures expand/collapse over 200ms where supported | Preserve the relationship between a summary and its details |
| LA editor owned a local dialog recipe | Its existing 180/120ms centered behavior uses the optional shared recipe | Keep one documented, reviewable recipe across both apps |
| Journal view selection changed its border instantly | A 160ms underline moves between Latest, Saved and Sources; view content still changes immediately | Show the relationship between adjacent views |
| Journal recreated every article card on save/read | Cards with unchanged article data retain their DOM; a bookmark fills over 160ms | Preserve focus and allow feedback to reverse smoothly |
| Journal import and backup/filter disclosures appeared abruptly | Native dialog and details use the same brief recipes | Make occasional changes easier to follow |

LA day navigation, map behavior, all trip records and the Journal's collection schedule stay governed by their existing logic. The collection and Hello World do not import the optional stylesheet. Their existing behavior is not a claim of full migration to these rules.

## References and attribution

Adapted from Emil Kowalski's MIT-licensed [skills repository](https://github.com/emilkowalski/skills/tree/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills), reviewed at commit `d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128` (23 September 2026):

| Reference | Applied here |
| --- | --- |
| [animate](https://github.com/emilkowalski/skills/blob/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills/animate/SKILL.md) and [recipes](https://github.com/emilkowalski/skills/blob/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills/animate/RECIPES.md) | Purpose/frequency gate, easing, origins and short transitions |
| [find-animation-opportunities](https://github.com/emilkowalski/skills/blob/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills/find-animation-opportunities/SKILL.md) | Audit real interactions before adding motion |
| [improve-animations](https://github.com/emilkowalski/skills/blob/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills/improve-animations/SKILL.md) | Continuity, interruption and proportionate movement |
| [review-animations](https://github.com/emilkowalski/skills/blob/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills/review-animations/SKILL.md) and [standards](https://github.com/emilkowalski/skills/blob/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills/review-animations/STANDARDS.md) | Input, accessibility and performance review |
| [animation-vocabulary](https://github.com/emilkowalski/skills/blob/d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128/skills/animation-vocabulary/SKILL.md) | Shared language for timing, easing and spatial continuity |

These are references, not installed agent skills or dependencies. Repository rules resolve differences between upstream examples: short everyday transitions, instant frequent content, retained gesture physics and no assumption of GPU acceleration. Attribution and the full upstream MIT notice are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Native CSS references: [MDN: interpolate-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size), [Chrome: animate to intrinsic size](https://developer.chrome.com/docs/css-ui/animate-to-height-auto), and [Chrome: styling details](https://developer.chrome.com/blog/styling-details). Feature support is a progressive enhancement, not a browser prerequisite for using either app.
