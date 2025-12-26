import { useState } from "react"
import { YStack, Button, ScrollView } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { CheckInHeader } from "./CheckInHeader"
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
    <KeyboardAvoiding>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack flex={1} padding="$4" gap="$6" paddingBottom={bottom + 16}>
          <CheckInHeader />
          <MoodPulse
            selectedMood={selectedMood}
            onMoodChange={setSelectedMood}
          />
          <UrgeMeter value={urgeStrength} onValueChange={setUrgeStrength} />
          <MicroJournal value={journalEntry} onValueChange={setJournalEntry} />
          <Button size="$5" themeInverse onPress={onCompleteCheckIn}>
            Complete Check-in
          </Button>
        </YStack>
      </ScrollView>
    </KeyboardAvoiding>
  )
}
