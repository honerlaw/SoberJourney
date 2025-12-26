import React from "react"
import { Pressable } from "react-native-gesture-handler"
import { Card, Text, XStack, YStack, Button } from "tamagui"
import {
  GripVertical,
  Info,
  RotateCcw,
  ClipboardCheck,
} from "@tamagui/lucide-icons"
import { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs"
import { router } from "expo-router"
import { AlertModal } from "@/src/components/AlertModal"
import { DurationProgressBar } from "@/src/components/DurationProgressBar"
import { useDurationSections } from "@/src/hooks/useDurationSections"
import { useJourneyReset } from "./hooks/useJourneyReset"

type UserJourneyWithEntryModel = NonNullable<
  AppRouter["journey"]["list"]["_def"]["$types"]["output"]["journeys"][number]
>

export type TrackerCardProps = {
  title: string
  model: UserJourneyWithEntryModel
  requestRefetch: () => void | Promise<void>
  drag?: () => void
  isActive?: boolean
}

export const TrackerCard: React.FC<TrackerCardProps> = ({
  title,
  model,
  requestRefetch,
  drag,
  isActive,
}) => {
  const { resetJourney } = useJourneyReset()
  const { sections } = useDurationSections({
    startDate: model.lastEntry?.createdAt || new Date(),
  })

  if (!model.lastEntry) {
    return null
  }

  const onReset = async () => {
    await resetJourney(model.id)
    await requestRefetch()
  }

  return (
    <Card
      bordered
      borderRadius="$4"
      backgroundColor="$background"
      padding="$4"
      onPress={() =>
        router.push({
          pathname: "/journeys-info",
          params: { journeyId: model.id },
        })
      }
    >
      <YStack gap="$4">
        {/* Header with title and reset button */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" flex={1} gap="$2">
            {drag && (
              <Pressable
                onLongPress={drag}
                disabled={isActive}
                style={{
                  justifyContent: "center",
                  paddingVertical: 4,
                }}
              >
                <GripVertical size={20} color="$color11" />
              </Pressable>
            )}
            <Text
              fontSize="$6"
              fontWeight="600"
              color="$color12"
              flexWrap="wrap"
              flex={1}
            >
              {title}
            </Text>
          </XStack>
          <XStack gap="$2" alignItems="center">
            <Button
              size="$3"
              icon={({ size }) => (
                <ClipboardCheck size={size} pointerEvents="none" />
              )}
              circular
              onPress={() =>
                router.push({
                  pathname: "/checkin-new",
                  params: { journeyId: model.id },
                })
              }
            />
            <Button
              size="$3"
              icon={({ size }) => <Info size={size} pointerEvents="none" />}
              circular
              onPress={() =>
                router.push({
                  pathname: "/journeys-info",
                  params: { journeyId: model.id },
                })
              }
            />
            <AlertModal
              title="Reset"
              message="This is a hard moment — are you ready to honor it and start again?"
              buttons={[
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  onPress: onReset,
                },
              ]}
            >
              <Button
                size="$3"
                icon={({ size }) => (
                  <RotateCcw size={size} pointerEvents="none" />
                )}
                circular
              />
            </AlertModal>
          </XStack>
        </XStack>

        {/* Progress bars for each time unit */}
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
      </YStack>
    </Card>
  )
}
