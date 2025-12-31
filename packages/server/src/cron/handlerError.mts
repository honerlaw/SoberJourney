import type {
  ExpoPushErrorReceipt,
  ExpoPushErrorTicket,
} from "expo-server-sdk";
import type { Context } from "../context.mjs";
import { PushNotificationStatus } from "../util/database.mjs";

type ExpoPushError = ExpoPushErrorReceipt | ExpoPushErrorTicket;

/**
 * Handle errors from push notification sends.
 * @param receiptId - The receipt ID if this is a receipt error (has existing notification record),
 *                    or null if this is a ticket error (no notification record exists yet)
 */
export async function handleError(
  ctx: Context,
  scheduleId: string,
  pushTokenId: string,
  error: ExpoPushError,
  receiptId: string | null,
) {
  if (error.status !== "error" || !error.details) {
    return;
  }

  ctx.logger.error(
    {
      attributes: {
        scheduleId,
        pushTokenId,
        receiptId,
        error: error.details.error,
      },
      tags: ["cron", "handleError"],
    },
    "Error occurred while processing notification",
  );

  // If we have a receiptId, update the existing notification record
  // Otherwise, this is a ticket error and we don't create a record
  // (the notification was never sent successfully, so there's nothing to track)
  if (receiptId) {
    await ctx.database.notification.update(
      pushTokenId,
      scheduleId,
      receiptId,
      PushNotificationStatus.ERROR,
      error.details.error ?? null,
    );
  }

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
          tags: ["cron", "handleError"],
        },
        "Unknown error type",
      );
      break;
  }
}
