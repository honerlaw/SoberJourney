// Convert Date to minuteOfDay, rounding to 15 minute increments
export function dateToMinuteOfDay(date: Date): number {
  const hours = date.getHours()
  const minutes = Math.round(date.getMinutes() / 15) * 15
  return hours * 60 + (minutes >= 60 ? 0 : minutes)
}
