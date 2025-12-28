import type { Context } from "../context.mjs";
import { PushNotificationStatus } from "../util/database.mjs";
import { handleError } from "./handlerError.mjs";

export async function receipts(ctx: Context): Promise<void> {
  const notifications =
    await ctx.database.notification.listPendingWithReceipt();
  const receiptIds = notifications
    .map((n) => n.receiptId)
    .filter((id) => id !== null);
  const receipts = await ctx.datasource.expo.getReceipts(receiptIds);
  const entries = Object.entries(receipts);

  for (const [receiptId, receipt] of entries) {
    const notification = notifications.find((n) => n.receiptId === receiptId);
    if (!notification) {
      ctx.logger.error(
        {
          attributes: { receiptId },
          tags: ["cron", "receipts"],
        },
        "No notification found for receipt",
      );
      continue;
    }

    // mark complete, if the status is ok
    if (receipt.status === "ok") {
      await ctx.database.notification.upsert(
        notification.pushTokenId,
        notification.scheduleId,
        null,
        PushNotificationStatus.COMPLETE,
        null,
      );
      continue;
    }

    await handleError(
      ctx,
      notification.scheduleId,
      notification.pushTokenId,
      receipt,
    );
  }
}
