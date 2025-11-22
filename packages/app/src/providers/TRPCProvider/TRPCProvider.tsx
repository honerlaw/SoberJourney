import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";

import { useAuth } from "@clerk/clerk-expo";
import superjson from "superjson";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  loggerLink,
  splitLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs";
import { useConfig } from "@/src/providers/ConfigProvider";
import { useReportError } from "@/src/hooks/useReportError";

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
  const [queryClient] = useState(() => new QueryClient());
  const { report } = useReportError();

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
