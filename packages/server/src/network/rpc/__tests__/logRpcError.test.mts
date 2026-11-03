import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { createRpcErrorLogger } from "../logRpcError.mjs";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";

describe("createRpcErrorLogger", () => {
  it("logs an unexpected error with its cause", () => {
    const { logger, mocked } = mockLogger();
    const cause = new Error("prisma: connection refused");
    createRpcErrorLogger(logger)({
      error: new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause }),
      path: "journal.list",
      type: "query",
    });
    assert.equal(mocked.error.mock.callCount(), 1);
    const [entry] = mocked.error.mock.calls[0]!.arguments as [
      { error: unknown; attributes: { path: string } },
    ];
    assert.equal(entry.error, cause);
    assert.equal(entry.attributes.path, "journal.list");
  });

  it("does not log expected codes", () => {
    const { logger, mocked } = mockLogger();
    const log = createRpcErrorLogger(logger);
    for (const code of [
      "UNAUTHORIZED",
      "BAD_REQUEST",
      "TOO_MANY_REQUESTS",
      "FORBIDDEN",
      "NOT_FOUND",
    ] as const) {
      log({ error: new TRPCError({ code }), path: "x", type: "query" });
    }
    assert.equal(mocked.error.mock.callCount(), 0);
  });
});
