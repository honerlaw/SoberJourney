import type { Expo, ExpoPushReceiptId, ExpoPushReceipt } from "expo-server-sdk";
import type { Logger } from "../../util/logger/logger.mjs";

export async function getReceipts(
  logger: Logger,
  client: Expo,
  ticketIds: ExpoPushReceiptId[],
): Promise<Record<ExpoPushReceiptId, ExpoPushReceipt>> {
  if (ticketIds.length === 0) {
    return {};
  }

  const chunks = client.chunkPushNotificationReceiptIds(ticketIds);
  const receipts: Record<ExpoPushReceiptId, ExpoPushReceipt> = {};

  try {
    for (const chunk of chunks) {
      const receiptChunk = await client.getPushNotificationReceiptsAsync(chunk);
      Object.assign(receipts, receiptChunk);
    }

    return receipts;
  } catch (error) {
    logger.error(
      { error, tags: ["datasource", "expo", "getReceipts"] },
      "Error getting receipts",
    );
    return {};
  }
}
