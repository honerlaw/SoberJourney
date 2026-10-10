# Proposal: expo-57-liquid-glass

**Date**: 2026-10-10
**Status**: Draft

**Seed (user):** "Can we update to the latest version of expo, and then convert everything to use the new iOS glass format that we need to do"

## Goal

Move the SoberJourney app (`packages/app`) from Expo SDK 54 (RN 0.81.5, React 19.1.0, expo-router 6) to the latest **stable** Expo SDK, **57** (RN 0.86.x, React 19.2.x, expo-router 57), and convert the app's navigation chrome to the system-native iOS 26 Liquid Glass design:
- a native `UITabBar` tab bar;
- native per-tab navigation headers whose bar buttons get the system glass treatment;
- glass on the app's one custom floating surface, the Sponsor chat composer (optional, non-blocking — see Part 2 step 8).

The hand-rolled `forceGlass` / `GlassView` header-button workaround and the `height: 120` header hack are removed.

**Accepted user-facing consequence:** SDK 56+ raises the minimum iOS version from 15.1 to 16.4, and SDK 57 sets its own Android minSdk. Devices on iOS 15.1–16.3 stop receiving app updates. The PR body states this explicitly, with the before and after minimums.

The change is **app-only**. There are no server changes, and the new binary talks to the current server API unchanged (the additive-only compatibility rule is untouched). The user's "and then" is read as an ordering of the work, not as a request for two releases.

## Why

- **Stated assumption, from Apple developer forum threads and 2026 coverage:** apps built with the iOS 27 SDK (Xcode 27) no longer honour the `UIDesignRequiresCompatibility` opt-out. Apple has not yet published a deadline that makes that SDK mandatory, but one normally follows a major iOS release, and from then on the app gets Liquid Glass whether or not it is designed for it.
- Today the tab bar is a JS (`@react-navigation/bottom-tabs`) bar that never becomes glass. The tab headers are JS headers whose buttons only look glass through a manual `GlassView` workaround (`HeaderButton forceGlass`).
- SDK 54 is three releases behind:
  - SDK 55 removed the legacy architecture and several app.json keys.
  - SDK 56 decoupled expo-router from React Navigation, made `expo/fetch` the global `fetch`, made Hermes v1 the default, and raised the minimums to iOS 16.4 and Xcode 26.4.
  - SDK 57 is a non-breaking RN 0.86 bump. Its `expo@57.0.17` release fixes SDK 56's Hermes v1 + reanimated memory regression.
- NativeTabs (`expo-router/unstable-native-tabs` in SDK 55–57) is Expo's supported way to get the real Liquid Glass tab bar.

## Approach

### Current state (facts)

- Root `package.json` has the workspaces `packages/server` and `packages/app`. Both the root and app `overrides` pin `react`/`react-dom` to `19.1.0`.
- `@sentry/react-native` is resolved through the lockfile but is not declared in `packages/app/package.json`, even though `AppLayout`/`_layout.tsx` import it. `expo-updates` is **not** used: there are no OTA updates, so old binaries can never receive a new JS bundle.
- `app.json` still contains `newArchEnabled: true` and `android.edgeToEdgeEnabled: true`, both config keys removed in SDK 55. It also has `experiments.reactCompiler: true` and `typedRoutes: true`.
- `babel.config.js` lists `@tamagui/babel-plugin` and `react-native-worklets/plugin` explicitly.
- Navigation:
  - The root native `Stack` (`src/app/_layout.tsx`) contains `(auth)/(drawer)/_layout.tsx`, a JS `Drawer`. It sits on the right, holds the Sponsor conversation list, has `swipeEnabled: false` and hides its header.
  - The drawer contains `(auth)/(drawer)/(tabs)/_layout.tsx`, a JS `Tabs` navigator with three tabs (`dashboard.tsx`, `sponsor/index.tsx`, `journal.tsx`). Labels are hidden and icons are lucide.
  - Tab headers use `HeaderButton … forceGlass` on the left and right, plus `headerStyle: {height:120}` when glass is available.
