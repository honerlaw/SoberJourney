# Scratchpad: expo-57-liquid-glass

> **Ephemeral working memory.** Most of what lands here is noise — small
> decisions that don't matter, dead ends, momentary confusion. At feature
> completion, run `minerva:promote`: significant items get promoted to
> `.minerva/knowledge/`, `proposal.md` gets updated to match reality, and
> the raw scratchpad is archived.

## Decisions 2026-10-10
- [panel — 3/3 accept, 3 with fixes] scope check: one unit, one PR to main, unphased; Part 1/Part 2 as separate commits (tier: panel — high blast radius: SDK-wide native upgrade whose merge triggers a production App Store release; parallel wave)
    - fix (proponent/skeptic/arbiter): name the rejected epic-base-branch alternative (epic PRs get no CI or EAS dev build) and the rejected phase-1-to-main option (extra production release)
    - fix: state the all-or-nothing cost; Part 1 and Part 2 as separately building commits so Part 2 reverts alone; replan contingency (may move to an epic base) if Part 1 hits a blocker
    - fix: EAS Xcode precondition (resolved: EAS `auto` image for SDK 57 is Xcode 26.6); the dev build + device checklist is the only native verification; the user holds the production submit by holding the merge; app-only scope (no server changes); soften the file-count estimate; "and then" read as ordering of the work
- [panel — 3/3 accept, 3 with fixes] approach: A — NativeTabs (expo-router/unstable-native-tabs) + per-tab native Stacks + system header glass, web keeps JS Tabs; rejected B (custom GlassView JS tab bar: imitation, keeps workarounds) and C (SDK 58 beta: not latest stable) (tier: panel — high blast radius on the navigation shell; parallel wave)
    - fix: drawer over native tabs is the main unknown — first device-checklist item, fallback = conversation list as a modal sheet (replan trigger)
    - fix: concrete openDrawer mechanism (`DrawerActions.openDrawer()` dispatched, via HeaderButton onPress) + "drawer opens from Sponsor" criterion
    - fix: name the expo-router replacements for @react-navigation imports (verified in the 57.0.25 tarball) so criterion 4 is achievable; typed-routes regeneration check
    - fix: justify custom header views over Stack.Toolbar items, with a fallback to native bar items
    - fix: push-tap cold/warm checklist items (canGoBack branch); keyboard-lift formula + fallback; contentInsetAdjustmentBehavior on lists, no scroll-edge/minimize promise for FlatList
    - fix: pin expo-router and react-native-screens exactly; record third-party compat checks (Tamagui 1.x); Android md icons + checklist item; glass composer optional/non-blocking; Xcode 27 enforcement stated as an assumption; cite the stable-SDK criterion for rejecting C; Skeptic's "separate PRs" superseded by the scope panel
