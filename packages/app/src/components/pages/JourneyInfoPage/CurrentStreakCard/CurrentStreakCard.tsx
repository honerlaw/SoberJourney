import React from "react"
import { Card, Text, XStack, YStack, Separator } from "tamagui"
import { format } from "date-fns"
import { DurationProgressBar } from "@/src/components/DurationProgressBar"
import type { DurationSection } from "../types"

type CurrentStreakCardProps = {
  sections: DurationSection[]
  startDate: Date
  currentStreakDate: Date
  resetCount: number
}

export const CurrentStreakCard: React.FC<CurrentStreakCardProps> = ({
  sections,
  startDate,
  currentStreakDate,
  resetCount,
}) => {
  return (
    <Card
      elevate
      bordered
      borderRadius="$4"
      backgroundColor="$background"
      padding="$4"
    >
      <YStack gap="$4">
        <Text fontSize="$5" fontWeight="600" color="$color12">
          Current Streak
        </Text>

        <YStack gap="$3">
          {sections.map(({ value, max, label, singularLabel }) => {
            if (value === 0 && label !== "seconds") {
              return null
            }
            return (
              <DurationProgressBar
                key={label}
                value={value}
                max={max}
                label={label}
                singularLabel={singularLabel}
              />
            )
          })}
        </YStack>

        <Separator />

        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <Text fontSize="$3" color="$color11">
              Started on
            </Text>
            <Text fontSize="$3" color="$color12">
              {format(startDate, "MMM d, yyyy 'at' h:mm a")}
            </Text>
          </XStack>
          <XStack justifyContent="space-between">
            <Text fontSize="$3" color="$color11">
              Current streak since
            </Text>
            <Text fontSize="$3" color="$color12">
              {format(currentStreakDate, "MMM d, yyyy 'at' h:mm a")}
            </Text>
          </XStack>
          <XStack justifyContent="space-between">
            <Text fontSize="$3" color="$color11">
              Total resets
            </Text>
            <Text fontSize="$3" color="$color12">
              {resetCount}
            </Text>
          </XStack>
        </YStack>
      </YStack>
    </Card>
  )
}
