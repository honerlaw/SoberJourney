import { CheckInMood } from "../../../../../util/database.mjs";

export function formatMood(mood: CheckInMood): string {
  switch (mood) {
    case CheckInMood.SAD:
      return "sad";
    case CheckInMood.TIRED:
      return "tired";
    case CheckInMood.NEUTRAL:
      return "neutral";
    case CheckInMood.GOOD:
      return "good";
    case CheckInMood.GREAT:
      return "great";
    default:
      return "unknown";
  }
}
