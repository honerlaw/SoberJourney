import type { JourneyWithCheckIns } from "./types.mjs";
import { formatDuration } from "./formatDuration.mjs";
import { formatCheckInAge } from "./formatCheckInAge.mjs";
import { formatMood } from "./formatMood.mjs";
import { formatUrge } from "./formatUrge.mjs";

export function buildJourneyContext(
  journeysWithCheckIns: JourneyWithCheckIns[],
): string {
  if (journeysWithCheckIns.length === 0) {
    return "";
  }

  const journeyDescriptions = journeysWithCheckIns.map(
    ({ journey, recentCheckIns }) => {
      // The most recent entry represents the current streak start date
      const latestEntry = journey.entries[0];
      const duration = latestEntry
        ? formatDuration(latestEntry.createdAt)
        : "just started";

      let description = `- ${journey.title}: ${duration}`;

      // Add recent check-in context if available
      if (recentCheckIns.length > 0) {
        const latestCheckIn = recentCheckIns[0];
        if (latestCheckIn) {
          const age = formatCheckInAge(latestCheckIn.createdAt);
          const mood = formatMood(latestCheckIn.mood);
          const urge = formatUrge(latestCheckIn.urge);
          description += `\n  Recent check-in (${age}): mood is ${mood}, urge level is ${urge}`;

          // If there are multiple recent check-ins, show a brief trend
          if (recentCheckIns.length >= 2) {
            const moods = recentCheckIns
              .slice(0, 3)
              .map((c) => formatMood(c.mood));
            const urges = recentCheckIns.slice(0, 3).map((c) => c.urge);
            const avgUrge = urges.reduce((a, b) => a + b, 0) / urges.length;
            description += `\n  Recent pattern: moods have been ${moods.join(" → ")}, avg urge level ${formatUrge(avgUrge)}`;
          }
        }
      }

      return description;
    },
  );

  return `

User's Current Sobriety Journeys:
${journeyDescriptions.join("\n")}

Use this information to provide personalized support. Acknowledge their progress when appropriate, and be mindful of which specific journeys they're working on. Pay attention to their recent check-in data - if they've reported high urges or negative moods recently, be especially supportive and proactive in offering coping strategies.`;
}
