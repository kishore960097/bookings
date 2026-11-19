# QGo Intro / Splash Animation — Codex Master Prompt

> **How to use:** Open the actual QGo project repository in Codex. Put the supplied assets somewhere inside that workspace (recommended temporary location: `reference-assets/`) and paste this entire prompt. The assets are a visual/source reference; the implementation must integrate with the existing app rather than replace the app or use the reference video as a full-screen shortcut.

## ROLE AND OBJECTIVE

Act as a senior front-end, mobile, animation, accessibility, and test engineer. Implement a production-quality QGo branded intro/splash animation in the **existing project in this workspace**. Do not merely provide a plan or sample code: inspect the real codebase, implement the feature in the correct locations, test it, and report exactly what you completed.

The splash appears when the app opens, before the login/landing screen is interactable, and doubles as the startup loading screen. It should feel premium and close to the supplied reference video, remain smooth on mid-range phones, support phone/tablet/desktop layouts, and respect reduced-motion preferences. Preserve all existing app features and styling outside the intro.

## SOURCE ASSETS — INSPECT THESE FIRST

The user supplied:

1. **`qgo-intro-3x4-1536x2048.mp4`** — the reference animation. Verified properties: H.264 MP4, 1536 × 2048, 30 fps, 4.5 seconds, 3:4 aspect ratio. Its visual sequence is an oversized cream QGo wordmark on red; a fuzzy storefront replaces Q; a black scene features a ticket labelled `01` in the G position; a red reveal introduces a clock at the o position; the animation resolves to a black QGo wordmark on white with the tagline **“Queue less. Go more.”**
2. **`qgo-logo.svg`** — vector wordmark with a `734 × 278` viewBox and three independently addressable paths: `qgo-q`, `qgo-g`, and `qgo-o`. Its paths use `currentColor`.
3. **`qgo logo prompt claude.zip`** — includes a prior prompt and a copy of the SVG. Use it only as supplemental background; this Codex master prompt takes precedence where wording or assumptions differ.

Search the workspace for these files, including the root and `reference-assets/`. If the user has extracted the assets to a different path, locate them before deciding they are missing. Copy the supplied SVG into the project's proper brand-assets directory without breaking its path IDs or viewBox. Keep the original reference video out of the production runtime bundle unless the real app has a compelling, verified need to ship it; normally it is a design reference only. Do not simply play the MP4 as the splash—the app needs a responsive, accessible, deterministic implementation. Do not replace the vector logo with a hand-redrawn approximation.

## NON-NEGOTIABLE WORKING RULES

1. **Recon before edits.** Read all applicable `AGENTS.md` files and project instructions. Inspect the working tree, package manifests/lockfiles, framework/version, app entry points, routing, auth/session bootstrap, current loading UI, theme tokens, existing animation/image libraries, test tools, and any web/mobile app folders. Report the findings briefly in the work log, then continue implementing unless a genuine blocker prevents safe progress.
2. **Do not guess the stack.** Prior documentation mentions React/Vite/Tailwind and possibly Expo/React Native, but these assumptions may be stale. Confirm the real repository and versions. Follow its architecture and coding conventions. Implement in each platform that actually exists in this repository; do not create an imaginary mobile app or force a framework migration.
3. **Protect existing work.** Never reset, clean, stash, overwrite, or revert user changes. Do not modify unrelated features, database files, audit remediation, auth logic, or loaders unnecessarily. If Git is available, inspect `git status` first. Create/use a feature branch only when this is safe and will not disturb uncommitted changes; otherwise remain on the current branch and report it. Do not commit unless the repository instructions or user explicitly require commits.
4. **Reuse before adding dependencies.** Prefer animation, SVG, image, storage, and testing tools that already exist. Add no runtime dependency unless the implementation truly requires it; explain any addition. Do not use CDNs, remote fonts, or third-party brand assets.
5. **Real readiness only.** Wire the splash to the app's actual startup readiness (for example session restoration, critical config/data, and required local fonts, but only the work the app really waits for). Do not simulate readiness using an arbitrary delay. Never trap the user indefinitely on the splash.
6. **Deterministic animation.** Use a shared timeline/config and a pure frame calculation wherever the stack allows. No random motion or uncontrolled physics. Animate only transform/opacity/clip-path (or native equivalents) during the timeline; avoid per-frame layout churn.
7. **Graceful fallback.** A missing/failed optional illustration asset must not crash the app or block startup. Prefer a local image when available, with vector/code-drawn fallback for each object.
8. **Verify, don't claim.** Run the project's real type-check, lint, tests, and production build where available. Clearly distinguish passing checks from commands that could not run. Do not claim a command passed unless it was actually run.

