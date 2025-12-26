import {
  YStack,
  XStack,
  H5,
  Text,
  Paragraph,
  Button,
  Slider,
  Card,
} from "tamagui"
import { MessageCircle } from "@tamagui/lucide-icons"
import { router } from "expo-router"

type UrgeMeterProps = {
  value: number
  onValueChange: (value: number) => void
}

export const UrgeMeter: React.FC<UrgeMeterProps> = ({
  value,
  onValueChange,
}) => {
  const showTalkToSponsor = value >= 7

  const onTalkToSponsor = () => {
    router.push("/(auth)/(tabs)/sponsor")
  }

  return (
    <Card bordered padding="$4">
      <YStack gap="$4">
        <H5 textAlign="center">Urge Strength</H5>
        <XStack justifyContent="space-between">
          <Text fontSize="$2" color="$color11">
            Non-existent
          </Text>
          <Text fontSize="$2" color="$color11">
            Critical
          </Text>
        </XStack>
        <Slider
          value={[value]}
          onValueChange={(values) => onValueChange(values[0])}
          min={1}
          max={10}
          step={1}
        >
          <Slider.Track>
            <Slider.TrackActive />
          </Slider.Track>
          <Slider.Thumb index={0} circular />
        </Slider>
        <Paragraph textAlign="center" size="$6" fontWeight="600">
          {value}
        </Paragraph>

        {showTalkToSponsor && (
          <Button
            size="$4"
            icon={<MessageCircle size={18} />}
            onPress={onTalkToSponsor}
          >
            Talk to AI Sponsor Now
          </Button>
        )}
      </YStack>
    </Card>
  )
}
