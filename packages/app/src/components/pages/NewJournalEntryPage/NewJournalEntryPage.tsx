import { YStack, TextArea, Button, H5 } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoiding } from "../../KeyboardAvoiding";
import { useState } from "react";
import { useCreateJournalEntry } from "./hooks/useCreateJournalEntry";
import { useToastController } from "@tamagui/toast";
import { useRouter } from "expo-router";

export const NewJournalEntryPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets();
  const [content, setContent] = useState<string>("");
  const toast = useToastController();
  const router = useRouter();
  const { createEntry, isPending } = useCreateJournalEntry();

  const onCreate = async () => {
    if (!content.trim()) {
      toast.show("Please write something before saving.", {
        type: "error",
        native: false,
      });
      return;
    }

    const success = await createEntry(content);
    if (success) {
      toast.show("Your journal entry has been saved.", {
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
          <YStack gap="$2">
            <H5 textAlign="center">
              Write freely about your thoughts and feelings
            </H5>
          </YStack>

          <TextArea
            flex={1}
            placeholder="What's on your mind today?"
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
            padding="$3"
          />
        </YStack>

        <Button
          marginTop="$4"
          marginBottom={bottom}
          size="$5"
          onPress={onCreate}
          disabled={isPending || !content.trim()}
          themeInverse
        >
          {isPending ? "Saving..." : "Save Entry"}
        </Button>
      </YStack>
    </KeyboardAvoiding>
  );
};