- `@react-navigation/*` imports in src:
  - `NavigationThemeProvider` imports `ThemeProvider`, `DarkTheme` and `DefaultTheme`.
  - `ConversationDrawerContent/*` imports `DrawerContentScrollView` and the type `DrawerContentComponentProps`.
  - `SponsorPage` imports `useBottomTabBarHeight`, used for the chat input keyboard lift `keyboardHeight - tabBarHeight + 14`.
- **Verified in the expo-router 57.0.25 tarball:**
  - `expo-router` exports `ThemeProvider`, `DarkTheme` and `DefaultTheme`.
  - `expo-router/drawer` exports `Drawer`, `DrawerContentScrollView` and the type `DrawerContentComponentProps` (its forked drawer is built on `react-native-drawer-layout`).
  - `expo-router/react-navigation` exports `DrawerActions`.
  - `expo-router/unstable-native-tabs` exists.
- `SponsorPage` sets a **dynamic header title** (the conversation title) through `useNavigation().setOptions({ headerTitle })`. A comment ties its default to the tab layout's static title.
- `HeaderButton` opens the drawer only if `useNavigation()` has its own `openDrawer` property (`hasOwnProperty` check). Otherwise it silently does nothing.
- `usePushNotifications.native.ts` routes notification taps. It targets `DASHBOARD = "/(auth)/(drawer)/(tabs)/dashboard"` and branches on `router.canGoBack()` to decide whether to `replace(DASHBOARD)` first. `src/app/index.tsx` also redirects to the dashboard.
- Pushed screens (journeys-new/modify/info, journal-new/info, checkin-new, profile, privacy, terms, support) are root native-stack screens. On iOS 26 their headers already render as native glass.
- Sponsor streaming already passes `fetch` from `expo/fetch` explicitly (`utils/streamingFetch`). It depends on Expo's Metro-injected Web Streams polyfill being a single implementation (knowledge `2026-10-07-constraint-hermes-streams-for-trpc-jsonl`).
- CI:
  - `.github/workflows/ci.yml` runs on PRs to `main` only. It runs `npm ci`, `npm run build`, `npm run test`, then `eas build --profile development --auto-submit --no-wait`, which produces a dev-client TestFlight build.
  - `eas.yml` runs on push to `main` and does a **production** build plus App Store submit.
  - `eas.json` pins no image, so EAS uses `auto`. For SDK 57 that is `macos-tahoe-26.5-xcode-26.6` (docs.expo.dev/build-reference/infrastructure), which satisfies SDK 57's Xcode requirement.
