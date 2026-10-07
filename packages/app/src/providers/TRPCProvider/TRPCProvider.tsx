import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { isClerkAPIResponseError, useAuth } from "@clerk/clerk-expo"
import superjson from "superjson"
import {
  createTRPCClient,
  httpBatchLink,
  httpBatchStreamLink,
  loggerLink,
  splitLink,
  TRPCClientError,
} from "@trpc/client"
import { createTRPCContext } from "@trpc/tanstack-react-query"
import type { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs"
import { useConfig } from "@/src/providers/ConfigProvider"
import { useReportError } from "@/src/hooks/useReportError"
import { endSession } from "@/src/hooks/useAuth/endSession"
import { useCalendars } from "expo-localization"

// Polyfills for the streamed (JSONL) responses read by httpBatchStreamLink
import "@azure/core-asynciterator-polyfill"
import { ReadableStream, TransformStream } from "web-streams-polyfill"
import { streamingFetch } from "@/src/utils/streamingFetch"

// Ensure global objects are available for React Native
if (typeof globalThis !== "undefined") {
  globalThis.ReadableStream = globalThis.ReadableStream || ReadableStream
  globalThis.TransformStream = globalThis.TransformStream || TransformStream
}

const context = createTRPCContext<AppRouter>()

const TRPCContextProvider = context.TRPCProvider

export const useTRPC = context.useTRPC
export const useTRPCClient = context.useTRPCClient

/**
 * Procedures whose output is streamed (an async iterable). Only these go
 * through `httpBatchStreamLink`; everything else keeps the plain batch link.
 */
const STREAMED_PATHS: ReadonlySet<string> = new Set([
  "conversation.streamSponsorChat",
])

// Auth errors: a released server only returns UNAUTHORIZED / 401 for real auth
// failures (epic #34 rule 4), so these are the logout candidates.
function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof TRPCClientError &&
    (error.data?.code === "UNAUTHORIZED" ||
      error.data?.httpStatus === 401 ||
      error.message?.includes("Token expired") ||
      error.message?.includes("Invalid token"))
  )
}

// Deterministic client errors (4xx) will fail the same way again. 408 (timeout)
// and 429 (rate limited) are transient by definition, so they keep retrying.
function isNonRetryableError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) {
    return false
  }
  if (error.data?.code === "UNAUTHORIZED") {
    return true
  }
  const status = error.data?.httpStatus
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  )
}

// After this many separate bursts of 401s while Clerk still mints a token
// (e.g. user deleted server-side), log out anyway rather than loop forever.
const MAX_VERIFIED_UNAUTHORIZED = 3

