import { YStack, XStack, H5, Paragraph, Button, Card } from "tamagui"
import { Frown, Meh, Smile, SmilePlus, Moon } from "@tamagui/lucide-icons"

type MoodOption = {
  id: string
  label: string
  icon: typeof Frown
}

const MOOD_OPTIONS: MoodOption[] = [
  { id: "sad", label: "Sad", icon: Frown },
  { id: "tired", label: "Tired", icon: Moon },
  { id: "neutral", label: "Neutral", icon: Meh },
  { id: "good", label: "Good", icon: Smile },
  { id: "great", label: "Great", icon: SmilePlus },
]

type MoodPulseProps = {
  selectedMood: string | null
  onMoodChange: (mood: string) => void
}

export const MoodPulse: React.FC<MoodPulseProps> = ({
  selectedMood,
  onMoodChange,
}) => {
  return (
    <Card bordered padding="$4">
      <YStack gap="$4">
        <H5 textAlign="center">How are you feeling?</H5>
        <XStack justifyContent="space-between" gap="$2">
          {MOOD_OPTIONS.map((mood) => {
            const Icon = mood.icon
            const isSelected = selectedMood === mood.id
            return (
              <Button
                key={mood.id}
                circular
                size="$5"
                onPress={() => onMoodChange(mood.id)}
                themeInverse={isSelected}
                icon={<Icon size={24} />}
                aria-label={mood.label}
              />
            )
          })}
        </XStack>
        {selectedMood && (
          <Paragraph textAlign="center" color="$color11" size="$3">
            Feeling {MOOD_OPTIONS.find((m) => m.id === selectedMood)?.label}
          </Paragraph>
        )}
      </YStack>
    </Card>
  )
}
