import { procedure } from "../../router.mjs";
import { CheckInMood } from "../../../../generated/prisma/enums.js";

/**
 * Returns the available mood options for check-ins.
 * Each mood includes an id, label, and icon name for frontend rendering.
 */
export const getMoods = procedure.query(() => {
  const moods = [
    { id: CheckInMood.SAD, label: "Sad", icon: "Frown" },
    { id: CheckInMood.TIRED, label: "Tired", icon: "Moon" },
    { id: CheckInMood.NEUTRAL, label: "Neutral", icon: "Meh" },
    { id: CheckInMood.GOOD, label: "Good", icon: "Smile" },
    { id: CheckInMood.GREAT, label: "Great", icon: "SmilePlus" },
  ];

  return { moods };
});
