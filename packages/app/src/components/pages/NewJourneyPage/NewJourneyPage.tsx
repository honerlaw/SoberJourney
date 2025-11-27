import { YStack, H1, Text, Label, Input, Button } from "tamagui";
import { Calendar, ChevronRight } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoiding } from "../../KeyboardAvoiding";
import { DateTimeInput } from "./DateTimeInput";
import { InputButton } from "./InputButton";
import { useState } from "react";

export const NewJourneyPage: React.FC = () => {
  const { bottom, top } = useSafeAreaInsets();
  const [showDateTimePicker, setShowDateTimePicker] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date>(new Date());

  console.log(startDate)

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
              Start Date & Time <Text color="$color11">(optional)</Text>
            </Label>
            {!showDateTimePicker && (
              <>
                <InputButton
                  value="Now"
                  onPress={() => setShowDateTimePicker(true)}
                  icon={Calendar}
                  iconRight={ChevronRight}
                />
                <Text
                  fontSize="$3"
                  color="$color11"
                  textAlign="center"
                  marginTop="$3"
                >
                  If left empty, your journey will start now.
                </Text>
              </>
            )}
            {showDateTimePicker && <DateTimeInput onChange={setStartDate} />}
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
