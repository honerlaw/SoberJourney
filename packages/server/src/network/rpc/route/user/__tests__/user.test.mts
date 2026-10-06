import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { router } from "../../../router.mjs";
import { remove } from "../remove.mjs";
import { addPushToken } from "../addPushToken.mjs";
import { revokePushToken } from "../revokePushToken.mjs";
import { mockLogger } from "../../../../../util/__mocks__/logger.mjs";
import type { Context } from "../../../../../context.mjs";

const appRouter = router({ remove, addPushToken, revokePushToken });
const createdAt = new Date("2024-01-01T00:00:00Z");
const user = { id: "user-1", authId: "auth-1", createdAt };

function harness(overrides: {
  deleteUser?: () => Promise<unknown>;
  upsertToken?: () => Promise<unknown>;
  revoke?: () => Promise<number | null>;
  authed?: boolean;
}) {
  const { logger, mocked: loggerMock } = mockLogger();
  const deleteUser = mock.fn(overrides.deleteUser ?? (async () => ({})));
  const removeUser = mock.fn(async () => user);
  const upsertToken = mock.fn(
    overrides.upsertToken ?? (async () => ({ id: "t", revoked: false })),
  );
  const reactivate = mock.fn(async () => 1);
  const revoke = mock.fn(overrides.revoke ?? (async () => 1));
  const ctx = {
    logger,
    auth: { user: overrides.authed === false ? null : user },
    datasource: { clerk: { client: { users: { deleteUser } } } },
    database: {
      user: {
        remove: removeUser,
        reactivatePushToken: reactivate,
        revokePushToken: revoke,
      },
      notification: { pushToken: { upsert: upsertToken } },
    },
  } as unknown as Context;
  return {
    caller: appRouter.createCaller(ctx),
    deleteUser,
    removeUser,
    upsertToken,
    reactivate,
    revoke,
    loggerMock,
  };
}

const expectedRemoveResponse = {
  success: true,
  user: { id: "user-1", createdAt },
};

describe("user.remove", () => {
  it("deletes the user data and the Clerk user", async () => {
    const h = harness({});
    assert.deepEqual(await h.caller.remove(), expectedRemoveResponse);
    assert.deepEqual(h.removeUser.mock.calls[0]?.arguments, ["user-1"]);
    assert.deepEqual(h.deleteUser.mock.calls[0]?.arguments, ["auth-1"]);
  });

  it("keeps the response shape when Clerk fails", async () => {
    const h = harness({
      deleteUser: async () => {
        throw Object.assign(new Error("boom"), { status: 500 });
      },
    });
    assert.deepEqual(await h.caller.remove(), expectedRemoveResponse);
    assert.equal(h.loggerMock.error.mock.callCount(), 1);
  });

  it("treats an already deleted Clerk user as success", async () => {
    const h = harness({
      deleteUser: async () => {
        throw Object.assign(new Error("not found"), { status: 404 });
      },
    });
    assert.deepEqual(await h.caller.remove(), expectedRemoveResponse);
    assert.equal(h.loggerMock.error.mock.callCount(), 0);
    assert.equal(h.loggerMock.info.mock.callCount(), 1);
  });

  it("is still unauthorized without a user", async () => {
    const h = harness({ authed: false });
    await assert.rejects(() => h.caller.remove());
    assert.equal(h.removeUser.mock.callCount(), 0);
    assert.equal(h.deleteUser.mock.callCount(), 0);
  });
});

describe("user.revokePushToken", () => {
  it("revokes the caller's token", async () => {
    const h = harness({});
    assert.deepEqual(await h.caller.revokePushToken({ token: "tok" }), {
      success: true,
      revoked: 1,
    });
    assert.deepEqual(h.revoke.mock.calls[0]?.arguments, ["user-1", "tok"]);
  });

  it("is idempotent for unknown tokens", async () => {
    const h = harness({ revoke: async () => 0 });
    assert.deepEqual(await h.caller.revokePushToken({ token: "nope" }), {
      success: true,
      revoked: 0,
    });
  });

  it("rejects oversized tokens", async () => {
    const h = harness({});
    await assert.rejects(() =>
      h.caller.revokePushToken({ token: "x".repeat(5000) }),
    );
  });
});

describe("user.addPushToken", () => {
  it("does not touch an active token", async () => {
    const h = harness({});
    assert.deepEqual(await h.caller.addPushToken({ token: "tok" }), {
      success: true,
    });
    assert.equal(h.reactivate.mock.callCount(), 0);
  });

  it("re-activates a revoked token (sign out or delivery error)", async () => {
    const h = harness({
      upsertToken: async () => ({ id: "t", revoked: true }),
    });
    assert.deepEqual(await h.caller.addPushToken({ token: "tok" }), {
      success: true,
    });
    assert.deepEqual(h.reactivate.mock.calls[0]?.arguments, ["user-1", "tok"]);
  });
});
