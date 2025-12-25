import { YStack, TextArea, Paragraph } from "tamagui"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { useState } from "react"
import { useCreateJournalEntry } from "./hooks/useCreateJournalEntry"
import { useToastController } from "@tamagui/toast"
import { useRouter, Stack } from "expo-router"
import { HeaderButton } from "../../HeaderButton"
import { Check } from "@tamagui/lucide-icons"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"

export const NewJournalEntryPage: React.FC = () => {
  const [content, setContent] = useState<string>("")
  const toast = useToastController()
  const router = useRouter()
  const { createEntry, isPending } = useCreateJournalEntry()
  const trpc = useTRPC()

  const { data } = useQuery(trpc.journal.entryPrompt.queryOptions())
  const prompt = data?.prompt

  const onCreate = async () => {
    if (!content.trim()) {
      toast.show("Please write something before saving.", {
        type: "error",
        native: false,
      })
      return
    }

    const success = await createEntry(content)
    if (success) {
      toast.show("Your journal entry has been saved.", {
        type: "success",
        native: false,
      })
      router.back()
    }
  }

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
  )
}
