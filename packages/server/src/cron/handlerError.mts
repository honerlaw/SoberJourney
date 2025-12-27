import type { Context } from "../context.mjs";
import type { PendingSchedule } from "../database/notification/schedule/index.mjs";
import type { NotificationResult } from "../datasource/expo/index.mjs";
import { PushNotificationStatus } from "../util/database.mjs";

export async function handleError(
  ctx: Context,
  schedule: PendingSchedule,
  pushToken: {
    id: string;
    token: string;
    revoked: boolean;
  },
  notification: NotificationResult,
) {
  if (
    !notification.ticket ||
    notification.ticket.status !== "error" ||
    !notification.ticket.details
  ) {
    return;
  }

  // in general, go ahead and create a new notification record that it errored for the
  // given token
  await ctx.database.notification.create(
    schedule.id,
    pushToken.id,
    null,
    PushNotificationStatus.ERROR,
    notification.ticket.details.error ?? null,
  );

  switch (notification.ticket.details.error) {
    case "DeviceNotRegistered":
      await ctx.database.notification.pushToken.revoke(pushToken.id);
      break;
    default:
      ctx.logger.error(
        {
          attributes: {
            token: notification.message.to,
            error: notification.ticket.details.error,
            message: notification.ticket.message,
          },
          tags: ["cron", "notify", "handleError"],
        },
        "Unknown error type",
        notification.ticket.details.error,
      );
      break;
  }
}
