import { YStack, Label, Input, Button, H5 } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoiding } from "../../KeyboardAvoiding";
import { useState } from "react";
import { useUpdateJourney } from "./hooks/useUpdateJourney";
import { useToastController } from "@tamagui/toast";
import { useLocalSearchParams, useRouter } from "expo-router";

export const ModifyJourneyPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets();
  const { journeyId, currentTitle } = useLocalSearchParams<{
    journeyId: string;
    currentTitle: string;
  }>();
  const [title, setTitle] = useState<string>(currentTitle || "");
  const toast = useToastController();
  const router = useRouter();
  const { updateJourney, isPending } = useUpdateJourney();

  const onUpdate = async () => {
    if (!journeyId) return;
    
    const success = await updateJourney(journeyId, title);
    if (success) {
      toast.show("Your journey has been updated.", {
        type: "success",
        native: false,
      });
      router.back();
    }
  };

  return (
    <KeyboardAvoiding>
      <YStack flex={1} padding="$4" width="100%">
        <YStack flex={1} gap="$4">
          {/* Header */}
          <YStack gap="$2">
            <H5 textAlign="center">Update your journey details</H5>
          </YStack>

          {/* Journey Name */}
          <YStack>
            <Label htmlFor="journey-name" fontWeight={"400"}>
              Journey Name
            </Label>
            <Input
              id="journey-name"
              placeholder="What are you staying sober from?"
              value={title}
              onChangeText={setTitle}
            />
          </YStack>
        </YStack>

        {/* Update Journey Button */}
        <Button
          marginBottom={bottom}
          size="$5"
          onPress={onUpdate}
          disabled={isPending || !title.trim()}
          themeInverse
        >
          {isPending ? "Updating..." : "Update Journey"}
        </Button>
      </YStack>
    </KeyboardAvoiding>
  );
};

