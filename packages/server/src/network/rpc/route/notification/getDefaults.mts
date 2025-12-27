import { UserPushNotificationScheduleFrequency } from "../../../../generated/prisma/enums.js";
import { procedure } from "../../router.mjs";

// Build frequencies array from the Prisma enum
const FREQUENCY_LABELS: Record<UserPushNotificationScheduleFrequency, string> =
  {
    [UserPushNotificationScheduleFrequency.DAILY]: "Daily",
    [UserPushNotificationScheduleFrequency.WEEKLY]: "Weekly",
    [UserPushNotificationScheduleFrequency.BIWEEKLY]: "Biweekly",
    [UserPushNotificationScheduleFrequency.MONTHLY]: "Monthly",
  };

const frequencies = Object.values(UserPushNotificationScheduleFrequency).map(
  (value) => ({
    value,
    label: FREQUENCY_LABELS[value],
  }),
);

// Default notification settings
const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  frequency: UserPushNotificationScheduleFrequency.DAILY,
  minuteOfDay: 480, // 8:00 AM (8 * 60 = 480 minutes from midnight)
};

export const getDefaults = procedure.query(() => {
  return {
    defaults: DEFAULT_NOTIFICATION_SETTINGS,
    frequencies,
  };
});
