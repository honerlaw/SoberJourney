import React, { useState, useMemo } from "react"
import { XStack, YStack, Text, Button, View } from "tamagui"
import { ChevronLeft, ChevronRight } from "@tamagui/lucide-icons"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns"

export type CalendarViewProps = {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  initialMonth?: Date
  /** Map of date strings (YYYY-MM-DD) to entry counts */
  entriesPerDay?: Record<string, number>
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  onDateSelect,
  initialMonth,
  entriesPerDay = {},
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    initialMonth ?? new Date(),
  )

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1))
  }

  const handleDayPress = (date: Date) => {
    onDateSelect?.(date)
  }

  const isSelected = (date: Date) =>
    selectedDate ? isSameDay(date, selectedDate) : false
  const isCurrentMonth = (date: Date) => isSameMonth(date, currentMonth)

  const getEntryCount = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd")
    return entriesPerDay[dateKey] ?? 0
  }

  // Get heatmap color based on entry count (1-7, capped at $color7)
  const getHeatmapColor = (count: number): string | undefined => {
    if (count === 0) return undefined
    const level = Math.min(count, 10) + 2
    return `$color${level}`
  }

  // Split days into weeks for grid layout
  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7))
    }
    return result
  }, [calendarDays])

  return (
    <YStack
      gap="$3"
      padding="$3"
      backgroundColor="$background"
      borderRadius="$4"
    >
      {/* Header with month/year and navigation */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$2"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handlePreviousMonth}
          icon={<ChevronLeft size={20} color="$color11" pointerEvents="none" />}
        />
        <Text fontSize="$6" fontWeight="600" color="$color12">
          {format(currentMonth, "MMMM yyyy")}
        </Text>
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleNextMonth}
          icon={
            <ChevronRight size={20} color="$color11" pointerEvents="none" />
          }
        />
      </XStack>

      {/* Weekday headers */}
      <XStack justifyContent="space-around">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} flex={1} alignItems="center">
            <Text fontSize="$2" fontWeight="500" color="$color10">
              {label}
            </Text>
          </View>
        ))}
      </XStack>

      {/* Calendar grid */}
      <YStack gap="$1">
        {weeks.map((week, weekIndex) => (
          <XStack key={weekIndex} justifyContent="space-around">
            {week.map((day) => {
              const dayIsSelected = isSelected(day)
              const dayIsCurrentMonth = isCurrentMonth(day)
              const entryCount = getEntryCount(day)
              const heatmapColor = getHeatmapColor(entryCount)

              // Heatmap background based on entry count (only for non-selected days)
              const getHeatmapBackground = () => {
                if (dayIsSelected) return undefined // Inverted: use foreground color as background
                if (!dayIsCurrentMonth) return "transparent"
                return heatmapColor ?? "transparent"
              }

              const getTextColor = () => {
                if (dayIsSelected) return undefined // Inverted: use background color as text
                if (!dayIsCurrentMonth) return "$color8"
                return "$color12"
              }

              return (
                <View key={day.toISOString()} flex={1} alignItems="center">
                  <Button
                    size="$3"
                    circular
                    borderRadius={"$4"}
                    borderWidth={0}
                    chromeless={!dayIsSelected && entryCount === 0}
                    backgroundColor={getHeatmapBackground()}
                    onPress={() => handleDayPress(day)}
                    themeInverse={dayIsSelected}
                  >
                    <Text
                      fontSize="$3"
                      fontWeight={
                        dayIsSelected || entryCount > 0 ? "600" : "400"
                      }
                      color={getTextColor()}
                    >
                      {format(day, "d")}
                    </Text>
                  </Button>
                </View>
              )
            })}
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}
