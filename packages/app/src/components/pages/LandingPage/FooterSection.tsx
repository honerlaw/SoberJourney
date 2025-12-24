import React from "react"
import { Link, useRouter } from "expo-router"
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
            <Link href="/privacy">
              <Text fontSize="$3" color="$gray11">
                Privacy
              </Text>
            </Link>
            <Link href="/terms">
              <Text fontSize="$3" color="$gray11">
                Terms
              </Text>
            </Link>
            <Link href="/support">
              <Text fontSize="$3" color="$gray11">
                Support
              </Text>
            </Link>
          </XStack>
        </XStack>
      </Stack>
    </YStack>
  )
}
