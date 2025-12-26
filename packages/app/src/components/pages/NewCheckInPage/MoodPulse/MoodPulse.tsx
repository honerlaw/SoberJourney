import { YStack, XStack, Paragraph, Button, Card, H6, Spinner } from "tamagui"
import { Frown, Meh, Smile, SmilePlus, Moon } from "@tamagui/lucide-icons"
import { useMoods, type MoodOption } from "./hooks"

// Map icon names to actual icon components
const ICON_MAP: Record<string, typeof Frown> = {
  Frown,
  Moon,
  Meh,
  Smile,
  SmilePlus,
}

type MoodPulseProps = {
  selectedMood: MoodOption | null
  onMoodChange: (mood: MoodOption) => void
}

export const MoodPulse: React.FC<MoodPulseProps> = ({
  selectedMood,
  onMoodChange,
}) => {
  const { moods, isLoading } = useMoods()

  const selectedMoodLabel =
    moods.find((m) => m.id === selectedMood?.id)?.label ?? null

  return (
    <Card bordered padding="$4">
      <YStack gap="$4">
        <H6 size={"$4"}>How are you feeling?</H6>
        {isLoading ? (
          <XStack justifyContent="center" padding="$4">
            <Spinner />
          </XStack>
        ) : (
          <XStack justifyContent="space-between" gap="$2">
            {moods.map((mood) => {
              const Icon = ICON_MAP[mood.icon] ?? Meh
              const isSelected = selectedMood?.id === mood.id
              return (
                <Button
                  key={mood.id}
                  circular
                  size="$5"
                  onPress={() => onMoodChange(mood)}
                  themeInverse={isSelected}
                  icon={<Icon size={"$2"} pointerEvents="none" />}
                  aria-label={mood.label}
                />
              )
            })}
          </XStack>
        )}
        {selectedMood && selectedMoodLabel && (
          <Paragraph fontSize={"$3"} color="$color11">
            Feeling {selectedMoodLabel}
          </Paragraph>
        )}
      </YStack>
    </Card>
  )
}