## PHASE 0 — READ-ONLY RECONNAISSANCE

Before editing, determine and record:

- Framework, framework version, package manager, and applicable repository instructions.
- Actual web/native app entry point(s) and root/layout component(s).
- Router/navigation flow and the screen shown after startup.
- Where auth/session/config bootstrap happens and how a real `ready` boolean can be obtained.
- Existing app-wide loader/splash, whether it has reusable readiness logic, and how it is mounted.
- Existing brand/theme tokens, fonts, icon/SVG support, motion library, storage solution, and safe-area handling.
- Existing test/type-check/lint/build commands and conventions.
- Correct location for shared timeline code and brand assets.

Do not delete an existing image-cycling or in-app loading component. This intro handles cold start/app-open presentation; keep existing in-app loading behaviour unless the real codebase shows a better compatible integration.

## DESIGN AND VISUAL DIRECTION

Follow the uploaded reference animation's **motion rhythm and object placements**, not its exact pixels or any unrelated template branding. Keep the QGo logo recognizable at every point where it appears.

Use one source of truth for these brand tokens unless the repo already defines equivalent authoritative tokens:

- `red`: `#E8342A` — primary splash background
- `redDeep`: `#A81818` — shading/awning stripes
- `black`: `#0B0B0B` — dark scene and final wordmark
- `white`: `#FFFFFF` — final background
- `cream`: `#FFE9D6` — logo/objects on red or black scenes
- `ink`: `#333333` — tagline

The supplied logo has three SVG paths (`qgo-q`, `qgo-g`, `qgo-o`) within `viewBox="0 0 734 278"`. Preserve the geometry. Use a reusable `QGoLogo`-equivalent component if consistent with the repo, allowing the three letter shapes to animate independently and inherit `currentColor` or explicit per-scene colour. Avoid rasterizing the wordmark.

### Scene objects

The animation is generic to QGo's booking/queue product, not a specific business type:

1. **Fuzzy storefront** replaces Q.
2. **Queue ticket with large `01`** replaces G.
3. **Clock face** replaces o; draw the clock hands in code so they can rotate independently.

If dedicated sprite files are not present, create the illustrations using inline SVG/native vector shapes and subtle gradients/highlights. If the web renderer supports a tasteful texture filter, use it lightly and test performance. Do not assume the sprites exist merely because they were described in the old prompt. Illustrations should stay crisp, use accessible fallbacks, and remain small in the bundle.

Art direction: premium, rounded, soft/fuzzy felt-toy appearance, diffused top-left lighting, matte texture, and restrained shading. Storefront has a cream body and scalloped red/white awning, with a small door/window and no extra text. Ticket is red with rounded/notched sides, perforation dots, and cream `01`. Clock has a cream bezel, off-white face, and 12 simple tick marks; hands are separate animated vector elements.

## SHARED TIMELINE — FULL VARIANT

Target about **4000 ms of visual animation**, followed by a **400 ms exit**. The uploaded reference file itself is 4.5 seconds long, 3:4; do not describe it as a 9:16/3.8-second source. The app animation should be responsive rather than bound to the video's 3:4 canvas. Keep every scene boundary configurable.

| Time | Scene | Required motion |
|---|---|---|
| 0–600 ms | S0 — red | Large cream QGo logo enters; begins around 2.6× and settles near 1.7×, with a small horizontal drift. Let the logo crop beyond viewport edges to match the reference energy. |
| 600–1200 ms | S1 — red | Q scales/rotates away. Storefront enters from the left and lands at the Q pivot with a controlled overshoot/squash-stretch. The wordmark scales toward about 1.25×. |
| 1200–1900 ms | S2 — black | Reveal black from around the G pivot using a circular wipe. Storefront exits; Q returns. G exits and the ticket drops in from above with a restrained wobble. |
| 1900–2600 ms | S3 — red | Reveal red from around the o pivot using a circular wipe. Ticket exits; G returns. o exits; clock rolls in from the right. Minute hand completes a controlled 360° sweep over about 500 ms; hour hand settles at about 30°. |
| 2600–3300 ms | S4 — red to white | Clock exits and o returns. A radial white reveal expands from screen centre. Change logo colour from cream to black through the same reveal using layered scenes; avoid a muddy cross-fade. Wordmark settles to its responsive final size. |
| 3300–4000 ms | S5 — white | Hold a clean black QGo logo on white. Nudge the Q tail and G arrow +8 units horizontally, then spring back with about 80 ms stagger. Fade in the tagline at about 3500 ms, moving upward roughly 8 px over 300 ms. |
| 4000–4400 ms | EXIT | Splash fades out and scales from 1.0 to about 1.02, revealing the already-mounted app underneath. |

