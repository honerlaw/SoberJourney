import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from "expo-server-sdk";
import type { Logger } from "../../util/logger/logger.mjs";

export const INVALID_TOKEN_ERROR = "InvalidToken";
export const CHUNK_SEND_FAILED_ERROR = "ChunkSendFailed";

export type NotificationResult = {
  message: ExpoPushMessage;
  // the ticket returned by expo, undefined if the message was not sent
  ticket: ExpoPushTicket | undefined;
  // why there is no ticket (invalid token, or the chunk request failed)
  error?: string;
};

/**
 * Send push notifications to expo.
 *
 * The result is aligned 1:1 with `messages` (same length, same order), so
 * callers map results back to their messages by index. Each message must have
 * a single `to` token. Chunks are sent independently: a failed chunk only
 * marks its own messages as failed, accepted chunks keep their tickets.
 */
export async function notify(
  logger: Logger,
  client: Expo,
  messages: ExpoPushMessage[],
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = messages.map((message) => ({
    message,
    ticket: undefined,
  }));

  const validIndexes: number[] = [];
  messages.forEach((message, index) => {
    const token = Array.isArray(message.to) ? message.to[0] : message.to;
    if (Array.isArray(message.to) && message.to.length !== 1) {
      results[index]!.error = INVALID_TOKEN_ERROR;
      return;
    }
    if (!Expo.isExpoPushToken(token)) {
      results[index]!.error = INVALID_TOKEN_ERROR;
      return;
    }
    validIndexes.push(index);
  });

  const chunks: number[][] = [];
  for (
    let i = 0;
    i < validIndexes.length;
    i += Expo.pushNotificationChunkSizeLimit
  ) {
    chunks.push(validIndexes.slice(i, i + Expo.pushNotificationChunkSizeLimit));
  }

  const settled = await Promise.allSettled(
    chunks.map((chunk) =>
      client.sendPushNotificationsAsync(chunk.map((index) => messages[index]!)),
    ),
  );

  settled.forEach((outcome, chunkIndex) => {
    const chunk = chunks[chunkIndex]!;
    if (outcome.status === "rejected") {
      logger.error(
        {
          error: outcome.reason,
          attributes: { chunkIndex, chunkSize: chunk.length },
          tags: ["datasource", "expo", "notify"],
        },
        "Error sending notification chunk",
      );
      for (const index of chunk) {
        results[index]!.error = CHUNK_SEND_FAILED_ERROR;
      }
      return;
    }

    chunk.forEach((index, position) => {
      const ticket = outcome.value[position];
      results[index]!.ticket = ticket;
      if (!ticket) {
        results[index]!.error = CHUNK_SEND_FAILED_ERROR;
      }
    });
  });

  return results;
}
