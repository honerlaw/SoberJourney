import React from "react"
import { YStack, H1, Button, Paragraph, useMedia, XStack, H2 } from "tamagui"
import Logo from "@/assets/logo/icon.svg"

interface HeroSectionProps {
  onGetStarted: () => void
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  const media = useMedia()

  return (
    <YStack
      minHeight={media.gtSm ? 600 : 500}
      justifyContent="center"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$8"
      backgroundColor="$color2"
    >
      <YStack
        maxWidth={1200}
        width="100%"
        alignItems="center"
        gap="$6"
        paddingHorizontal="$4"
      >
        <XStack justifyContent="center" alignItems="center">
          <Logo width={90} height={90} />
          <H2>SoberJourney</H2>
        </XStack>

        <H1
          fontSize={media.gtSm ? "$10" : "$8"}
          textAlign="center"
          fontWeight="600"
          color="$gray12"
        >
          Track your sobriety, your way
        </H1>

        <Paragraph
          fontSize={media.gtSm ? "$6" : "$4"}
          textAlign="center"
          color="$gray11"
          maxWidth={800}
          lineHeight={media.gtSm ? "$8" : "$6"}
        >
          A gentle tool to help you notice time since your last action. Track
          any habit, any goal, at your own pace. No judgment, just support.
        </Paragraph>

        <Button
          size={media.gtSm ? "$5" : "$4"}
          backgroundColor="$gray12"
          color="$gray1"
          paddingHorizontal="$6"
          borderRadius="$3"
          pressStyle={{ opacity: 0.9 }}
          onPress={onGetStarted}
          fontWeight="600"
          themeInverse
        >
          Get Started
        </Button>
      </YStack>
    </YStack>
  )
}
