# App components can be verified in a real browser with esbuild + playwright-core

**Date**: 2026-10-10
**Type**: reference
**Theme**: app-infrastructure
**Summary**: esbuild-bundle real components via react-native-web + Tamagui; drive headless Chrome for layout checks.
**Context**: .minerva/work/2026-10-10-chat-input-web-autogrow (see git history if the worktree has been cleaned up)

## Context
`packages/app` has no test runner, and jsdom has no layout. Layout bugs therefore can't be reproduced in unit tests: scroll heights, frame-by-frame resizing, and wrapping.

## Finding
`.minerva/work/2026-10-10-chat-input-web-autogrow/verify-chat-input-autogrow.mjs` renders the real `ChatInput` in headless Chrome. It needs Google Chrome plus playwright-core installed with `npm i --no-save playwright-core@1.57.0`, with no browser download, using `channel: "chrome"`. It can serve as a template.
- It bundles a tiny entry with the esbuild JS API (already in root `node_modules`). The entry wraps the component in `TamaguiProvider` with the app's `tamagui.config.ts`. The bundle uses these settings:
  - `alias: { "react-native": "react-native-web", "@": packages/app }`;
  - `.web.*`-first `resolveExtensions`;
  - `nodePaths: [<repo>/node_modules]`, which lets an entry outside the repo resolve packages;
  - `define` for `__DEV__`, `process.env.NODE_ENV`, `process.env.TAMAGUI_TARGET="web"` and `global=window`;
  - a `window.process` shim in the HTML, because Tamagui reads `process.env` at runtime.
- In the page, a `requestAnimationFrame` loop samples layout on every painted frame, and playwright drives typing, Enter-to-send and width changes.
- A `--component <file>` flag runs the same assertions against another version of the file, for example `git show origin/main:…` saved next to the original. That proves the harness fails on the old bug.

## Implications
- Use this approach for web layout and animation regressions instead of mocking DOM metrics.
- Run a mutation check: break the guarded line and confirm the assertion fails. One Chrome behaviour, `scrollTop` surviving a collapse, made an assertion pass vacuously here.
- A git worktree has no `node_modules`. Symlink the main checkout's temporarily, and never commit the link: a symlink is not matched by the `node_modules/` ignore pattern.

## Related
- [[2026-10-10-constraint-rn-web-textarea-autogrow-ratchet]] — the bug this harness reproduced and verified
- [[2026-10-06-reference-rn-web-textarea-keyboard]] — RN-web TextInput facts this builds on