Use named deterministic easing constants, equivalent to these CSS timing functions:

- `enter`: `cubic-bezier(0.22, 1, 0.36, 1)`
- `wipe`: `cubic-bezier(0.76, 0, 0.24, 1)`
- `backOut`: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- `inOut`: `cubic-bezier(0.65, 0, 0.35, 1)`

The default tagline is **“Queue less. Go more.”**, using the existing UI font, weight 500, letter spacing around `0.02em`, ink `#333333`, and a responsive size equivalent to `clamp(14px, calc(1.6vw + 8px), 22px)`. Keep alternates `“Skip the wait. Just Go.”` and `“Book it. Queue it. Go.”` in a config list, with a stable configurable index.

### Scene-reveal implementation

For each background flip, render old/new scene layers with the appropriate background and wordmark colour. Reveal the new layer using `clip-path: circle(...)` on web or an equivalent masked/animated layer supported by the real native stack. The logo colour must switch exactly at the reveal edge. Provide a supported fallback if `clip-path` or an equivalent feature is unavailable on a platform; do not let the background flash white unintentionally.

## VARIANTS AND STARTUP BEHAVIOUR

### Full

- For a first-time user or a user whose last full/short intro is older than 14 days, play the full timeline.
- Full animation should complete at least its 4000 ms brand sequence. If the app is ready earlier, still finish the full brand sequence before exiting.
- If the sequence finishes while the real app readiness is still false, hold S5. During the hold, loop a subtle arrow nudge from 0 to +8 to 0 over roughly 1400 ms. After 2500 ms of holding, show small polite text **“Getting things ready…”**.
- Hard timeout: after 8000 ms from splash mount, release the splash even if readiness never becomes true. Let the app show its own error/offline state. Never trap the user.

### Short — returning user

- Approximately 1200 ms minimum: white background, black logo fades/scales from about 0.92× to 1× in about 350 ms, then the arrow nudge around 450 ms; no tagline.
- Exit once `ready` is true and at least 1100 ms has elapsed; use about 300 ms fade.

### Reduced motion

- Detect `prefers-reduced-motion: reduce` on web and the platform's accessibility reduce-motion setting on native, when those platforms exist.
- Render the final black wordmark on white and the tagline, with only a roughly 300 ms opacity fade.
- Exit when `ready` is true and at least 600 ms has elapsed. Avoid large zooms, spins, wipes, and looping movement.

### Variant gating

Use safe, guarded access to storage and graceful fallbacks:

- Web: `localStorage` key `qgo.intro.v1`, storing `{ lastSeen: ISO date, count }`; session flag `qgo.intro.session` in `sessionStorage`.
- Native only if this app exists: equivalent persistent/session logic using the storage already used by the app (AsyncStorage only if already present, otherwise follow repo convention).
- Never seen, or last seen more than 14 days ago: FULL.
- Seen within 14 days and a new session: SHORT.
- Already displayed in the same session (for example SPA navigation): do not replay.
- Reduced-motion preference: REDUCED, always.
- Dev-only web override: `?intro=full|short|reduced|off`; if useful, equivalent native dev constant.
- Catch storage failures. When storage is unavailable, use FULL once in the current in-memory session and continue normally.
- Update the seen record at a sensible, tested point in the lifecycle; avoid marking an intro as seen when `off` was forced.

### Skip interaction

- Ignore taps/keyboard skip before 800 ms to avoid accidental dismissal.
- After that, pointer/tap, Enter, Space, or Escape skips the current motion. If the app is not ready, jump to/hold the S5 frame; if ready, fade out normally (about 400 ms full, 300 ms short).
- No visible Skip button unless the existing accessibility/system design specifically requires one. Make keyboard behaviour discoverable to assistive technology without adding visual clutter. Clean up all event listeners on unmount.