export const TRPCProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const config = useConfig()
  const { getToken, isSignedIn, signOut, userId } = useAuth()
  const { report } = useReportError()
  const calendars = useCalendars()

  // Latest Clerk state for the QueryClient callbacks, which are created once.
  const authRef = useRef({ getToken, isSignedIn, signOut, report })
  useEffect(() => {
    authRef.current = { getToken, isSignedIn, signOut, report }
  }, [getToken, isSignedIn, signOut, report])

  const verifyRef = useRef<Promise<boolean> | null>(null)
  const verifiedUnauthorizedCount = useRef(0)

  // Assigned below, once the QueryClient exists; read lazily by its callbacks.
  const onErrorRef = useRef<(error: unknown) => void>(() => {})
  const onSuccess = useCallback(() => {
    verifiedUnauthorizedCount.current = 0
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (isNonRetryableError(error)) {
                return false
              }
              return failureCount < 3
            },
          },
          mutations: {
            retry: false,
          },
        },
        // One handler per failure: queries via QueryCache, mutations via
        // MutationCache (no default `mutations.onError`, which double-fired).
        queryCache: new QueryCache({
          onError: (error) => onErrorRef.current(error),
          onSuccess,
        }),
        mutationCache: new MutationCache({
          onError: (error) => onErrorRef.current(error),
          onSuccess,
        }),
      }),
  )

  // Handle auth errors globally: log out only when the session is really gone.
  useEffect(() => {
    onErrorRef.current = (error: unknown) => {
      if (!isUnauthorizedError(error)) {
        return
      }
      const { getToken, isSignedIn, signOut, report } = authRef.current
      // Not signed in (or Clerk still loading): nothing to log out of, and a
      // request that went out without a token must not end a loading session.
      if (isSignedIn !== true) {
        return
      }

      // One forced token refresh per burst of parallel 401s. A fresh token means
      // the 401 was transient (e.g. sent before the session token was ready).
      if (!verifyRef.current) {
        // Session still valid per Clerk: count the burst, log out at the cap.
        const countVerifiedBurst = () => {
          verifiedUnauthorizedCount.current += 1
          return verifiedUnauthorizedCount.current >= MAX_VERIFIED_UNAUTHORIZED
        }
        verifyRef.current = getToken({ skipCache: true })
          .then((token) => (token ? countVerifiedBurst() : true))
          .catch((err) => {
            // Offline / network failure: never log out on a failed check.
            // Clerk rejecting the refresh counts like a fresh-token 401.
            return isClerkAPIResponseError(err) ? countVerifiedBurst() : false
          })
          .then((shouldLogout) => {
            if (!shouldLogout) {
              // Transient 401: queries don't retry 4xx, so refetch the failed
              // ones once with the fresh token instead of leaving their screens
              // on an error. Bounded by MAX_VERIFIED_UNAUTHORIZED.
              queryClient
                .invalidateQueries({
                  predicate: (query) => query.state.status === "error",
                })
                .catch(() => {})
            }
            return shouldLogout
          })
          .finally(() => {
            verifyRef.current = null
          })
      }

      verifyRef.current
        .then((shouldLogout) => {
          if (!shouldLogout) {
            return
          }
          verifiedUnauthorizedCount.current = 0
          return endSession({ signOut, queryClient })
        })
        .catch((logoutErr) => {
          report(logoutErr)
        })
    }
  }, [queryClient])

  // Safety net: whenever Clerk goes from a user to no user (by any path),
  // drop that user's cached data. Skips the initial signed-out mount.
  const previousUserId = useRef(userId)
  useEffect(() => {
    const previous = previousUserId.current
    previousUserId.current = userId
    if (previous && !userId) {
      queryClient.clear()
    }
  }, [userId, queryClient])

  const getHeaders = useCallback(async () => {
    const timeZone = calendars[0]?.timeZone ?? "America/New_York"
    try {
      const token = await getToken()
      if (!token) {
        return {
          "X-IANA-Time-Zone": timeZone,
        }
      }
      return {
        Authorization: `Bearer ${token}`,
        "X-IANA-Time-Zone": timeZone,
      }
    } catch (err) {
      report(err)
      return {
        "X-IANA-Time-Zone": timeZone,
      }
    }
  }, [getToken, report, calendars])

  const options = useMemo(
    () => ({
      links: [
        loggerLink(),
        splitLink({
          condition: (op) => STREAMED_PATHS.has(op.path),
          true: httpBatchStreamLink({
            transformer: superjson,
            url: `${config.baseUrl}${config.trpcRelativeUrl}`,
            // React Native's fetch cannot stream a response body.
            fetch: streamingFetch,
            maxItems: 1,
            async headers() {
              return await getHeaders()
            },
          }),
          false: httpBatchLink({
            transformer: superjson,
            url: `${config.baseUrl}${config.trpcRelativeUrl}`,
            async headers() {
              return await getHeaders()
            },
          }),
        }),
      ],
    }),
    [getHeaders, config],
  )
  const trpcClient = useMemo(
    () => createTRPCClient<AppRouter>(options),
    [options],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCContextProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCContextProvider>
    </QueryClientProvider>
  )
}
