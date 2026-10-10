# Proposal: expo-57-liquid-glass

**Date**: 2026-10-10
**Status**: Shipped (2026-10-10)

**Seed (user):** "Can we update to the latest version of expo, and then convert everything to use the new iOS glass format that we need to do"

## Goal

Move the SoberJourney app (`packages/app`) from Expo SDK 54 (RN 0.81.5, React 19.1.0, expo-router 6) to the latest **stable** Expo SDK, **57** (RN 0.86.x, React 19.2.x, expo-router 57), and convert the app's navigation chrome to the system-native iOS 26 Liquid Glass design:
- a native `UITabBar` tab bar;
- native per-tab navigation headers whose bar buttons get the system glass treatment;
- glass on the app's one custom floating surface, the Sponsor chat composer. This was optional and was **not shipped**: see Approach, "What did not ship".

The hand-rolled `forceGlass` / `GlassView` header-button workaround and the `height: 120` header hack are removed.

**Accepted user-facing consequence:** SDK 56+ raises the minimum iOS version from 15.1 to 16.4. Android minSdk stays at 24. Devices on iOS 15.1–16.3 stop receiving app updates. The PR body states this explicitly, with the before and after minimums.

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

What shipped, in one PR to `main` with separate commits. The PR stays open as the device-test gate: the user merges by hand after running the checklist on the PR's EAS dev build. Decisions and reasoning: `.minerva/knowledge/2026-10-10-decision-liquid-glass-navigation-native-tabs.md`. Upgrade specifics: `2026-10-10-reference-expo-sdk-57-upgrade-notes.md`.

### Part 1 — Expo SDK 54 → 57 (commit `fdc5282`)

- **Versions.**
  - `expo ~57.0.27` with every Expo module at SDK 57: RN 0.86.3, React/react-dom 19.2.3 in the root and app `overrides`, reanimated 4.5.1, worklets 0.10.1, gesture-handler ~2.32, safe-area-context ~5.7.
  - `expo-router` `57.0.25` and `react-native-screens` `4.26.2` are pinned exactly, because the native-tabs API is unstable.
  - Dev dependencies: `@types/react ~19.2.4`, `eslint-config-expo ~57.0.2`, `typescript ~6.0.3`.
- **React Navigation removed.**
  - Imports now come from expo-router's fork: `expo-router/drawer`, `expo-router/react-navigation`, and `expo-router/js-tabs` (Part 1 only).
  - `@react-navigation/{native,drawer,bottom-tabs,elements}` and the unused `@expo/vector-icons` were removed.
- **Config.**
  - `app.json` drops `newArchEnabled` and `android.edgeToEdgeEnabled`.
  - `babel.config.js` drops the explicit worklets plugin, because the preset adds it.
  - `eslint.config.js` downgrades the new React Compiler rules `react-hooks/set-state-in-effect` and `react-hooks/refs` to warnings, for nine pre-existing sites.
- **Dependencies beyond `expo install --fix`.**
  - `@clerk/clerk-expo ^2.20.1` plus `expo-auth-session ~57.0.14`, which removes SDK 54's duplicate native modules.
  - `@sentry/react-native ~7.11.0` declared explicitly; it was previously an undeclared hoisted dependency.
  - `@expo/metro-runtime ~57.0.16` declared directly, because the web static export could not resolve it.
- **Not added.** The Expo-suggested config plugins (`expo-font`, `expo-image`, `expo-status-bar`, `@sentry/react-native`) were left out. None were used before, and the Sentry plugin needs an upload token in EAS.
- **Streaming unchanged.** `@expo/cli` 57 still injects the single Web Streams polyfill, and the app already streams through `expo/fetch`.

### Part 2 — Liquid Glass navigation (commit `769d5ea`, review fixes `1c9966d`, `9020ec2`, `2d24f15`)

- **Tabs.** `(tabs)/_layout.tsx` uses `NativeTabs` from `expo-router/unstable-native-tabs`.
  - Icons: `house`, `bubble.left` and `book` SF Symbols with `.fill` when selected; Material `home`, `chat` and `book`.
  - Labels are hidden. Each trigger has an `accessibilityLabel`, because a hidden label drops the native title.
  - `tintColor` follows the Tamagui `color`.
- **Web.** `(tabs)/_layout.web.tsx` keeps the JS tab bar with `headerShown: false`. `verify-web-tabs-layout.cjs` (in this unit) shows expo-router resolves it for `web` and the native layout for `ios`/`android`.
- **Headers.** `dashboard/`, `sponsor/` and `journal/` are folders, each with a `_layout.tsx` built on `components/TabStackLayout`. That component is a native Stack whose `index` screen carries the title, the profile `headerLeft` and an optional `headerRight`. URLs are unchanged.
- **HeaderButton.** It is a plain transparent icon button with a required `label`, applied as `aria-label` plus `accessible` at all call sites. `forceGlass`, the `GlassView` branch, the `"openDrawer"` pseudo-href and the `height: 120` header hack are gone.
- **Drawer.** The Sponsor header's `OpenDrawerButton` dispatches `DrawerActions.openDrawer()`, which bubbles from the tab's Stack to the JS drawer. `SPONSOR_HEADER_TITLE` is exported from `SponsorPage` and used by the Sponsor layout. The page still sets the conversation title with `navigation.setOptions`.
- **Sponsor input lift.** `SponsorPage/hooks/useInputBottomPadding` replaces `useBottomTabBarHeight`. It measures the screen root against `useSafeAreaFrame()` while the keyboard is hidden, and re-measures each time the keyboard hides.
  - Keyboard shown: padding = `keyboardHeight − offset + 14`.
  - Keyboard hidden: padding = `max(0, insets.bottom − offset) + 13`.
  - Why this works on each platform is in `.minerva/knowledge/2026-10-10-constraint-native-tabs-insets-and-unmeasurable-tab-bar.md`.
  - `ChatInput.bottomPadding` is now `number`. Its autosize logic is untouched.
- **Lists.** Dashboard and Journal use `contentInsetAdjustmentBehavior="automatic"`. Their manual `paddingBottom: insets.bottom` was removed, because it would double the gap under native tabs.

### What did not ship
- **Glass composer (optional step).** The composer's padded area sits behind the floating glass tab bar, and making it glass would be glass-on-glass. It stays solid.

### Verification
- Local checks:
  - `npx expo install --check` is clean; expo-doctor passes 20/21, the remaining check being React Native Directory metadata.
  - tsc passes; lint has 0 errors.
  - `NODE_ENV=production expo export` succeeds for ios, android and web.
  - `expo prebuild -p ios --no-install` succeeds, with deployment target 16.4.
  - Root build passes, and server tests pass 262/262 (the app has no tests).
  - The route-resolver check passes.
- Native behaviour is verified on the PR's EAS dev build through criterion 14's checklist. See also `replan.md` for criterion 7.

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
