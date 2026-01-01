export function formatUrge(urge: number): string {
  if (urge <= 1) return "none";
  if (urge <= 2) return "mild";
  if (urge <= 3) return "moderate";
  if (urge <= 4) return "strong";
  return "intense";
}
