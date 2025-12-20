import { format } from "date-fns"
import { Card, Text, YStack, XStack, Button } from "tamagui"
import { Trash2 } from "@tamagui/lucide-icons"
import { router } from "expo-router"
import { AlertModal } from "@/src/components/AlertModal"
import { useJournalRemove } from "../hooks/useJournalRemove"

type JournalEntryCardProps = {
  id: string
  createdAt: Date
}

export const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  id,
  createdAt,
}) => {
  const formattedDate = format(new Date(createdAt), "EEEE, MMMM d, yyyy")
  const formattedTime = format(new Date(createdAt), "h:mm a")
  const { removeEntry, isPending } = useJournalRemove()

  const handleDelete = async () => {
    await removeEntry(id)
  }

  return (
    <Card
      bordered
      padding="$4"
      onPress={() =>
        router.push({
          pathname: "/journal-info",
          params: { entryId: id },
        })
      }
    >
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$2" flex={1}>
          <Text fontSize="$5" fontWeight="600">
            {formattedDate}
          </Text>
          <Text fontSize="$3" color="$color11">
            {formattedTime}
          </Text>
        </YStack>
        <AlertModal
          title="Delete Entry"
          message="Are you sure you want to delete this journal entry?"
          buttons={[
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: handleDelete,
            },
          ]}
        >
          <Button
            size="$3"
            circular
            disabled={isPending}
            icon={<Trash2 size={18} color="$color11" pointerEvents="none" />}
          />
        </AlertModal>
      </XStack>
    </Card>
  )
}
