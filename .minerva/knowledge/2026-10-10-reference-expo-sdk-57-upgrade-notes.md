# Expo SDK 57 in this monorepo: what the 54 → 57 upgrade needed, and standing debts it left

**Date**: 2026-10-10
**Type**: reference
**Theme**: app-infrastructure
**Summary**: SDK 57 upgrade needs: direct @expo/metro-runtime, Clerk ≥2.20, preset-provided worklets plugin, new lint rules
**Context**: .minerva/work/2026-10-10-expo-57-liquid-glass (see git history if the worktree has been cleaned up)

## Context
`packages/app` moved from Expo SDK 54 (RN 0.81.5, React 19.1) to SDK 57 (RN 0.86.3, React 19.2.3, expo-router 57) in npm workspaces. React is pinned via root and app `overrides`. Local Xcode was 26.2, below the 26.4 that SDK 56+ requires, so native verification relies on EAS builds.

## Finding
- **expo-router forks React Navigation (SDK 56+).**
  - Imports come from `expo-router/drawer` (`DrawerContentScrollView`, `DrawerContentComponentProps`), `expo-router/react-navigation` (`ThemeProvider`, themes, `DrawerActions`) and `expo-router/js-tabs`.
  - The `sdk-56-expo-router-react-navigation-replace` codemod refuses `@react-navigation/drawer`.
  - The `@react-navigation/*` packages were removed.
- **Web static export needs `@expo/metro-runtime` as a direct app dependency.** npm left expo-router un-hoisted, so its peer was nested where `@expo/cli`'s static renderer could not resolve it.
- **Clerk.** `@clerk/clerk-expo` < 2.20 depends on SDK 54's `expo-auth-session`/`expo-web-browser`, which expo-doctor flags as duplicate native modules. 2.20 makes them peers, so `expo-auth-session` must be installed at the SDK version (`useSSO` needs it). Clerk 2.20 also logs that `@clerk/clerk-expo` is deprecated in favour of `@clerk/expo`; that migration was not done.
- **Babel.** `babel-preset-expo` 57 adds `react-native-worklets/plugin` itself, so the explicit entry was removed.
- **Lint.** `eslint-config-expo` 57 enables the React Compiler rules `react-hooks/set-state-in-effect` and `react-hooks/refs` as errors.
  - Nine pre-existing sites (ConversationProvider ×4, TRPCProvider, ThemeContext, DashboardPage, ChatInput, ConversationActionsModal) are downgraded to warnings in `eslint.config.js`.
  - The compiler skips those components, as it did before the upgrade.
- **Streams.** `@expo/cli` 57 still injects the single web-streams-polyfill (`expo/virtual/streams.js`), and `expo/fetch` became the global fetch. The tRPC JSONL stream path needed no change.
- **Platform minimums.** The iOS deployment target is now 16.4 (devices on 15.1–16.3 stop getting updates). Android minSdk stays 24. EAS `auto` picks Xcode 26.6 for SDK 57.
- **Tooling notes.**
  - `npx expo install <pkg>` can hang after a successful install.
  - expo-doctor's remaining warning is React Native Directory metadata: `react-native-render-html` is unmaintained, and `@solana-mobile/mobile-wallet-adapter-protocol` (via Clerk) has no metadata.
  - In a worktree, app `tsc` needs the worktree's own server build (with a placeholder `DATABASE_URL`), because the tRPC types come from `@onerlaw/soberjourney-server/dist`.

## Implications
- Standing debts, none urgent:
  - the nine compiler-rule sites;
  - the Clerk package migration;
  - `react-native-render-html` being unmaintained;
  - Tamagui still on 1.x (3.x exists).
- Before future SDK bumps, re-run `npx expo install --check`, `npx expo-doctor`, and `expo export -p web` (it catches resolution problems the native exports miss).

## Related
- [[2026-10-07-constraint-hermes-streams-for-trpc-jsonl]] — still holds on SDK 57
- [[2026-10-10-decision-liquid-glass-navigation-native-tabs]] — the navigation change shipped with this upgrade