### Mounting, startup flash, and page visibility

- Mount the real app/router underneath the splash early so it loads in parallel, but keep the underlying content inert and hidden from assistive technology until the splash exits. Use the framework's supported `inert`/accessibility technique; do not break focus management or hide an active login form incorrectly after exit.
- Splash overlay covers the complete viewport and has the appropriate highest app z-index. Do not cause page scroll while visible.
- Prevent a white flash on cold start where practical and consistent with the existing app: for web, a very small safe pre-React bootstrap in the real HTML entry may set an initial background based on reduced-motion/storage; for Expo/native, use existing supported native splash configuration if applicable. Do not introduce a competing startup mechanism or destabilize the current login/startup flow.
- Sync browser `theme-color` to the active scene and restore the previous value on exit if the project uses it. On native, coordinate StatusBar style with the scene only if a native app exists. Always clean up document/head/native state.
- Offline, blocked storage, missing sprites, failed prefetch, window resize, orientation change, or slow boot must not crash or restart the timeline.

## RESPONSIVE RULES

Use the project's existing responsive system if it provides equivalent behaviour. Otherwise approximate:

| Viewport | Final logo width |
|---|---|
| Phone (shortest side < 600 px) | `clamp(220px, 72vw, 420px)` |
| Tablet (shortest side 600–1023 px) | `clamp(340px, 46vw, 520px)` |
| Desktop (width ≥ 1024 px) | `clamp(380px, 30vw, 560px)` |

In every case cap the logo width to about `0.74 × viewport height` so landscape devices fit. Centre horizontally and position optically around 48% of viewport height; tagline below. Use the platform's correct dynamic viewport and safe-area support (web: `100dvh`/`100svh`, `viewport-fit=cover`, `env(safe-area-inset-*)`; native: safe-area APIs already installed). Background fills the whole viewport. No scrollbars. Resizing or rotating mid-animation recomputes layout without restarting elapsed timeline time. On ultra-wide screens the wordmark must not stretch; only the background fills the canvas.

Check visual layout at minimum: `360×800`, `390×844`, `768×1024`, `1024×768`, `1280×800`, `1920×1080`, and `2560×1080` where browser tooling permits.

## IMPLEMENTATION ARCHITECTURE

Adapt file paths and names to the actual repository; these are logical responsibilities, not permission to create a parallel app.

1. **One timeline config** `introTimeline`: palette, easings, scene boundaries, transforms/pivots, taglines, duration values, and optional flags. If web/native packages cannot share a module, mirror the config minimally and add a parity test.
2. **Pure frame function** such as `computeIntroFrame(t, variant)`: returns layer backgrounds/reveal origin/radius; global logo scale/translation; each letter's visibility/scale/rotation; object visibility/position/scale/rotation/squash; clock angles; tagline opacity/translation; arrow nudge; and exit progress. Every input time must give finite, deterministic output. Clamp time where appropriate.
3. **Web renderer, if applicable:** use `requestAnimationFrame` and refs/direct style updates or the repository's established animation framework to avoid React re-rendering on every frame. Support a dev-only frozen time parameter such as `?t=1234`, pause/play and playback rate.
4. **Native renderer, if applicable:** use the already installed animation library (for example Reanimated if the project actually has it). Preserve the same timing/easing configuration and test visual parity. Do not add a native renderer if no native app exists.
5. **Component API:** make an equivalent of `QGoIntro({ ready, variant = 'auto', onDone })`, with `variant` values `auto | full | short | reduced`. Add an app-root gate/wrapper only if that matches the real framework and routing architecture. Avoid duplicating boot/readiness state.
6. **Assets and bundle:** store the logo and optional object sprites in the appropriate brand/assets folder. Do not import the 4.5-second reference video into runtime code. Keep new production assets lean; aim for less than about 150 KB gzipped for newly introduced intro assets/code where practical, excluding the reference video that must not ship.
7. **Cleanup:** remove listeners, animation frames, timers, media-query handlers, and restore any modified theme/status-bar state when the splash is dismissed/unmounted.

## DEV PREVIEW AND OPTIONAL EXPORT

