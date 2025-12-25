import { YStack, H4, Text } from "tamagui"
import { MessageCircle } from "@tamagui/lucide-icons"
import React from "react"

type EmptyPageViewProps = React.PropsWithChildren<{
  title: string
  message: string
  icon: typeof MessageCircle
}>

// 246, 200, 70
// 33, 77, 60

export const EmptyPageView: React.FC<EmptyPageViewProps> = ({
  title,
  message,
  icon: Icon,
  children,
}) => {
  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      paddingHorizontal="$6"
      gap="$8"
    >
      <Icon size={80} color={"rgb(246, 200, 70)"} />

      <YStack gap="$4" maxWidth={500} alignItems="center">
        <H4 textAlign="center" fontWeight="600">
          {title}
        </H4>
        <Text fontSize="$5" color="$color11" textAlign="center" lineHeight="$5">
          {message}
        </Text>
      </YStack>

      {children}
    </YStack>
  )
}
