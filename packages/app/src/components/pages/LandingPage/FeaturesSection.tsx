import React from "react";
import { YStack, XStack, Text, Paragraph, useMedia } from "tamagui";
import { Heart, Clock, RotateCcw } from "@tamagui/lucide-icons";

export function FeaturesSection() {
  const media = useMedia();

  return (
    <YStack
      paddingVertical={media.gtSm ? "$12" : "$8"}
      paddingHorizontal="$4"
      alignItems="center"
    >
      <XStack
        maxWidth={1200}
        width="100%"
        flexWrap={media.gtSm ? "nowrap" : "wrap"}
        justifyContent="center"
        gap={media.gtSm ? "$8" : "$6"}
      >
        {/* Feature 1 */}
        <YStack
          flex={media.gtSm ? 1 : undefined}
          width={media.gtSm ? undefined : "100%"}
          maxWidth={media.gtSm ? undefined : 400}
          alignItems="center"
          gap="$4"
          paddingHorizontal="$4"
        >
          <YStack
            width={64}
            height={64}
            borderRadius="$12"
            backgroundColor="$gray3"
            justifyContent="center"
            alignItems="center"
          >
            <Heart size={32} color="$gray11" />
          </YStack>
          
          <Text
            fontSize="$6"
            fontWeight="600"
            textAlign="center"
            color="$gray12"
          >
            Track Any Habit
          </Text>
          
          <Paragraph
            fontSize="$4"
            textAlign="center"
            color="$gray11"
            lineHeight="$5"
          >
            Whatever you&apos;re working on—substances, behaviors, or patterns—this tool adapts to your journey.
          </Paragraph>
        </YStack>

        {/* Feature 2 */}
        <YStack
          flex={media.gtSm ? 1 : undefined}
          width={media.gtSm ? undefined : "100%"}
          maxWidth={media.gtSm ? undefined : 400}
          alignItems="center"
          gap="$4"
          paddingHorizontal="$4"
        >
          <YStack
            width={64}
            height={64}
            borderRadius="$12"
            backgroundColor="$gray3"
            justifyContent="center"
            alignItems="center"
          >
            <Clock size={32} color="$gray11" />
          </YStack>
          
          <Text
            fontSize="$6"
            fontWeight="600"
            textAlign="center"
            color="$gray12"
          >
            See Your Progress
          </Text>
          
          <Paragraph
            fontSize="$4"
            textAlign="center"
            color="$gray11"
            lineHeight="$5"
          >
            Watch time accumulate since your last reset. Simple, clear, and always there when you need it.
          </Paragraph>
        </YStack>

        {/* Feature 3 */}
        <YStack
          flex={media.gtSm ? 1 : undefined}
          width={media.gtSm ? undefined : "100%"}
          maxWidth={media.gtSm ? undefined : 400}
          alignItems="center"
          gap="$4"
          paddingHorizontal="$4"
        >
          <YStack
            width={64}
            height={64}
            borderRadius="$12"
            backgroundColor="$gray3"
            justifyContent="center"
            alignItems="center"
          >
            <RotateCcw size={32} color="$gray11" />
          </YStack>
          
          <Text
            fontSize="$6"
            fontWeight="600"
            textAlign="center"
            color="$gray12"
          >
            Reset When Needed
          </Text>
          
          <Paragraph
            fontSize="$4"
            textAlign="center"
            color="$gray11"
            lineHeight="$5"
          >
            Life happens. Reset your timer without shame and start fresh. Every moment is a new beginning.
          </Paragraph>
        </YStack>
      </XStack>
    </YStack>
  );
}

