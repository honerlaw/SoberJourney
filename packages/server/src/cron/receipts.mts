import type { Context } from "../context.mjs";
import { PushNotificationStatus } from "../util/database.mjs";
import { handleError } from "./handlerError.mjs";

// expo keeps receipts for roughly a day; older pending receipts never resolve
const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

export async function receipts(
  ctx: Context,
  now: Date = new Date(),
): Promise<void> {
  const expired = await ctx.database.notification.expireStalePending(
    new Date(now.getTime() - RECEIPT_TTL_MS),
  );
  if (expired > 0) {
    ctx.logger.warn(
      { attributes: { expired }, tags: ["cron", "receipts"] },
      "Expired stale pending notifications",
    );
  }

  const notifications =
    await ctx.database.notification.listPendingWithReceipt();
  const byReceiptId = new Map(
    notifications
      .filter((n) => n.receiptId !== null)
      .map((n) => [n.receiptId as string, n]),
  );
  const receipts = await ctx.datasource.expo.getReceipts([
    ...byReceiptId.keys(),
  ]);

  for (const [receiptId, receipt] of Object.entries(receipts)) {
    const notification = byReceiptId.get(receiptId);
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
      ctx.logger.info(
        {
          attributes: { receiptId },
          tags: ["cron", "receipts"],
        },
        "Notification completed",
      );
      await ctx.database.notification.update(
        notification.pushTokenId,
        notification.scheduleId,
        receiptId,
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
      receiptId,
    );
  }
}
