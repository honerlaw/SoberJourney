# App errors: one Sentry report, one toast, both error formats

**Date**: 2026-10-06
**Type**: pattern
**Theme**: app-infrastructure
**Summary**: handleError always toasts and never throws; ErrorView never reports; producers report once.
**Context**: .minerva/work/2026-10-06-app-infra-auth-errors (see git history if the worktree has been cleaned up)

## Context
`useToastError` JSON.parse'd every tRPC error message; only zod errors are JSON, so every
other error threw inside callers' `catch` blocks — no toast anywhere and an unhandled
rejection. Every error rendered by `ErrorView` was also reported to Sentry twice.

## Finding
- `hooks/useToastError/getErrorMessage.ts` (pure, import-free) maps errors: zod JSON array
  → first issue message; user-facing 4xx tRPC code with a plain message → that message;
  otherwise the caller's fallback, else network/generic text. Old and new servers both
  work. JSON that isn't a zod issue array is never shown raw.
- `handleError(error, fallbackMessage?)` is referentially stable (refs + `useCallback([])`),
  always toasts and never throws.
- Single-report rule: query errors are reported by the query hook that consumes them;
  mutation errors by the caller's `handleError`; `ConfigProvider` reports its own fetch
  error; `ErrorView` never reports; Clerk user errors (wrong password, bad code) are shown
  inline and not reported.

## Implications
- A new page rendering `ErrorView` for a query error must report it in its hook.
- `getErrorMessage` can be checked without an app test runner:
  `node --experimental-strip-types` on a script that imports it by absolute path.

## Related
- [[2026-10-06-constraint-app-provider-order]] — where toasts can render
