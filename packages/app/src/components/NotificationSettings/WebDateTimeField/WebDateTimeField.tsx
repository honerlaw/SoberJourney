import React from "react"
import { useColorScheme } from "react-native"
import { format } from "date-fns"

export type WebDateTimeFieldProps = {
  mode: "date" | "time"
  /** Current value; the part not edited by this field is preserved */
  value: Date
  onChange: (date: Date) => void
  /** Latest selectable date (date mode only) */
  maximumDate?: Date
  /** Step in minutes (time mode only) */
  minuteInterval?: number
}

/**
 * Web-only fallback for `@react-native-community/datetimepicker`, which has
 * no web implementation (it renders null on web). Renders a DOM
 * `<input type="date|time">` through react-native-web. Values are parsed as
 * LOCAL time (`new Date("yyyy-MM-dd")` would be UTC and shift the day).
 */
export const WebDateTimeField: React.FC<WebDateTimeFieldProps> = ({
  mode,
  value,
  onChange,
  maximumDate,
  minuteInterval,
}) => {
  const colorScheme = useColorScheme()

  const handleChange = (event: { target: { value: string } }) => {
    const raw = event.target.value
    if (!raw) return // cleared input: keep the previous value

    const next = new Date(value)
    if (mode === "date") {
      const [y, m, d] = raw.split("-").map(Number)
      if (!y || !m || !d) return
      next.setFullYear(y, m - 1, d)
    } else {
      const [h, min] = raw.split(":").map(Number)
      if (Number.isNaN(h) || Number.isNaN(min)) return
      next.setHours(h, min, 0, 0)
    }
    if (Number.isNaN(next.getTime())) return
    onChange(next)
  }

  return React.createElement("input", {
    type: mode,
    value: format(value, mode === "date" ? "yyyy-MM-dd" : "HH:mm"),
    max:
      mode === "date" && maximumDate
        ? format(maximumDate, "yyyy-MM-dd")
        : undefined,
    step: mode === "time" && minuteInterval ? minuteInterval * 60 : undefined,
    onChange: handleChange,
    style: {
      width: "100%",
      boxSizing: "border-box",
      marginTop: 8,
      padding: "10px 12px",
      fontSize: 16,
      fontFamily: "inherit",
      borderRadius: 8,
      border: "1px solid rgba(127, 127, 127, 0.4)",
      background: "transparent",
      color: "inherit",
      colorScheme: colorScheme === "dark" ? "dark" : "light",
    },
  })
}
