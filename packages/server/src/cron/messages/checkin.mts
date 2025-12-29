import type { ExpoPushMessage } from "expo-server-sdk";
import type { PendingSchedule } from "../../database/notification/schedule/index.mjs";

export function checkin(
  schedule: PendingSchedule,
  token: string,
): ExpoPushMessage {
  if (!schedule.checkIn) {
    throw new Error("Schedule does not have a check-in");
  }

  return {
    to: token,
    sound: "default",
    title: "Time to check in! 📊",
    body: `How are you doing on your journey today?`,
    data: {
      url: `/(auth)/checkin-new?journeyId=${schedule.checkIn.journey.id}`,
    },
  };
}
