import type { Expo, ExpoPushReceiptId, ExpoPushReceipt } from "expo-server-sdk";
import type { Logger } from "../../util/logger/logger.mjs";

/**
 * Fetch receipts for the given ids. Each chunk is fetched independently: a
 * failed chunk is logged and skipped (its receipts stay pending and are
 * retried on the next run), the receipts from other chunks are returned.
 */
export async function getReceipts(
  logger: Logger,
  client: Expo,
  receiptIds: ExpoPushReceiptId[],
): Promise<Record<ExpoPushReceiptId, ExpoPushReceipt>> {
  if (receiptIds.length === 0) {
    return {};
  }

  const chunks = client.chunkPushNotificationReceiptIds(receiptIds);
  const receipts: Record<ExpoPushReceiptId, ExpoPushReceipt> = {};

  for (const chunk of chunks) {
    try {
      const receiptChunk = await client.getPushNotificationReceiptsAsync(chunk);
      Object.assign(receipts, receiptChunk);
    } catch (error) {
      logger.error(
        {
          error,
          attributes: { chunkSize: chunk.length },
          tags: ["datasource", "expo", "getReceipts"],
        },
        "Error getting receipts chunk",
      );
    }
  }

  return receipts;
}
