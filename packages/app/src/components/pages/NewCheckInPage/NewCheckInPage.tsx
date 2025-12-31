import { useState } from "react"
import { YStack, Button } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useToastController } from "@tamagui/toast"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { MoodPulse } from "./MoodPulse"
import { UrgeMeter } from "./UrgeMeter"
import { MicroJournal } from "./MicroJournal"
import { useCreateCheckIn } from "./hooks"
import { MoodOption } from "./MoodPulse/hooks"
import { useJourneyInfo } from "../JourneyInfoPage/hooks/useJourneyInfo"

export const NewCheckInPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets()
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>()
  const router = useRouter()
  const toast = useToastController()
  const { createCheckIn, isPending } = useCreateCheckIn()
  const { journey } = useJourneyInfo(journeyId)

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

  const headerTitle = journey?.title
    ? `${journey.title} - Daily Check-in`
    : "Daily Check-in"

  return (
    <>
      <Stack.Screen options={{ headerTitle }} />
      <KeyboardAvoiding>
        <YStack flex={1} padding="$4" gap="$4">
          <YStack gap="$4" flex={1}>
            <MoodPulse
              selectedMood={selectedMood}
              onMoodChange={setSelectedMood}
            />
            <UrgeMeter value={urgeStrength} onValueChange={setUrgeStrength} />
            <MicroJournal
              value={journalEntry}
              onValueChange={setJournalEntry}
            />
          </YStack>
          <Button
            themeInverse
            onPress={onCompleteCheckIn}
            marginBottom={bottom}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Complete Check-in"}
          </Button>
        </YStack>
      </KeyboardAvoiding>
    </>
  )
}
