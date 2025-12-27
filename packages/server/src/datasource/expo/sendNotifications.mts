import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from "expo-server-sdk";
import type { Logger } from "../../util/logger/logger.mjs";

export async function sendNotifications(
  logger: Logger,
  client: Expo,
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  const validMessages = messages.filter((message) => {
    const token = Array.isArray(message.to) ? message.to[0] : message.to;
    if (!Expo.isExpoPushToken(token)) {
      console.error(`Push token ${token} is not a valid Expo push token`);
      return false;
    }
    return true;
  });

  if (validMessages.length === 0) {
    return [];
  }

  const chunks = client.chunkPushNotifications(validMessages);
  const tickets: ExpoPushTicket[] = [];

  try {
    for (const chunk of chunks) {
      const ticketChunk = await client.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    return tickets;
  } catch (error) {
    logger.error(
      { error, tags: ["datasource", "expo", "sendNotifications"] },
      "Error sending notifications",
    );
    return [];
  }
}
