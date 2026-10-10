# Replans: expo-57-liquid-glass

## 2026-10-10 — Criteria 7 and 14: verify the web tab layout by route resolution; the signed-in render becomes a user check

### Original plan
Success criterion 7: "The web export contains the routes `dashboard`, `sponsor` and `journal`. Served locally, `/dashboard` renders the JS tab bar and a header."

Criterion 14's device checklist had ten items and no web item.

### What changed
- Completion verification (the Verifier) marked the second sentence of criterion 7 as unmet. Its stated options were an auth bypass or signed-out stub, or rewording by replan. This entry takes the **reword-by-replan** path. The signed-in render is **deferred to the user, not satisfied**.
- `/dashboard`, `/sponsor` and `/journal` sit inside `Stack.Protected guard={isSignedIn === true}`. The root layout renders `LoadingView` until Clerk loads. A signed-out static export or local serve therefore never mounts the tab navigator.
- No test credentials are available to this run, and creating a Clerk account is an outward-facing action outside the run's authority.
- **Rejected alternatives:**
  - An auth bypass in app code puts test-only code on production paths of an App Store app.
  - An isolated-render scratch script with a stubbed router does not reflect the real root guard and route tree, so it would prove less than the resolver check below.
- The risk criterion 7 targets is "web accidentally gets NativeTabs". It turns on which layout file expo-router selects per platform, and that can be checked mechanically.

### New plan
Criterion 7 becomes:

> 7. The web export contains the tab routes (`dashboard/`, `sponsor/` and `journal/` route directories under the export root). expo-router's own route resolver selects `./(auth)/(drawer)/(tabs)/_layout.web.tsx` for `web` and `./(auth)/(drawer)/(tabs)/_layout.tsx` for `ios` and `android`.
>
> - The resolver is run as `getRoutes` with `platformRoutes: true` over `packages/app/src/app`, by `node .minerva/work/2026-10-10-expo-57-liquid-glass/verify-web-tabs-layout.cjs packages/app`.
> - The script relies on expo-router 57's internal `getRoutesCore` and its require-context ponyfill, so a router upgrade may break it.
> - A mutation check shows the check discriminates: with `_layout.web.tsx` temporarily removed, `web` resolves `_layout.tsx`.
> - Coverage is split: this check, criterion 6's web export bundling, and tsc cover "web does not get NativeTabs" and compile-time errors. The render-time behaviour of `_layout.web.tsx` is checked by the user in criterion 14's new item 11.

Criterion 14 gains an eleventh checklist item, after the Android/iOS < 26 item:

> 11. Web, signed in — locally via `npm run web` with a real account, or on the deployed web build after merge-gating. Check that `/dashboard`, `/sponsor` and `/journal` show the bottom JS tab bar and headers with their buttons, and that the Sponsor menu button opens the drawer.

Evidence already gathered, all run by the implementing session on 2026-10-10:
- The export emits `dashboard/`, `sponsor/` and `journal/` route directories, plus `journal-new.html` and `journal-info.html`.
- The resolver printed `web → ./(auth)/(drawer)/(tabs)/_layout.web.tsx`, `ios → ./(auth)/(drawer)/(tabs)/_layout.tsx` and `android → ./(auth)/(drawer)/(tabs)/_layout.tsx`.
- The mutation run printed `web → ./(auth)/(drawer)/(tabs)/_layout.tsx`. The file was then restored, and `git status` was clean.

No other criterion, approach step or scope item changes.
