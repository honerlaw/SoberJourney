# TRPCProvider sits outside its own QueryClientProvider and the ToastProvider

**Date**: 2026-10-06
**Type**: constraint
**Theme**: app-infrastructure
**Summary**: TRPC/Config/Auth providers render above QueryClientProvider and ToastProvider; their hooks can't use them.
**Context**: .minerva/work/2026-10-06-app-infra-auth-errors (see git history if the worktree has been cleaned up)

## Context
`components/AppLayout/AppLayout.tsx` nests AppThemeProvider > ConfigProvider >
AuthProvider (Clerk) > TRPCProvider (creates the QueryClient and renders
QueryClientProvider) > ToastProvider > children. The root `app/_layout.tsx` `Routes` is the
children.

## Finding
- Code in `TRPCProvider` itself (and anything above it) cannot call `useQueryClient()`, so
  hooks that need it — e.g. `hooks/useAuth` — are unusable there; pass the client instead.
- `ConfigProvider`, `AuthProvider` and `TRPCProvider` are above `ToastProvider`: a toast
  shown from them does not render, and `useReportError().report` (which depends on
  `useToastController()`) should not be an effect dependency there — read it via a ref.
- Hooks needing Clerk state or the navigator (e.g. `usePushNotifications`) must run in
  `Routes`, not in `AppLayout`.
- The root layout already renders a non-navigator first (ConfigProvider's loader, and
  `Routes` waits for Clerk `isLoaded`), so nothing may navigate before the Stack mounts;
  gate navigation on `useRootNavigationState()?.key`.

## Implications
Moving providers changes which hooks are legal where; re-check this list before
reordering `AppLayout`.

## Related
- [[2026-10-06-pattern-session-teardown-endsession]] — consequence for logout
