import React from "react"
import { Card, Text, XStack, YStack, Separator } from "tamagui"
import { format } from "date-fns"
import { Frown, Meh, Smile, SmilePlus, Moon } from "@tamagui/lucide-icons"
import type { CheckInEntry } from "../types"

type CheckInsCardProps = {
  entries: CheckInEntry[]
}

// Map mood values to icon components and labels
const MOOD_CONFIG: Record<
  string,
  {
    icon: React.FC<React.ComponentProps<typeof Frown>>
    label: string
    color: string
  }
> = {
  SAD: { icon: Frown, label: "Sad", color: "$blue10" },
  TIRED: { icon: Moon, label: "Tired", color: "$purple10" },
  NEUTRAL: { icon: Meh, label: "Neutral", color: "$gray10" },
  GOOD: { icon: Smile, label: "Good", color: "$green10" },
  GREAT: { icon: SmilePlus, label: "Great", color: "$green11" },
}

const getUrgeLabel = (urge: number): string => {
  if (urge <= 2) return "Very Low"
  if (urge <= 4) return "Low"
  if (urge <= 6) return "Moderate"
  if (urge <= 8) return "High"
  return "Very High"
}

export const CheckInsCard: React.FC<CheckInsCardProps> = ({ entries }) => {
  return (
    <Card
      elevate
      bordered
      borderRadius="$4"
      backgroundColor="$background"
      padding="$4"
    >
      <YStack gap="$4">
        <XStack alignItems="center" gap="$2">
          <Text fontSize="$5" fontWeight="600" color="$color12">
            Check-ins
          </Text>
        </XStack>

        {entries.length === 0 ? (
          <YStack
            paddingVertical="$6"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="$4" color="$color11" textAlign="center">
              No check-ins yet. Start tracking your mood! 📊
            </Text>
          </YStack>
        ) : (
          <YStack gap="$3">
            {entries.map((entry: CheckInEntry, index: number) => {
              const moodConfig = MOOD_CONFIG[entry.mood] || MOOD_CONFIG.NEUTRAL
              const MoodIcon = moodConfig.icon
              const entryDate = new Date(entry.createdAt)

              return (
                <YStack key={entry.id} gap="$2">
                  {index > 0 && <Separator />}
                  <XStack
                    justifyContent="space-between"
                    alignItems="flex-start"
                    paddingTop={index > 0 ? "$2" : 0}
                  >
                    <YStack gap="$1" flex={1}>
                      <XStack alignItems="center" gap="$2">
                        <MoodIcon size={20} color={moodConfig.color} />
                        <Text fontSize="$4" color="$color12" fontWeight="500">
                          {moodConfig.label}
                        </Text>
                      </XStack>
                      <Text fontSize="$3" color="$color11">
                        {format(entryDate, "EEEE, MMM d, yyyy")}
                      </Text>
                      <Text fontSize="$2" color="$color10">
                        {format(entryDate, "h:mm a")}
                      </Text>
                    </YStack>
                    <YStack alignItems="flex-end" gap="$1">
                      <Text fontSize="$3" color="$color11">
                        Urge Level
                      </Text>
                      <Text fontSize="$4" fontWeight="500" color="$color12">
                        {entry.urge}/10
                      </Text>
                      <Text fontSize="$2" color="$color10">
                        {getUrgeLabel(entry.urge)}
                      </Text>
                    </YStack>
                  </XStack>
                </YStack>
              )
            })}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}