If the real web project has a dev-only routing/preview convention, add a preview page hidden from production builds. It should support: Replay, Pause/Play, timeline scrub from 0–4000 ms, speed choices 0.25×/0.5×/1×, Full/Short/Reduced variants, a ready toggle to test hold/timeout, common device frames (375×812, 768×1024, 1280×800, 1920×1080) and fit-to-window, plus a sprite-vs-fallback toggle if sprites exist. If the project has no suitable dev preview route or test browser tooling, choose the smallest consistent alternative and document it; do not introduce a new router only for the preview.

Optional MP4 export may be added only if compatible dev tooling is present or can be added safely as dev-only dependencies. It must not be a production dependency. Render deterministically frame-by-frame at 30 fps (optional 60 fps), use a standard H.264 format with `yuv420p` and fast-start metadata, and write to an ignored output directory. If Playwright/ffmpeg is unavailable, skip gracefully with a clear explanation rather than making the app build depend on it.

## ACCESSIBILITY AND PERFORMANCE

- Splash wrapper announces a useful loading status (`role="status"`/equivalent and a concise accessible label).
- Respect reduced motion and keyboard skip. Preserve sensible focus behaviour before and after dismissal.
- Verify readable contrast for tagline and loading text; avoid relying on colour alone for loading state.
- Aim for smooth 60 fps on a mid-range phone. Keep animation limited to composite-friendly properties. Add `will-change` only during playback and remove it afterwards. Avoid giant continuously animated filters or per-frame SVG filter recalculation.
- No sound. Haptics, if supported by the existing native app, remain off by default and must not require a new dependency.
- Test no-ready, slow-ready, offline/error, blocked storage, failed image, repeated navigation, reduced-motion, and manual skip states.

## TESTS AND ACCEPTANCE CRITERIA

Use the project's existing test framework (Vitest only if actually installed). Add tests appropriate to its conventions:

1. Timeline scene ranges are ordered/contiguous and the full visual duration is 4000 ms.
2. `computeIntroFrame(0)` and `computeIntroFrame(4000)` have expected start/final states.
3. Every scene edge and nearby sample produces finite numbers; no NaN/Infinity and no unexpected severe jumps.
4. Gating: first launch, last seen within 14 days, older than 14 days, same session, reduced motion, storage exception/unavailable, and dev overrides.
5. Readiness/timeout: ready early, ready late, never ready (8-second timeout), skip before/after 800 ms, and correct minimum duration per variant.
6. Config parity if platform configs must be duplicated.
7. If browser screenshot tooling is available, capture key frames at 300, 900, 1600, 2300, 3000, and 3700 ms at 390×844, 768×1024, and 1280×800. Inspect the outputs rather than treating screenshot generation alone as success.
8. Validate object sprite failure/fallback if sprites are used.

Acceptance checklist:

- [ ] Cold start presents the intended first scene without an avoidable white flash.
- [ ] Full sequence follows red → black → red → white and ends on the black vector wordmark on white with “Queue less. Go more.”
- [ ] Storefront replaces Q, ticket `01` replaces G, and clock replaces o; letters return correctly before the final logo.
- [ ] Circular scene reveals synchronise the background and logo colour boundary.
- [ ] Resize/orientation changes do not restart the timeline and required viewports remain well composed.
- [ ] Exit depends on real readiness, with hold state and hard timeout.
- [ ] First/returning/reduced-motion/same-session gating works; storage failures are safe.
- [ ] Skip works as specified and never traps the user.
- [ ] Missing images fall back cleanly and no runtime requests depend on external hosts.
- [ ] Preview/export tools are dev-only and production app build is unaffected.
- [ ] Existing functionality remains intact; no unrelated changes.
- [ ] Type-check, lint, relevant tests and production build pass, or any unavailable/failing check is accurately reported.

## FINAL REPORT — REQUIRED

When finished, report:

1. Actual repo/framework/platforms you found and the relevant app entry point(s).
2. Branch name/current branch and whether the working tree had pre-existing changes; do not claim a branch or commit that was not created.
3. Files added/changed and why.
4. How the intro obtains the real `ready` signal and how the login/landing page is kept beneath it.
5. Commands run and exact results for tests, lint, type-check, and build.
6. How to open the dev preview and export video, if implemented.
7. Any dependencies added and why; bundle-size or performance findings if measured.
8. Any known limitations, decisions made because of ambiguity, and user input/assets still needed.

**Start now with Phase 0 reconnaissance, then implement the feature using the real project structure. Do not stop after writing a plan. Do not modify unrelated code.**
