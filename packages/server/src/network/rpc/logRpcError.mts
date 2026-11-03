import type { TRPCError } from "@trpc/server";
import type { Logger } from "../../util/logger/index.mjs";

/**
 * tRPC `onError`: logs unexpected (INTERNAL_SERVER_ERROR) failures with
 * their cause. The errorFormatter hides an unexpected error's message from
 * clients, so the server log is where its real message and stack live.
 * Expected codes (auth, validation, limits, not found) are not logged here.
 */
export function createRpcErrorLogger(logger: Logger) {
  return ({
    error,
    path,
    type,
  }: {
    error: TRPCError;
    path?: string | undefined;
    type: string;
  }) => {
    if (error.code !== "INTERNAL_SERVER_ERROR") {
      return;
    }
    logger.error(
      {
        error: error.cause ?? error,
        tags: ["rpc", "onError"],
        attributes: { path, type, message: error.message },
      },
      "Unexpected error in tRPC procedure",
    );
  };
}