- The repo has `allow_auto_merge: false`, and the user merges PRs by hand.
- Local toolchain: Xcode 26.2 and Node 24.20. **No local iOS native build is possible.** CI never runs a simulator, so the only native verification is the PR's EAS dev build plus the user's device checklist.
- Web is built from the same codebase (`expo export -p web` produces the server's `static/`), so web must keep working.

### Scope and PR structure

- **One work unit, one PR to `main`, unphased.** The PR stays open as the device-test gate: it produces the dev TestFlight build, and the user holds the production submit simply by not merging. Part 1 (the upgrade) and Part 2 (the Liquid Glass conversion) land as **separate, individually building commits**, so the Part 2 commits can be reverted on their own if a device test fails.
- **Rejected alternatives:**
  - **Phase 1 merged to main first.** This adds a production App Store release of an untested intermediate app.
  - **Epic base branch with phase PRs.** PRs into an epic get no CI and no EAS dev build, so there is no device gate until the final merge anyway.
  - **Two separate units.** The work is one intent, and NativeTabs needs SDK 55 or later.
- **Contingency.** If Part 1 hits a blocker that can't be fixed in this PR (a third-party incompatibility, or the stream polyfill breaking), the unit replans. That replan may move the work to an epic base branch.
- **Size.** The hand-written diff is roughly 20–30 files: package and config files, codemod import rewrites, the tab folder restructure plus the web layout, HeaderButton, SponsorPage, ChatInput, the theme provider and the drawer content. Lockfile churn is not reviewed line by line.


### Part 1 — SDK upgrade (54 → 57), commit(s) 1

1. In `packages/app`, run `npx expo install expo@^57.0.0 --fix` (expo ≥ 57.0.17), then `npx expo install --check` until it is clean. Bump the root and app `overrides` for `react`/`react-dom` to SDK 57's React version. Bump `@types/react` and `typescript` per `--fix`.
2. **Pin `expo-router` and `react-native-screens` to exact versions** (no `~`/`^`), because the `unstable-native-tabs` API may move within SDK 57 patch releases.
3. Remove the dead app.json keys (`newArchEnabled`, `android.edgeToEdgeEnabled`) and anything else `expo-doctor` flags.
4. Replace every `@react-navigation/*` import with its verified expo-router export:
   - `NavigationThemeProvider` takes `ThemeProvider`, `DarkTheme` and `DefaultTheme` from `expo-router`.
   - `ConversationDrawerContent/*` takes `DrawerContentScrollView` and `DrawerContentComponentProps` from `expo-router/drawer`.
   - Run the codemod `npx expo-codemod sdk-56-expo-router-react-navigation-replace src` first if it exists, then finish by hand.
   - Drop the `@react-navigation/*` dependencies from `package.json` once nothing imports them. This is safe because `react-native-drawer-layout` is a direct dependency of expo-router 57.0.25, and `react-native-gesture-handler` is an SDK-managed peer that the app already declares. The `expo export` check (#6) catches any gap.
   - In Part 1, `SponsorPage` temporarily takes `useBottomTabBarHeight` from `expo-router/js-tabs` (which re-exports the forked bottom-tabs), so the Part 1 commit still builds with JS tabs. Part 2 removes it.
5. Remove `@expo/vector-icons` if nothing imports it (the app uses `@tamagui/lucide-icons`). Otherwise run the vector-icons codemod.
6. Declare `@sentry/react-native` explicitly in `packages/app/package.json` at an SDK 57-compatible version.
7. Check the non-Expo-managed dependencies against RN 0.86 and React 19.2, and bump only where peer deps or the build require it:
   - Tamagui stays on 1.x (latest 1.144.x); no Tamagui 3.
   - `@clerk/clerk-expo`, `@sentry/react-native`, `lottie-react-native`, `expo-speech-recognition`, `burnt`, `react-native-draggable-flatlist`, `react-native-render-html`, `react-native-markdown-display`.
   - Record what was checked in the scratchpad.
8. Babel: check whether SDK 57's `babel-preset-expo` already adds the worklets plugin, and remove the explicit `react-native-worklets/plugin` if so. Keep React Compiler enabled, and align `babel-plugin-react-compiler` and the ESLint config with SDK 57 if `expo-doctor` or lint asks.
9. Keep `react-native-webview` because the app uses it directly.
10. Streaming: keep the SDK 56+ default (`expo/fetch` as the global fetch) — no `EXPO_PUBLIC_USE_RN_FETCH` opt-out, since the app already streams through `expo/fetch`. Verify in `@expo/cli` 57 that Metro still injects the single-implementation Web Streams polyfill on native (`expo/virtual/streams`). If it does not, `TRPCProvider`'s fallback installs all three stream classes from the app's own `web-streams-polyfill`, as that knowledge entry requires. Record the finding.

### Part 2 — Liquid Glass conversion, commit(s) 2

1. **Native tab bar.** On iOS and Android, replace the JS `Tabs` in `(tabs)/_layout.tsx` with `NativeTabs` from `expo-router/unstable-native-tabs`. It has three `NativeTabs.Trigger`s:

   | Tab | SF Symbol (iOS) | Material icon (Android) |
   |---|---|---|
   | dashboard | `house` / `house.fill` | `home` |
   | sponsor | `bubble.left` / `bubble.left.fill` | `chat` |
   | journal | `book` / `book.fill` | `book` |

   Labels stay hidden, as today, and the tint follows the theme. On iOS 26 this is the system Liquid Glass tab bar; on iOS < 26 it is the classic system bar; on Android it is a Material 3 bar.

2. **Per-tab Stacks for headers.** Each tab becomes a folder with its own `_layout.tsx` `Stack`:
   - `dashboard/_layout.tsx` + `dashboard/index.tsx`
   - `sponsor/_layout.tsx` (+ the existing `sponsor/index.tsx`)
   - `journal/_layout.tsx` + `journal/index.tsx`

   The URLs (`/dashboard`, `/sponsor`, `/journal`) are unchanged. Header titles and the left/right buttons move into each Stack's `index` screen options. Each Stack keeps `headerShadowVisible: false` and `headerBackButtonDisplayMode: "minimal"`.

   `SponsorPage`'s dynamic `navigation.setOptions({ headerTitle })` now targets the Sponsor Stack's index screen, through `useNavigation()` inside that Stack. The "must match" comment is updated to point at `sponsor/_layout.tsx`.

3. **Web keeps JS tabs.** expo-router's NativeTabs has a basic web view, but it does not match today's web look. Add `(tabs)/_layout.web.tsx`, which uses expo-router's JS `Tabs` with `headerShown: false` because headers now come from the per-tab Stacks. Web keeps today's look: the bottom tab bar plus a header with title and buttons.

4. **Header buttons via custom views.** On iOS 26, native-stack `headerLeft`/`headerRight` custom views are hosted in `UIBarButtonItem`s, which the system draws on the shared Liquid Glass background. So `HeaderButton` drops the `forceGlass` prop and the `GlassView` branch and renders a plain, transparent, 44pt icon button.

   - **Why custom views and not `Stack.Toolbar` SF-symbol bar items:** one component works on iOS, Android and web, and it keeps the lucide icons. `Stack.Toolbar` is iOS-only and would need a second code path.
   - **Fallback:** if the device build shows no glass capsule, a double capsule or clipping, switch the iOS header items to expo-router's native bar items (`Stack.Toolbar` / header items with SF Symbols) and keep `HeaderButton` for Android and web. This is a replan if it changes more than the header-items code.
   - Remove the `headerStyle: {height:120}` hack.

5. **Drawer stays — the main unknown.** The right-side JS Drawer (`react-native-drawer-layout`) keeps wrapping the native tab navigator. Whether a JS drawer overlays a native `UITabBarController` correctly cannot be verified locally. It is **the first item on the device checklist**.
   - **Fallback (replan trigger):** move the conversation list from the drawer to a modal route, presented as a sheet from the Sponsor header button.
   - **Opening the drawer from the Sponsor tab's nested Stack** uses `navigation.dispatch(DrawerActions.openDrawer())` (from `expo-router/react-navigation`). The action bubbles up to the nearest drawer navigator. It is passed to `HeaderButton` as `onPress`, which replaces both the `"openDrawer"` pseudo-href and the `hasOwnProperty(navigation, "openDrawer")` check that would silently fail one level down.
   - The conversation list's selection/close behaviour inside `ConversationDrawerContent` keeps using the drawer props it receives.

6. **Push-notification routing.** The URLs are unchanged, so `DASHBOARD` and the redirect in `src/app/index.tsx` keep resolving. Typed routes are regenerated and tsc must pass with them.
   - `canGoBack()` semantics shift with the nested Stacks. On a cold start the tab Stack has no history, and `canGoBack()` is false, as today. The cold-start and warm-start notification taps are device-checklist items.

7. **Sponsor keyboard lift.** NativeTabs cannot report the tab-bar height. Which layout case applies is decided at work time **from source, not assumed**. Read expo-router 57's native-tabs screen container and react-native-screens' tab screen. Determine whether a non-scroll screen's root view ends above the tab bar (automatic content insets / `disableAutomaticContentInsets`) or extends under it. Record the finding in the scratchpad.
   - **Case 1 — the root ends above the tab bar.**
     - Keyboard hidden: the input keeps `$3` bottom padding.
     - Keyboard shown: `paddingBottom = keyboardHeight - bottomInset + 14`, where `bottomInset` = window height − (root pageY + root height). It is re-measured on every root `onLayout` that happens while the keyboard is hidden, and never taken from a layout made with the keyboard up.
   - **Case 2 — the root extends under the tab bar.**
     - Keyboard hidden: the input's padding is the native tab screen's bottom safe-area inset (`useSafeAreaInsets().bottom`, which includes the tab bar under a native tab controller) plus `$3`.
     - Keyboard shown: the input is lifted to `keyboardHeight + 14` from the window bottom, because the keyboard covers the tab bar.
   - **Fallback** if neither case is reliable on device: a per-OS tab-bar height constant documented in code.
   - Device checklist item 4 checks both keyboard states.
   - The ChatInput autosize logic is not touched (knowledge `2026-10-10-constraint-native-textinput-autosize-not-contentsize`, `2026-10-10-constraint-rn-web-textarea-autogrow-ratchet`). Web keeps its current path.

8. **Glass composer (optional, non-blocking).** On iOS 26 (`isLiquidGlassAvailable()`), the Sponsor `ChatInput`'s outer container renders on a `GlassView` (`glassEffectStyle: "regular"`). It wraps the existing container without changing its sizing. Elsewhere nothing changes. If it causes any layout issue it is dropped, and the PR does not block on it.

9. **Lists.** The Dashboard and Journal scroll views and FlatLists get `contentInsetAdjustmentBehavior="automatic"` on iOS, so content scrolls under the glass bars with correct insets. Scroll-to-top and minimize-on-scroll are **not** promised: FlatList support for them is limited in NativeTabs.

10. **Focus and refetch semantics.** Dashboard, Journal, JourneyInfo and JournalEntryInfo refetch via `useFocusEffect`. Under NativeTabs with per-tab Stacks, confirm by reading the source, and on the device checklist, that focus events still fire on a tab switch and on returning from a pushed screen. If NativeTabs does not emit focus for its tab screens, refetch on focus of the tab Stack's index screen instead.

### Candidate approaches considered for Part 2

- **A (chosen):** NativeTabs + per-tab native Stacks + system header glass; web keeps JS Tabs. This is real system Liquid Glass, with the iOS < 26 fallback for free, and it deletes the custom glass workaround. The costs: the per-tab folder restructure, an `unstable-` import path (pinned), and the loss of `useBottomTabBarHeight`.
- **B:** keep the JS Tabs and render a custom `tabBar` on a `GlassView`. This imitates glass rather than using `UITabBar` and keeps the JS headers and the `forceGlass` workaround. It fails "convert to the new iOS glass format" and the goal of removing the workarounds.
- **C:** adopt the SDK 58 beta for the stable `expo-router/native-tabs`. It fails the latest-**stable**-SDK criterion: SDK 58 is only on npm `next`. The later move to `native-tabs` is an import-path change.

## Success criteria

1. `packages/app/package.json` has `expo` at `~57.0.x` with x ≥ 17, and every Expo-managed dependency is at its SDK 57 version: `npx expo install --check` reports nothing to change. `expo-router` and `react-native-screens` are pinned to exact versions.
2. `npx expo-doctor` passes, or every remaining warning is listed in the PR body with a reason.
3. `app.json` no longer contains `newArchEnabled` or `edgeToEdgeEnabled`, and `npx expo config --type public` succeeds.
4. No `@react-navigation/` import remains under `packages/app/src` (`grep -rn "@react-navigation/" packages/app/src` is empty), and no `@react-navigation/*` package is a direct dependency of `packages/app`.
5. `npm run build` (app tsc with regenerated typed routes, plus the server build) and `npm run test` pass at the repo root, and `npm run lint` passes in `packages/app`. The app has no test suite (its `test` script only echoes); `npm run test` exercises the server tests only, so app verification is tsc, lint, and the checks in #6–7.
6. The bundling and prebuild checks succeed:
   - `npx expo export -p ios`, `-p android` and `-p web` all bundle successfully with `NODE_ENV=production`, so Tamagui extraction runs.
   - `npx expo prebuild -p ios --no-install` succeeds in a scratch copy; the generated directories are not committed.
7. The web export contains the tab routes (`dashboard/`, `sponsor/` and `journal/` route directories). expo-router's route resolver (`node .minerva/work/2026-10-10-expo-57-liquid-glass/verify-web-tabs-layout.cjs packages/app`) selects `./(auth)/(drawer)/(tabs)/_layout.web.tsx` for `web` and `./(auth)/(drawer)/(tabs)/_layout.tsx` for `ios` and `android`, and a mutation check shows it discriminates. The signed-in web render is checked by the user in criterion 14's item 11 (see replan.md 2026-10-10).
8. The tab layouts are in place:
   - `(tabs)/_layout.tsx` uses `NativeTabs` with three triggers, each with an `sf` and an `md` icon.
   - `(tabs)/_layout.web.tsx` uses JS `Tabs`.
   - Each tab has its own `_layout.tsx` `Stack`.
   - `DASHBOARD` in `usePushNotifications.native.ts` and the redirect in `src/app/index.tsx` still type-check against the regenerated routes.
9. `grep -rn "forceGlass\|height: 120" packages/app/src` is empty, and `HeaderButton` no longer imports `GlassView`.
10. Opening the drawer from the Sponsor header uses `DrawerActions.openDrawer()` dispatched through the navigation tree, passed to `HeaderButton` as `onPress`. Neither a `hasOwnProperty(…, "openDrawer")` check nor an `"openDrawer"` pseudo-href remains in `HeaderButton`.
11. `SponsorPage` no longer uses `useBottomTabBarHeight`. Its keyboard-shown bottom padding is derived from the keyboard height and the measured bottom inset, as in Part 2 step 7. Its dynamic header title still goes through `navigation.setOptions`.
12. Part 1 and Part 2 are separate commits, and the Part 1 commit passes criterion 5 on its own.
13. The streaming check (Part 1 step 10's Web Streams injection) is recorded in the scratchpad with its result.
14. The PR body states the minimum iOS (and Android minSdk) change and carries a device checklist for the user to run on the PR's EAS dev (TestFlight) build before merging, in this order:
    1. The drawer opens from Sponsor over the native tab bar and closes; selecting a conversation switches to it.
    2. The glass tab bar on iOS 26; tab switching.
    3. Glass header buttons (no double capsule or clipping) on all three tabs and on pushed screens.
    4. The chat input sits just above the keyboard and just above the tab bar when the keyboard is hidden.
    5. Sending a message streams a reply.
    6. The dynamic Sponsor title updates.
    7. Push-notification taps from cold start and from warm start land on the right screen.
    8. Creating a journey and a journal entry, then returning, shows each in its refreshed list (focus refetch).
    9. Light/dark mode.
    10. The Android tab bar, if an Android device is available, and iOS < 26, if available.
    11. Web, signed in (locally via `npm run web` with a real account, or on the deployed web build): `/dashboard`, `/sponsor` and `/journal` show the bottom JS tab bar and headers with their buttons, and the Sponsor menu button opens the drawer.

## Open Questions

- None blocking. Device-only behaviours (the drawer over native tabs, header glass, the keyboard lift) are verified by criterion 14, with the stated fallbacks and replan triggers.
