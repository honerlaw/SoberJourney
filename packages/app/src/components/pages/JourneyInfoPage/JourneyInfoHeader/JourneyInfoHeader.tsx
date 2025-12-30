import React from "react"
import { XStack, Separator } from "tamagui"
import { Stack, router } from "expo-router"
import { Pencil, Trash2 } from "@tamagui/lucide-icons"
import { HeaderButton } from "@/src/components/HeaderButton"

type JourneyInfoHeaderProps = {
  journeyId: string
  journeyTitle: string
  onDeletePress: () => void
}

export const JourneyInfoHeader: React.FC<JourneyInfoHeaderProps> = ({
  journeyId,
  journeyTitle,
  onDeletePress,
}) => {
  return (
    <Stack.Screen
      options={{
        headerTitle: journeyTitle,
        headerRight: () => (
          <XStack gap="$2">
            <HeaderButton
              icon={Pencil}
              onPress={() =>
                router.push({
                  pathname: "/journeys-modify",
                  params: {
                    journeyId,
                    currentTitle: journeyTitle,
                  },
                })
              }
            />
            <Separator vertical marginVertical="$2" />
            <HeaderButton icon={Trash2} onPress={onDeletePress} />
          </XStack>
        ),
      }}
    />
  )
}
