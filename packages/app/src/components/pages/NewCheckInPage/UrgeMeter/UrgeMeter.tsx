import { YStack, XStack, Text, Slider, H6, Card } from "tamagui"

type UrgeMeterProps = {
  value: number
  onValueChange: (value: number) => void
}

export const UrgeMeter: React.FC<UrgeMeterProps> = ({
  value,
  onValueChange,
}) => {
  return (
    <Card bordered padding="$4">
      <YStack gap="$4">
        <H6 size={"$4"}>How strong is your urge right now?</H6>
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
          size="$4"
        >
          <Slider.Track backgroundColor={"$color4"}>
            <Slider.TrackActive backgroundColor={"$color8"} />
          </Slider.Track>
          <Slider.Thumb index={0} circular size={"$2"} />
        </Slider>
      </YStack>
    </Card>
  )
}
