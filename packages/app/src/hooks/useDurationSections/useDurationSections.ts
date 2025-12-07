import { useState, useEffect } from "react";
import {
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInSeconds,
  differenceInYears,
  addYears,
} from "date-fns";

export type DurationSection = {
  value: number;
  max: number;
  label: string;
  singularLabel: string;
};

export type UseDurationSectionsOptions = {
  /** The start date to calculate duration from */
  startDate: Date | string;
  /** Update interval in milliseconds. Defaults to 1000ms */
  updateInterval?: number;
};

export type UseDurationSectionsResult = {
  sections: DurationSection[];
  now: Date;
};

export function useDurationSections({
  startDate,
  updateInterval = 1000,
}: UseDurationSectionsOptions): UseDurationSectionsResult {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  const startDateObj = typeof startDate === "string" ? new Date(startDate) : startDate;
  const totalMinutes = differenceInMinutes(now, startDateObj);
  const totalSeconds = differenceInSeconds(now, startDateObj);
  const years = differenceInYears(now, startDateObj);
  const afterYears = addYears(startDateObj, years);
  const days = differenceInDays(now, afterYears);
  const hours = differenceInHours(now, startDateObj) % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  const sections: DurationSection[] = [
    { value: years, max: 10, label: "years", singularLabel: "year" },
    { value: days, max: 365, label: "days", singularLabel: "day" },
    { value: hours, max: 24, label: "hours", singularLabel: "hour" },
    { value: minutes, max: 60, label: "minutes", singularLabel: "minute" },
    { value: seconds, max: 60, label: "seconds", singularLabel: "second" },
  ];

  return { sections, now };
}

