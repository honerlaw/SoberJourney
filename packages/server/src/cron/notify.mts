import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import type { Context } from "../context.mjs";
import { PushNotificationStatus } from "../util/database.mjs";
import { CHUNK_SEND_FAILED_ERROR } from "../datasource/expo/notify.mjs";
import { build } from "./messages/index.mjs";
import { handleError } from "./handlerError.mjs";

export type NotifyOptions = {
  // the run's start time; stamped on every record written by this run
  now?: Date;
  // throws if the cron lock is no longer held; checked before sending
  assertLockHeld?: () => Promise<void>;
};

type OutgoingMessage = {
  scheduleId: string;
  pushTokenId: string;
  message: ExpoPushMessage;
};

export async function notify(
  ctx: Context,
  options: NotifyOptions = {},
): Promise<void> {
  const now = options.now ?? new Date();

  ctx.logger.info(
    { tags: ["cron", "notify"] },
    "Starting notification send flow",
  );

  const pendingSchedules =
    await ctx.database.notification.schedule.listPending(now);

  const messages: OutgoingMessage[] = [];
  const revokedTokenIds = new Set<string>();

  for (const schedule of pendingSchedules) {
    for (const token of schedule.user.pushTokens) {
      if (token.revoked || revokedTokenIds.has(token.id)) {
        continue;
      }

      if (!Expo.isExpoPushToken(token.token)) {
        revokedTokenIds.add(token.id);
        const revoked = await ctx.database.notification.pushToken.revoke(
          token.id,
        );
        ctx.logger.warn(
          {
            attributes: {
              pushTokenId: token.id,
              scheduleId: schedule.id,
              revoked: revoked !== null,
            },
            tags: ["cron", "notify"],
          },
          "Skipping invalid expo push token",
        );
        continue;
      }

      try {
        messages.push({
          scheduleId: schedule.id,
          pushTokenId: token.id,
          message: build(schedule, token.token),
        });
      } catch (error) {
        ctx.logger.error(
          {
            error,
            attributes: { scheduleId: schedule.id },
            tags: ["cron", "notify"],
          },
          "Failed to build notification message, skipping schedule",
        );
        break;
      }
    }
  }

  if (messages.length === 0) {
    return;
  }

  if (options.assertLockHeld) {
    try {
      await options.assertLockHeld();
    } catch (error) {
      ctx.logger.error(
        { error, tags: ["cron", "notify"] },
        "Cron lock no longer held, aborting send",
      );
      return;
    }
  }

  // results are aligned with messages by index
  const results = await ctx.datasource.expo.notify(
    messages.map((m) => m.message),
  );

  for (const [index, outgoing] of messages.entries()) {
    const result = results[index];
    const ticket = result?.ticket;

    if (!ticket) {
      ctx.logger.error(
        {
          attributes: {
            scheduleId: outgoing.scheduleId,
            pushTokenId: outgoing.pushTokenId,
            error: result?.error,
          },
          tags: ["cron", "notify"],
        },
        "No ticket for notification",
      );
      await ctx.database.notification.create(
        outgoing.pushTokenId,
        outgoing.scheduleId,
        null,
        PushNotificationStatus.ERROR,
        result?.error ?? CHUNK_SEND_FAILED_ERROR,
        now,
      );
      continue;
    }

    if (ticket.status === "error") {
      // a ticket error has no receipt: record it as a failed attempt so the
      // schedule is retried with backoff instead of on every run
      await ctx.database.notification.create(
        outgoing.pushTokenId,
        outgoing.scheduleId,
        null,
        PushNotificationStatus.ERROR,
        ticket.details?.error ?? ticket.message,
        now,
      );
      await handleError(
        ctx,
        outgoing.scheduleId,
        outgoing.pushTokenId,
        ticket,
        null,
      );
      continue;
    }

    ctx.logger.info(
      {
        attributes: {
          scheduleId: outgoing.scheduleId,
          pushTokenId: outgoing.pushTokenId,
          ticketId: ticket.id,
        },
        tags: ["cron", "notify"],
      },
      "Notification processed",
    );

    await ctx.database.notification.create(
      outgoing.pushTokenId,
      outgoing.scheduleId,
      ticket.id,
      PushNotificationStatus.PENDING,
      null,
      now,
    );
  }
}
