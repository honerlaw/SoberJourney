import { useState } from "react"
import { YStack, Button } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useToastController } from "@tamagui/toast"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { MoodPulse } from "./MoodPulse"
import { UrgeMeter } from "./UrgeMeter"
import { MicroJournal } from "./MicroJournal"
import { useCreateCheckIn } from "./hooks"
import { MoodOption } from "./MoodPulse/hooks"

export const NewCheckInPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets()
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>()
  const router = useRouter()
  const toast = useToastController()
  const { createCheckIn, isPending } = useCreateCheckIn()

  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null)
  const [urgeStrength, setUrgeStrength] = useState<number>(1)
  const [journalEntry, setJournalEntry] = useState<string>("")

  const onCompleteCheckIn = async () => {
    if (!journeyId) {
      toast.show("Journey not found.", {
        type: "error",
        native: false,
      })
      return
    }

    if (!selectedMood) {
      toast.show("Please select how you're feeling.", {
        type: "error",
        native: false,
      })
      return
    }

    const success = await createCheckIn({
      journeyId,
      mood: selectedMood,
      urgeStrength,
      journalEntry: journalEntry.trim() || null,
    })

    if (success) {
      toast.show("Check-in completed!", {
        type: "success",
        native: false,
      })
      router.back()
    }
  }

  return (
    <YStack flex={1} width="100%">
      <KeyboardAvoiding>
        <YStack flex={1} padding="$4" gap="$4">
          <MoodPulse
            selectedMood={selectedMood}
            onMoodChange={setSelectedMood}
          />
          <UrgeMeter value={urgeStrength} onValueChange={setUrgeStrength} />
          <MicroJournal value={journalEntry} onValueChange={setJournalEntry} />
        </YStack>
      </KeyboardAvoiding>
      <Button
        themeInverse
        onPress={onCompleteCheckIn}
        margin={"$4"}
        marginBottom={bottom}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Complete Check-in"}
      </Button>
    </YStack>
  )
}
