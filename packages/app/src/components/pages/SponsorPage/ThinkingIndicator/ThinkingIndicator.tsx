import { YStack, Text } from "tamagui"

export const ThinkingIndicator: React.FC = () => (
  <YStack alignItems="flex-start" paddingVertical={"$2"}>
    <YStack
      backgroundColor="$color4"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$4"
      maxWidth="80%"
    >
      <Text color="$gray11">Thinking...</Text>
    </YStack>
  </YStack>
)
