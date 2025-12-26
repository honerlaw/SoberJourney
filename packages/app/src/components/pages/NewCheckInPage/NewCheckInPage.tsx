import { useState } from "react"
import { YStack, Button } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { MoodPulse } from "./MoodPulse"
import { UrgeMeter } from "./UrgeMeter"
import { MicroJournal } from "./MicroJournal"

export const NewCheckInPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets()

  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [urgeStrength, setUrgeStrength] = useState<number>(1)
  const [journalEntry, setJournalEntry] = useState<string>("")

  const onCompleteCheckIn = () => {
    // TODO: Implement check-in submission
    router.back()
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
      >
        Complete Check-in
      </Button>
    </YStack>
  )
}
