import { YStack, TextArea, Paragraph } from "tamagui";
import { KeyboardAvoiding } from "../../KeyboardAvoiding";
import { useState, useMemo } from "react";
import { useCreateJournalEntry } from "./hooks/useCreateJournalEntry";
import { useToastController } from "@tamagui/toast";
import { useRouter, Stack } from "expo-router";
import { HeaderButton } from "../../HeaderButton";
import { Check } from "@tamagui/lucide-icons";

const JOURNAL_PROMPTS = [
  "What are three things you're grateful for in your sobriety journey today?",
  "Describe a moment today when you felt strong in your recovery.",
  "What coping strategies helped you navigate challenges today?",
  "How has your relationship with yourself changed since starting this journey?",
  "What is one thing you've learned about yourself this week?",
  "Write about a person who supports your sobriety and what they mean to you.",
  "What emotions came up for you today, and how did you handle them?",
  "Describe a goal you're working toward and the progress you've made.",
  "What does living authentically mean to you in recovery?",
  "Reflect on how far you've come—what would you tell your past self?",
];

const getRandomPrompt = () =>
  JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];

export const NewJournalEntryPage: React.FC = () => {
  const [content, setContent] = useState<string>("");
  const toast = useToastController();
  const router = useRouter();
  const { createEntry, isPending } = useCreateJournalEntry();

  const prompt = useMemo(() => getRandomPrompt(), []);

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
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton
              icon={Check}
              onPress={onCreate}
              disabled={isPending}
            />
          ),
        }}
      />
      <KeyboardAvoiding>
      <YStack flex={1} width="100%">
        <YStack flex={1} gap="$4">
          <YStack gap="$2" padding="$4">
            <Paragraph textAlign="center" color="$color12" size={"$6"}>
              {prompt}
            </Paragraph>
            <Paragraph textAlign="center" color="$color10" size={"$2"}>
              - or -
            </Paragraph>
            <Paragraph textAlign="center" color="$color12" size={"$5"}>
              Let your thoughts flow freely.
            </Paragraph>
          </YStack>

          <TextArea
            flex={1}
            placeholder="What's on your mind today?"
            value={content}
            onChangeText={setContent}
            padding="$4"
            borderWidth={0}
            borderRadius={0}
          />
        </YStack>
      </YStack>
    </KeyboardAvoiding>
    </>
  );
};

