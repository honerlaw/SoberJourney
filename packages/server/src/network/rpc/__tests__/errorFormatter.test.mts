import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import superjson from "superjson";
import { TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { procedure, router } from "../router.mjs";
import {
  GENERIC_INTERNAL_MESSAGE,
  isWrappedUnexpectedError,
} from "../errorFormatter.mjs";
import { isDevelopment } from "../../../util/environment.mjs";
import { buildClerkOptions } from "../../../util/clerkOptions.mjs";

// Procedures on the real shared router/procedure, so the production
// errorFormatter and isDev apply.
const appRouter = router({
  plainError: procedure.query(() => {
    throw new Error("connect ECONNREFUSED 10.0.0.5:5432 (prisma)");
  }),
  thrownString: procedure.query(() => {
    throw "raw string";
  }),
  deliberate: procedure.query(() => {
    throw new InternalServerError("Failed to create journal entry.");
  }),
  deliberateWithCause: procedure.query(() => {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to generate response.",
      cause: new Error("upstream detail"),
    });
  }),
  unauthorized: procedure.query(() => {
    throw new UnauthorizedError();
  }),
  tokenExpired: procedure.query(() => {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Token expired" });
  }),
  tooMany: procedure.query(() => {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "slow down" });
  }),
});

let server: Server;
let base: string;

before(async () => {
  const app = express();
  app.use(
    "/api/trpc",
    express.json(),
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: () => ({ auth: { user: null } }) as never,
    }),
  );
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc`;
});

after(() => {
  server.close();
});

async function call(path: string) {
  const res = await fetch(`${base}/${path}`);
  const body = (await res.json()) as { error: never };
  const error = superjson.deserialize(body.error) as {
    message: string;
    data: { code: string; httpStatus: number; stack?: string };
  };
  return { status: res.status, error };
}

describe("isDevelopment / dev flags", () => {
  it("is true only for NODE_ENV=development", () => {
    assert.equal(isDevelopment("development"), true);
    for (const value of [undefined, "", "production", "test", "staging"]) {
      assert.equal(isDevelopment(value), false, String(value));
    }
  });

  it("sets tRPC isDev explicitly (false under test)", () => {
    assert.equal(appRouter._def._config.isDev, false);
  });

  it("turns Clerk debug on only in development", () => {
    assert.equal(buildClerkOptions({ NODE_ENV: "development" }).debug, true);
    assert.equal(buildClerkOptions({}).debug, false);
    assert.equal(buildClerkOptions({ NODE_ENV: "production" }).debug, false);
  });
});

describe("errorFormatter", () => {
  it("replaces the message of a wrapped plain Error and sends no stack", async () => {
    const { status, error } = await call("plainError");
    assert.equal(status, 500);
    assert.equal(error.message, GENERIC_INTERNAL_MESSAGE);
    assert.equal(error.data.code, "INTERNAL_SERVER_ERROR");
    assert.equal(error.data.stack, undefined);
  });

  it("replaces the message of a wrapped non-Error throw", async () => {
    const { error } = await call("thrownString");
    assert.equal(error.message, GENERIC_INTERNAL_MESSAGE);
  });

  it("keeps deliberate InternalServerError messages", async () => {
    const { error } = await call("deliberate");
    assert.equal(error.message, "Failed to create journal entry.");
  });

  it("keeps a deliberate message that carries a cause", async () => {
    const { error } = await call("deliberateWithCause");
    assert.equal(error.message, "Failed to generate response.");
  });

  it("passes UnauthorizedError through with its code, message and 401", async () => {
    const { status, error } = await call("unauthorized");
    assert.equal(status, 401);
    assert.equal(error.data.code, "UNAUTHORIZED");
    assert.equal(error.data.httpStatus, 401);
    assert.equal(error.message, new UnauthorizedError().message);
  });

  it("passes an UNAUTHORIZED 'Token expired' message through unchanged", async () => {
    const { status, error } = await call("tokenExpired");
    assert.equal(status, 401);
    assert.equal(error.message, "Token expired");
  });

  it("leaves other codes alone", async () => {
    const { status, error } = await call("tooMany");
    assert.equal(status, 429);
    assert.equal(error.message, "slow down");
  });

  it("classifies errors directly", () => {
    assert.equal(
      isWrappedUnexpectedError(
        new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("x") }),
      ),
      true,
    );
    assert.equal(
      isWrappedUnexpectedError(new InternalServerError("deliberate")),
      false,
    );
    assert.equal(
      isWrappedUnexpectedError(
        new TRPCError({ code: "BAD_REQUEST", cause: new Error("x") }),
      ),
      false,
    );
  });
});
