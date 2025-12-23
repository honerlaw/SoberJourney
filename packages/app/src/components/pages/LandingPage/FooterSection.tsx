import React from "react"
import { useRouter } from "expo-router"
import { YStack, XStack, Text, Stack, useMedia } from "tamagui"

export function FooterSection() {
  const router = useRouter()
  const media = useMedia()

  return (
    <YStack
      paddingVertical="$6"
      paddingHorizontal="$4"
      borderTopWidth={1}
      borderTopColor="$color5"
    >
      <Stack
        maxWidth={1200}
        width="100%"
        marginHorizontal="auto"
        paddingHorizontal="$4"
      >
        <XStack
          justifyContent={media.gtSm ? "space-between" : "center"}
          alignItems="center"
          flexDirection={media.gtSm ? "row" : "column"}
          gap="$4"
        >
          <Text fontSize="$3" color="$gray11">
            © 2025 Onerlaw LLC
          </Text>

          <XStack gap="$6">
            <Text
              fontSize="$3"
              color="$gray11"
              pressStyle={{ opacity: 0.7 }}
              cursor="pointer"
              onPress={() => {
                router.push("/privacy")
              }}
            >
              Privacy
            </Text>
            <Text
              fontSize="$3"
              color="$gray11"
              pressStyle={{ opacity: 0.7 }}
              cursor="pointer"
              onPress={() => {
                router.push("/terms")
              }}
            >
              Terms
            </Text>
            <Text
              fontSize="$3"
              color="$gray11"
              pressStyle={{ opacity: 0.7 }}
              cursor="pointer"
              onPress={() => router.push("/support")}
            >
              Support
            </Text>
          </XStack>
        </XStack>
      </Stack>
    </YStack>
  )
}