- [reviewed — clean] whole-proposal (first wave): Skeptic returned revise (dynamic Sponsor title, drawer mechanism, keyboard-lift fallback, EAS Xcode image, Sentry/babel/react-compiler/web/expo-fetch items) — result held, then discarded as stale; its items were merged into the v2 draft alongside the panel fixes (tier: reviewer — blast-radius clauses adjudicated by the scope/approach panels; parallel wave)
- [reviewed — folded] whole-proposal (restart): restarted because the approach panel's fixes rewrote ## Success criteria; Skeptic accepted but flagged load-bearing gaps — iOS 16.4 minimum not stated as a user-facing consequence, useFocusEffect refetch not covered under NativeTabs — folded, plus keyboard-lift two-case rule, openDrawer pseudo-href, js-tabs path, test-suite note (tier: reviewer; parallel wave restart)
- [rechecked — residual folded] whole-proposal: fold-audit accepted; residuals folded — item 9 (react-native-drawer-layout is an expo-router dependency, gesture-handler an SDK peer) and item 6 (npm run test only exercises the server); item 1 keyboard Case 2 premise left as a work-time source read + device check (not load-bearing)
- [reviewed — revise] completion verification: Verifier marked criterion 7 unmet (signed-out serve never renders the tab navigator behind Clerk's Stack.Protected); 2/5/6/12/14 noted as PR-body or author-reported → success-criteria divergence → Phase 2.5 (tier: reviewer floor — Verifier; no interface change beyond the approved proposal)
- [panel — 3/3 accept, 3 with fixes] new-plan acceptance (replan 2026-10-10): criterion 7 → expo-router route-resolver check (verify-web-tabs-layout.cjs, mutation-checked) + criterion 14 gains item 11 (signed-in web check by the user) (tier: panel floor)
    - fix (all three): amend criterion 14 too — the cited checklist item did not exist; state the replan changes 7 and 14
    - fix: state the render is deferred, not satisfied (reword-by-replan path); resolver + criterion 6 + tsc cover web-gets-NativeTabs and compile-time errors
    - fix: where the user runs the web check; full resolved paths; who ran the mutation check and that the file was restored; script needs path.resolve (done) and depends on expo-router internal getRoutesCore; name rejected alternatives (auth bypass, isolated-render stub)
- [reviewed — clean] completion verification (post-replan): Verifier reproduced criteria 1, 3–11, 13; 12 and 6-prebuild rest on recorded gate; 2 and 14 pending PR body at ship → accept (tier: reviewer floor — Verifier)
- [solo] review triage: 5 FIX (#1 tab a11y labels, #2 safe-area frame vs Dimensions, #3 re-measure on keyboard hide, #9 narrow bottomPadding type, #10 header-button a11y names) / 1 SUGGEST (#7 eslint downgrade disposition at promote) / 5 IGNORE (#4 one-frame Android jump, #5 centred empty/loading views shift under glass bar, #6 no action, #8 no test runner, #11 header spacing) (tier: default-solo row — no finding had two defensible dispositions; minerva audit: no spec/knowledge findings)

## Work notes
### Part 1 progress (2026-10-10)
- `npx expo install expo@^57 --fix` → expo 57.0.27, RN 0.86.3, React 19.2.3, reanimated 4.5.1, worklets 0.10.1, screens 4.26.2, gesture-handler ~2.32, safe-area ~5.7, datetimepicker 9.1.0, webview 13.16.1. Root + app `overrides` bumped to react/react-dom 19.2.3. Dev: @types/react ~19.2.4, eslint-config-expo ~57.0.2, typescript ~6.0.3. Pinned exact: expo-router 57.0.25, react-native-screens 4.26.2.
- `--fix` suggested adding plugins `expo-font`, `expo-image`, `expo-status-bar`, and `npx expo install @sentry/react-native` suggested the `@sentry/react-native` plugin — NOT added: none were used before; the Sentry plugin adds source-map upload needing an auth token in EAS (would risk the build). Behaviour-neutral to skip.
- `@sentry/react-native` declared explicitly at `~7.11.0` (SDK 57 recommended; was an undeclared hoisted 7.8.0).
- Removed `@expo/vector-icons` (unused), `@react-navigation/elements` (unused), `@react-navigation/{bottom-tabs,drawer,native}` after rewriting imports: codemod `sdk-56-expo-router-react-navigation-replace` rewrote `useBottomTabBarHeight` → `expo-router/js-tabs` and theme imports → `expo-router/react-navigation`; it refused `@react-navigation/drawer` ("use the Drawer layout") — repointed by hand to `expo-router/drawer`, which re-exports `DrawerContentScrollView` + `DrawerContentComponentProps`.
- app.json: removed `newArchEnabled`, `android.edgeToEdgeEnabled`.
- babel: SDK 57 `babel-preset-expo` auto-adds `react-native-worklets/plugin` when installed (configs/expo.js:96) → removed the explicit plugin entry.
- tsc: forked JS tabs type `tabBarIcon` color as `ColorValue`; lucide wants string → `color as string` cast in the JS tabs layout (file is replaced in Part 2 anyway).
- tsc against server types needs the worktree's own server build (`packages/server/.env` placeholder DATABASE_URL, gitignored) — CI does the same via `npm run build`.
- Lint: eslint-config-expo 57 enables React Compiler rules `react-hooks/set-state-in-effect` and `react-hooks/refs` as errors; 9 pre-existing hits (ConversationActionsModal, DashboardPage, ChatInput, ThemeContext, ConversationProvider ×4, TRPCProvider). Downgraded both to warn in eslint.config.js with a comment — behaviour-neutral (compiler already skipped those components). TODO candidate: rework those 9 sites.
- expo-doctor: duplicate native modules — `@clerk/clerk-expo@2.19.14` depends on `expo-auth-session@7` (→ expo-constants 18, expo-linking 8, expo-application 7) and `expo-web-browser@15`. Clerk 2.20.x moved these to peer deps → upgrading Clerk to ^2.20.1 + adding SDK 57 `expo-auth-session` (required peer for `useSSO`).
- Streaming check (criterion 13): @expo/cli 57.0.28 `withMetroMultiPlatform.js:206` still appends `expo/virtual/streams.js` (web-streams-polyfill v4.1.0) to the native polyfills — same single-implementation injection as SDK 54. `utils/streamingFetch` already uses `expo/fetch`. No `EXPO_PUBLIC_USE_RN_FETCH` opt-out; `TRPCProvider` fallback unchanged. Knowledge constraint 2026-10-07 holds as written.
- Clerk upgraded to ^2.20.1 + `expo-auth-session` ~57.0.14 → duplicates gone. (`npx expo install` hung after finishing the install; killed, `npm install` confirmed up to date.)
- expo-doctor: 20/21; remaining = React Native Directory metadata check (pre-existing `react-native-render-html` "unmaintained", transitive `@solana-mobile/mobile-wallet-adapter-protocol` via Clerk "no metadata") — informational, list in PR body.
- Web export failed: `@expo/cli`'s static renderer requires `@expo/metro-runtime`, which npm nested under `packages/app/node_modules/expo-router/node_modules` (expo-router itself is not hoisted). Declared `@expo/metro-runtime ~57.0.16` as a direct app dep (it is a required peer of expo-router 57) → hoisted, export OK.
- Part 1 gate: root `npm run build` ✓, `npm run test` ✓ (server 262/262; app has no tests), lint 0 errors (9 warnings), `expo export -p ios|android|web` with NODE_ENV=production ✓.

### Part 2 source findings (2026-10-10, expo-router 57.0.25)
- Keyboard-lift case: iOS `NativeTabsView.ios.js` passes `overrideScrollViewContentInsetAdjustmentBehavior: !disableAutomaticContentInsets` (scroll views only) and wraps each tab's content in its own `SafeAreaProvider` → a plain-view root (Sponsor) extends under the tab bar, and `useSafeAreaInsets().bottom` inside the tab is the native screen's safe area (tab bar + home indicator) = **Case 2 on iOS**. Android `NativeTabsView.android.js` wraps content in `SafeAreaView edges={{bottom:true}}` → root ends above the tab bar = **Case 1 on Android** (no inner provider; useSafeAreaInsets is the root's). Web uses JS tabs (content above the bar, insets 0).
  → Unified rule: measure the root's distance to the window bottom (`measureInWindow`, re-measured on root layout while the keyboard is hidden): keyboard shown → `keyboardHeight − gap + 14`; keyboard hidden → `max(0, insets.bottom − gap) + 13` ($3 = 13). iOS: gap 0 → inset+13 / kb+14. Android: gap ≥ insets.bottom → 13 / kb−gap+14.
- Focus semantics: `NativeBottomTabsNavigator` is built on the forked `useNavigationBuilder` and emits standard events → `useFocusEffect` in DashboardPage/JournalDashboardPage/JourneyInfo/JournalEntryInfo hooks keeps firing on tab switch and on pop. No code change; device checklist item 8 confirms.

### Part 2 implementation (2026-10-10)
- `(tabs)/_layout.tsx` → `NativeTabs` (unstable-native-tabs): dashboard `house`/`house.fill` + md `home`; sponsor `bubble.left`/`.fill` + md `chat`; journal `book`/`.fill` + md `book`; labels hidden (text kept for accessibility); `tintColor` = Tamagui `color`.
- `(tabs)/_layout.web.tsx` → expo-router JS `Tabs`, `headerShown: false`, same lucide icons/tabBarStyle as before.
- Per-tab Stacks via new `components/TabStackLayout` (title + profile `headerLeft` + optional `headerRight` on the `index` screen). `dashboard.tsx`/`journal.tsx` moved to `<tab>/index.tsx`; URLs unchanged (web export emits `/dashboard`, `/sponsor`, `/journal`).
- Sponsor drawer: `sponsor/_layout.tsx` `OpenDrawerButton` dispatches `DrawerActions.openDrawer()` (expo-router/react-navigation) via `HeaderButton onPress`. HeaderButton lost `forceGlass`, the `GlassView` branch and the `"openDrawer"` pseudo-href. `SPONSOR_HEADER_TITLE` now exported from SponsorPage (the layout imports it; no "must match" duplication).
- Keyboard lift: new `SponsorPage/hooks/useInputBottomPadding` (rule from the source findings above); `useBottomTabBarHeight` gone.
- Lists (routine choice, deviates in form from step 9): Dashboard/Journal previously padded `contentContainerStyle.paddingBottom` with `useSafeAreaInsets().bottom`. Under native tabs that inset includes the tab bar on iOS (tab-level SafeAreaProvider) and Android's tab content is already bottom-padded → padding would double with automatic insets. Replaced with `contentInsetAdjustmentBehavior="automatic"` (explicit, idempotent with the native-tabs default override) and dropped the manual padding.
- Step 8 glass composer: **skipped** (optional/non-blocking per proposal). Reason: on iOS the composer's padded area sits behind the floating glass tab bar; a glass composer there is glass-on-glass, which Apple's guidance avoids. The composer stays solid.
- Verification: tsc ✓, lint 0 errors ✓, `expo export` ios/android/web (production) ✓, root build ✓, server tests 262/262 ✓, `expo prebuild -p ios --no-install` ✓ (IPHONEOS_DEPLOYMENT_TARGET 16.4; generated ios/ deleted). Android minSdk 24 → 24 (unchanged). Web runtime (JS tabs chosen via `_layout.web.tsx`) not observable signed-out: protected routes render the loader in static export → web smoke goes on the PR checklist.
- Export warning: Clerk logs "@clerk/clerk-expo is deprecated, migrate to @clerk/expo" (2.20.x). Informational; migration is a separate change (TODO candidate).

## Review triage 2026-10-10
Code review (local-diff mode, fresh-context subagent) over fdc5282+769d5ea; minerva audit inline (spec fidelity: matches approach; deviations recorded — step 8 skipped, step 9 form; knowledge: autosize untouched, streams unchanged, provider order untouched, app-only).
1. [medium] native tabs have no screen-reader name — expo-router 57 `appendLabelOptions` sets `title=''` for a hidden Label → FIX: `accessibilityLabel` per Trigger (my earlier "text kept for accessibility" note was wrong).
2. [medium] Android: `Dimensions` window height vs `measureInWindow` frame may disagree by the nav bar → FIX: measure against `useSafeAreaFrame()` (frame.y + height); Android 3-button vs gesture nav added to device checklist.
3. [low] measurement skipped if the first root layout happens with the keyboard up, never retried → FIX: effect re-measures whenever the keyboard hides.
4. [low] Android one-frame padding jump on mount → IGNORE (cosmetic; Android not shipped to a store).
5. [low] iOS centred loading/empty views sit under the glass tab bar → IGNORE (cosmetic; nothing bottom-anchored).
6. drawer dispatch path confirmed → no action.
7. [low] React Compiler rules downgraded app-wide → SUGGEST (TODO disposition at promote).
8. [low] no tests for new hook/layouts → IGNORE (app has no test runner).
9. [low] `ChatInput.bottomPadding: number | string` string path dead → FIX: `number`.
10. [low] header buttons have no accessible name (pre-existing) → FIX: required `label` prop on HeaderButton → `aria-label`; labels at all 8 call sites. Pressed-background half → IGNORE (same as pushed-screen buttons before).
11. [low] header button spacing on web's JS header → IGNORE (cosmetic).
After fixes: tsc ✓, lint 0 errors ✓, exports ios/android/web ✓, root build ✓, route check ✓.
