import type { ExpoPushMessage } from "expo-server-sdk";
import type { PendingSchedule } from "../../database/notification/schedule/index.mjs";
import { checkin } from "./checkin.mjs";

export function build(
  schedule: PendingSchedule,
  token: string,
): ExpoPushMessage {
  if (schedule.checkIn) {
    return checkin(schedule, token);
  }

  throw new Error(`No message builder found for schedule: ${schedule.id}`);
}
