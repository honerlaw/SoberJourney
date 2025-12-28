import React from "react"
import { Text, YStack } from "tamagui"

export const JourneyNotFoundView: React.FC = () => {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
      <Text color="$color11">Journey not found</Text>
    </YStack>
  )
}
