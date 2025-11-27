import { YStack, H1, Text, Label, Input, XStack, Button } from "tamagui";
import { Calendar, ChevronRight } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoiding } from "../../KeyboardAvoiding";

export const NewJourneyPage: React.FC = () => {
  const { bottom, top } = useSafeAreaInsets()

  return (
    <KeyboardAvoiding>
      <YStack flex={1} padding="$4" width="100%">
        <YStack flex={1} gap="$4">
          {/* Header */}
          <YStack gap="$2">
            <H1 size="$8" fontWeight="bold" marginTop={top / 2}>
              New Journey
            </H1>
            <Text fontSize="$5">
              Take the first step towards a healthier you
            </Text>
          </YStack>

          {/* Journey Name */}
          <YStack>
            <Label htmlFor="journey-name" fontWeight={"400"}>
              Journey Name
            </Label>
            <Input
              id="journey-name"
              placeholder="What are you staying sober from?"
            />
          </YStack>

          {/* Start Date & Time */}
          <YStack>
            <Label fontWeight={"400"}>
              Start Date & Time{" "}
              <Text color="$color11">
                (optional)
              </Text>
            </Label>
            <Button
              borderWidth={1}
              justifyContent="flex-start"
              paddingHorizontal="$3"
            >
              <XStack flex={1} alignItems="center" justifyContent="space-between">
                <XStack gap="$2" alignItems="center">
                  <Calendar size={20} />
                  <Text>Now</Text>
                </XStack>
                <ChevronRight size={20} />
              </XStack>
            </Button>
            <Text fontSize="$3" color="$color11" textAlign="center" marginTop="$3">
              If left empty, your journey will start now.
            </Text>
          </YStack>
        </YStack>

        {/* Create Journey Button */}
        <Button marginBottom={bottom} size="$5">
          Create Journey
        </Button>
      </YStack>
    </KeyboardAvoiding>
  );
};
