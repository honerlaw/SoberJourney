import type {
  ExpoPushErrorReceipt,
  ExpoPushErrorTicket,
} from "expo-server-sdk";
import type { Context } from "../context.mjs";
import { PushNotificationStatus } from "../util/database.mjs";

type ExpoPushError = ExpoPushErrorReceipt | ExpoPushErrorTicket;

export async function handleError(
  ctx: Context,
  scheduleId: string,
  pushTokenId: string,
  error: ExpoPushError,
) {
  if (error.status !== "error" || !error.details) {
    return;
  }

  // in general, go ahead and upsert a notification record that it errored for the
  // given token
  await ctx.database.notification.upsert(
    pushTokenId,
    scheduleId,
    null,
    PushNotificationStatus.ERROR,
    error.details.error ?? null,
  );

  switch (error.details.error) {
    case "DeviceNotRegistered":
      await ctx.database.notification.pushToken.revoke(pushTokenId);
      break;
    default:
      ctx.logger.error(
        {
          attributes: {
            scheduleId,
            pushTokenId,
            error: error.details.error,
          },
          tags: ["cron", "notify", "handleError"],
        },
        "Unknown error type",
      );
      break;
  }
}
