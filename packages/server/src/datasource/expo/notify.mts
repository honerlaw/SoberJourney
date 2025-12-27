import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from "expo-server-sdk";
import type { Logger } from "../../util/logger/logger.mjs";

export type NotificationResult = {
  message: ExpoPushMessage;
  ticket: ExpoPushTicket | undefined;
};

export async function notify(
  logger: Logger,
  client: Expo,
  messages: ExpoPushMessage[],
): Promise<NotificationResult[] | null> {
  const validMessages = messages.filter((message) => {
    const token = Array.isArray(message.to) ? message.to[0] : message.to;
    if (!Expo.isExpoPushToken(token)) {
      console.error(`Push token ${token} is not a valid Expo push token`);
      return false;
    }
    return true;
  });

  if (validMessages.length === 0) {
    return null;
  }

  const chunks = client.chunkPushNotifications(validMessages);
  try {
    // @todo should we do this sequentially to not overwhelm the expo servers?
    return (
      await Promise.all(
        chunks.map(async (chunk) => {
          const tickets = await client.sendPushNotificationsAsync(chunk);
          return chunk.map((message, index) => {
            return {
              message,
              ticket: tickets[index],
            };
          });
        }),
      )
    ).flat();
  } catch (error) {
    logger.error(
      { error, tags: ["datasource", "expo", "notify"] },
      "Error sending notifications",
    );
    return null;
  }
}
