import { YStack, Text, Button, H4 } from "tamagui";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRouter } from "expo-router";
import Icon from "@/assets/logo/icon.svg";

export const EmptyDashboard: React.FC = () => {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const handleCreateJourney = () => {
    router.push("/journeys-new");
  };

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      paddingHorizontal="$6"
      gap="$8"
      paddingBottom={headerHeight}
    >
      {/* Icon Circle */}
      <Icon width={120} height={120} />

      {/* Content */}
      <YStack gap="$4" maxWidth={500} alignItems="center">
        <H4 textAlign="center" fontWeight="600">
          Begin your journey whenever you&apos;re ready
        </H4>
        <Text
          fontSize="$5"
          color="$color11"
          textAlign="center"
          lineHeight="$5"
        >
          Every step forward is progress. Start tracking your journey at your
          own pace, with compassion and care.
        </Text>
      </YStack>

      {/* CTA Button */}
      <Button
        paddingHorizontal="$7"
        onPress={handleCreateJourney}
        themeInverse
      >
        Create Your First Journey
      </Button>
    </YStack>
  );
};

