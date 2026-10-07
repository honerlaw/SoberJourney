import { useState, useEffect } from "react"
import {
  computeDurationSections,
  type DurationSection,
} from "./computeDurationSections"

export type { DurationSection }

export type UseDurationSectionsOptions = {
  /** The start date to calculate duration from */
  startDate: Date | string
  /** Update interval in milliseconds. Defaults to 1000ms */
  updateInterval?: number
}

export type UseDurationSectionsResult = {
  sections: DurationSection[]
  now: Date
}

export function useDurationSections({
  startDate,
  updateInterval = 1000,
}: UseDurationSectionsOptions): UseDurationSectionsResult {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, updateInterval)

    return () => clearInterval(interval)
  }, [updateInterval])

  const startDateObj =
    typeof startDate === "string" ? new Date(startDate) : startDate
  const sections = computeDurationSections(startDateObj, now)

  return { sections, now }
}
