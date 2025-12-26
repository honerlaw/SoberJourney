import { useMemo } from "react"
import { YStack, XStack, H5, Text, Label, TextArea, Card } from "tamagui"
import { EyeOff } from "@tamagui/lucide-icons"

const JOURNAL_PROMPTS = [
  "What is one thing you are grateful for today?",
  "What is your biggest trigger today?",
  "What's something positive that happened recently?",
  "How are you taking care of yourself today?",
  "What's one small win you can celebrate?",
]

type MicroJournalProps = {
  value: string
  onValueChange: (value: string) => void
}

export const MicroJournal: React.FC<MicroJournalProps> = ({
  value,
  onValueChange,
}) => {
  // Random journal prompt (stable for component lifetime)
  const journalPrompt = useMemo(() => {
    const index = Math.floor(Math.random() * JOURNAL_PROMPTS.length)
    return JOURNAL_PROMPTS[index]
  }, [])

  return (
    <Card bordered padding="$4">
      <YStack gap="$3">
        <H5 textAlign="center">Micro-Journal</H5>
        <Label htmlFor="journal-entry" textAlign="center">
          {journalPrompt}
        </Label>
        <TextArea
          id="journal-entry"
          placeholder="Write your thoughts here..."
          value={value}
          onChangeText={onValueChange}
          minHeight={100}
        />
        <XStack alignItems="center" justifyContent="center" gap="$2">
          <EyeOff size={14} color="$color10" />
          <Text fontSize="$2" color="$color10">
            Private: The AI cannot see this entry.
          </Text>
        </XStack>
      </YStack>
    </Card>
  )
}
