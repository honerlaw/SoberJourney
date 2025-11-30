import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";

import { useAuth } from "@clerk/clerk-expo";
import superjson from "superjson";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  loggerLink,
  splitLink,
  TRPCClientError,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs";
import { useConfig } from "@/src/providers/ConfigProvider";
import { useReportError } from "@/src/hooks/useReportError";
import { useAuth as useAuthHelpers } from "@/src/hooks/useAuth";

// Polyfills for React Native SSE support
import "@azure/core-asynciterator-polyfill";
import { ReadableStream, TransformStream } from "web-streams-polyfill";
import { CustomEventSource } from "@/src/utils/CustomEventSource";

// Ensure global objects are available for React Native
if (typeof globalThis !== "undefined") {
  globalThis.ReadableStream = globalThis.ReadableStream || ReadableStream;
  globalThis.TransformStream = globalThis.TransformStream || TransformStream;
}

const context = createTRPCContext<AppRouter>();

const TRPCContextProvider = context.TRPCProvider;

export const useTRPC = context.useTRPC;

export const TRPCProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const config = useConfig();
  const { getToken } = useAuth();
  const { logout } = useAuthHelpers();
  const { report } = useReportError();

  // Handle auth errors globally
  const handleError = useCallback((error: unknown) => {
    if (error instanceof TRPCClientError) {
      // Check for specific error codes that should trigger logout
      if (
        error.data?.code === "UNAUTHORIZED" ||
        error.data?.httpStatus === 401 ||
        error.message?.includes("Token expired") ||
        error.message?.includes("Invalid token")
      ) {
        logout().catch((logoutErr) => {
          report(logoutErr);
        });
      }
    }
  }, [logout, report]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              // Don't retry on auth errors
              if (error instanceof TRPCClientError) {
                if (error.data?.code === "UNAUTHORIZED") {
                  return false;
                }
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
            onError: (error) => {
              handleError(error);
            },
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            handleError(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            handleError(error);
          },
        }),
      })
  );

  const getHeaders = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        return {};
      }
      return {
        Authorization: `Bearer ${token}`,
      };
    } catch (err) {
      report(err);
      return {};
    }
  }, [getToken, report]);

  const options = useMemo(
    () => ({
      links: [
        loggerLink(),
        splitLink({
          condition: (op) => {
            return op.type === "subscription";
          },
          true: httpSubscriptionLink({
            transformer: superjson,
            url: `${config.baseUrl}${config.trpcRelativeUrl}`,
            EventSource: CustomEventSource,
            eventSourceOptions: async () => {
              const headers = await getHeaders();
              if (!headers.Authorization) {
                return {} as any;
              }
              return {
                headers,
              } as any;
            },
          }),
          false: httpBatchLink({
            transformer: superjson,
            url: `${config.baseUrl}${config.trpcRelativeUrl}`,
            async headers() {
              return await getHeaders();
            },
          }),
        }),
      ],
    }),
    [getHeaders, config],
  );
  const trpcClient = useMemo(
    () => createTRPCClient<AppRouter>(options),
    [options],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCContextProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCContextProvider>
    </QueryClientProvider>
  );
};
