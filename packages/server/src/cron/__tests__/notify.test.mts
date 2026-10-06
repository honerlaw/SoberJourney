import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { ExpoPushMessage } from "expo-server-sdk";
import { notify } from "../notify.mjs";
import { PushNotificationStatus } from "../../util/database.mjs";
import { createCronContext, schedule, validToken } from "./harness.mjs";

const NOW = new Date("2026-06-10T13:00:00Z");

describe("cron notify", () => {
  it("records a notification for each schedule when two schedules share a token", async () => {
    const shared = validToken("shared");
    const { ctx, database, expo } = createCronContext({
      schedules: [
        schedule("s1", [{ id: "pt-1", token: shared }]),
        schedule("s2", [{ id: "pt-1", token: shared }]),
      ],
    });

    await notify(ctx, { now: NOW });

    assert.equal(expo.notify.mock.callCount(), 1);
    const creates = database.notification.create.mock.calls.map(
      (c) => c.arguments,
    );
    assert.deepEqual(creates, [
      ["pt-1", "s1", "receipt-0", PushNotificationStatus.PENDING, null, NOW],
      ["pt-1", "s2", "receipt-1", PushNotificationStatus.PENDING, null, NOW],
    ]);
  });

  it("keeps the push payload data unchanged", async () => {
    const { ctx, expo } = createCronContext({
      schedules: [schedule("s1", [{ id: "pt-1", token: validToken("a") }])],
    });

    await notify(ctx, { now: NOW });

    const [message] = expo.notify.mock.calls[0]!
      .arguments[0] as ExpoPushMessage[];
    assert.deepEqual(message!.data, {
      url: "/(auth)/checkin-new?journeyId=journey-s1",
    });
  });

  it("skips revoked tokens and revokes invalid tokens", async () => {
    const { ctx, database, expo } = createCronContext({
      schedules: [
        schedule("s1", [
          { id: "pt-revoked", token: validToken("r"), revoked: true },
          { id: "pt-invalid", token: "not-a-token" },
          { id: "pt-ok", token: validToken("ok") },
        ]),
      ],
    });

    await notify(ctx, { now: NOW });

    const sent = (
      expo.notify.mock.calls[0]!.arguments[0] as ExpoPushMessage[]
    ).map((m) => m.to);
    assert.deepEqual(sent, [validToken("ok")]);
    assert.deepEqual(
      database.notification.pushToken.revoke.mock.calls.map(
        (c) => c.arguments[0],
      ),
      ["pt-invalid"],
    );
  });

  it("records ticket errors and failed chunks as failed attempts", async () => {
    const { ctx, database } = createCronContext({
      schedules: [
        schedule("s1", [{ id: "pt-1", token: validToken("a") }]),
        schedule("s2", [{ id: "pt-2", token: validToken("b") }]),
      ],
      tickets: (messages) => [
        {
          message: messages[0]!,
          ticket: {
            status: "error",
            message: "dead",
            details: { error: "DeviceNotRegistered" },
          },
        },
        { message: messages[1]!, ticket: undefined, error: "ChunkSendFailed" },
      ],
    });

    await notify(ctx, { now: NOW });

    assert.deepEqual(
      database.notification.create.mock.calls.map((c) => c.arguments),
      [
        [
          "pt-1",
          "s1",
          null,
          PushNotificationStatus.ERROR,
          "DeviceNotRegistered",
          NOW,
        ],
        [
          "pt-2",
          "s2",
          null,
          PushNotificationStatus.ERROR,
          "ChunkSendFailed",
          NOW,
        ],
      ],
    );
    // DeviceNotRegistered still revokes the token
    assert.deepEqual(
      database.notification.pushToken.revoke.mock.calls.map(
        (c) => c.arguments[0],
      ),
      ["pt-1"],
    );
  });

  it("does not send when the cron lock is no longer held", async () => {
    const { ctx, database, expo } = createCronContext({
      schedules: [schedule("s1", [{ id: "pt-1", token: validToken("a") }])],
    });
    const assertLockHeld = mock.fn(async () => {
      throw new Error("Transaction already closed");
    });

    await notify(ctx, { now: NOW, assertLockHeld });

    assert.equal(assertLockHeld.mock.callCount(), 1);
    assert.equal(expo.notify.mock.callCount(), 0);
    assert.equal(database.notification.create.mock.callCount(), 0);
  });

  it("skips a schedule whose message cannot be built", async () => {
    const broken = {
      ...schedule("broken", [{ id: "pt-1", token: validToken("a") }]),
      checkIn: null,
    };
    const { ctx, expo } = createCronContext({
      schedules: [
        broken,
        schedule("s2", [{ id: "pt-2", token: validToken("b") }]),
      ],
    });

    await notify(ctx, { now: NOW });

    const sent = (
      expo.notify.mock.calls[0]!.arguments[0] as ExpoPushMessage[]
    ).map((m) => m.to);
    assert.deepEqual(sent, [validToken("b")]);
  });

  it("does nothing when nothing is pending", async () => {
    const { ctx, expo } = createCronContext({ schedules: [] });
    await notify(ctx, { now: NOW });
    assert.equal(expo.notify.mock.callCount(), 0);
  });
});
