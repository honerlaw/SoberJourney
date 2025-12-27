// Format minuteOfDay to readable time string
export function formatTime(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60)
  const minutes = minuteOfDay % 60
  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
}
