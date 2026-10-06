import { YStack, TextArea, Card, H6 } from "tamagui"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"

type MicroJournalProps = {
  value: string
  onValueChange: (value: string) => void
}

export const MicroJournal: React.FC<MicroJournalProps> = ({
  value,
  onValueChange,
}) => {
  const trpc = useTRPC()
  // Random prompt per fetch: never refetch while the user is typing
  const { data } = useQuery(
    trpc.journal.entryPrompt.queryOptions(undefined, {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
  )

  const journalPrompt =
    data?.prompt ?? "What is one thing you are grateful for today?"

  return (
    <Card bordered padding="$4">
      <YStack gap="$3">
        <H6 htmlFor="journal-entry" size={"$4"}>
          {journalPrompt}
        </H6>
        <TextArea
          id="journal-entry"
          placeholder="What's on your mind today?"
          value={value}
          onChangeText={onValueChange}
          minHeight={100}
        />
      </YStack>
    </Card>
  )
}
