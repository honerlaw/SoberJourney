// Convert minuteOfDay to Date for DateTimePicker
export function minuteOfDayToDate(minuteOfDay: number): Date {
  const date = new Date()
  date.setHours(Math.floor(minuteOfDay / 60))
  date.setMinutes(minuteOfDay % 60)
  date.setSeconds(0)
  date.setMilliseconds(0)
  return date
}
