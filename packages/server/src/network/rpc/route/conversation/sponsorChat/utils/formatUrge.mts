/**
 * Describes an urge level on the check-in scale of 1 (non-existent) to
 * 10 (critical). Fractional values (averages) are supported.
 */
export function formatUrge(urge: number): string {
  let label: string;
  if (urge < 2) label = "none";
  else if (urge < 4) label = "mild";
  else if (urge < 6) label = "moderate";
  else if (urge < 8) label = "strong";
  else if (urge < 10) label = "intense";
  else label = "critical";

  const rounded = Math.round(urge * 10) / 10;
  return `${label} (${rounded}/10)`;
}
