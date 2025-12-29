import { type Context } from "../context.mjs";
import { PushNotificationStatus } from "../util/database.mjs";
import { build } from "./messages/index.mjs";
import { handleError } from "./handlerError.mjs";

export async function notify(ctx: Context): Promise<void> {
  ctx.logger.info(
    { tags: ["cron", "notify"] },
    "Starting notification send flow",
  );

  const pendingSchedules =
    await ctx.database.notification.schedule.listPending();

  const messages = pendingSchedules
    .map((schedule) => {
      return schedule.user.pushTokens.map((token) => {
        return {
          schedule,
          pushTokenId: token.id,
          token: token.token,
          message: build(schedule, token.token),
        };
      });
    })
    .flat();

  // send out all of the notifications at once essentially (well push to expo and they chunk it)
  const notifications = await ctx.datasource.expo.notify(
    messages.map((m) => m.message),
  );

  // something went pretty bad, should be logged in the notify function
  if (!notifications) {
    return;
  }

  for (const notification of notifications) {
    if (!notification.ticket) {
      ctx.logger.error(
        {
          attributes: { notificationId: notification.message.to },
          tags: ["cron", "notify", "processResults"],
        },
        "No ticket found for notification",
      );
      continue;
    }

    const originalMessage = messages.find(
      (m) => m.message.to === notification.message.to,
    );
    if (!originalMessage) {
      ctx.logger.error(
        {
          attributes: { notificationId: notification.message.to },
          tags: ["cron", "notify", "processResults"],
        },
        "No original message found for notification",
      );
      continue;
    }

    const pushToken = originalMessage.schedule.user.pushTokens.find(
      (token) => token.token === notification.message.to,
    );
    if (!pushToken) {
      ctx.logger.error(
        {
          attributes: { notificationId: notification.message.to },
          tags: ["cron", "notify", "processResults"],
        },
        "No push token found for notification",
      );
      continue;
    }

    if (notification.ticket.status === "error") {
      await handleError(
        ctx,
        originalMessage.schedule.id,
        pushToken.id,
        notification.ticket,
      );
      // @todo handle the error case here
      // this might be also updating the notification or creating it
      // with more details or revoking / etc
      continue;
    }

    // only store success to read later, errors are handled here
    await ctx.database.notification.upsert(
      pushToken.id,
      originalMessage.schedule.id,
      notification.ticket.id,
      PushNotificationStatus.PENDING,
      null,
    );
  }
}
