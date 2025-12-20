import { YStack, Text, Label, Input, Button, H5 } from "tamagui"
import { Calendar, ChevronRight } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { DateTimeInput } from "./DateTimeInput"
import { InputButton } from "./InputButton"
import { useState } from "react"
import { useCreateJourney } from "./hooks/useCreateJourney"
import { useToastController } from "@tamagui/toast"
import { useRouter } from "expo-router"

export const NewJourneyPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets()
  const [showDateTimePicker, setShowDateTimePicker] = useState<boolean>(false)
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [title, setTitle] = useState<string>("")
  const toast = useToastController()
  const router = useRouter()
  const { createJourney, isPending } = useCreateJourney()

  const onCreate = async () => {
    const success = await createJourney(title, startDate)
    if (success) {
      toast.show("Your journey has been created.", {
        type: "success",
        native: false,
      })
      router.back()
    }
  }

  return (
    <KeyboardAvoiding>
      <YStack flex={1} padding="$4" width="100%">
        <YStack flex={1} gap="$4">
          {/* Header */}
          <YStack gap="$2">
            <H5 textAlign="center">
              Take the first step towards a healthier you
            </H5>
          </YStack>

          {/* Journey Name */}
          <YStack>
            <Label htmlFor="journey-name" fontWeight={"400"}>
              Journey Name
            </Label>
            <Input
              id="journey-name"
              placeholder="What are you staying sober from?"
              value={title}
              onChangeText={setTitle}
            />
          </YStack>

          {/* Start Date & Time */}
          <YStack>
            <Label fontWeight={"400"}>
              Start Date & Time <Text color="$color11">(optional)</Text>
            </Label>
            {!showDateTimePicker && (
              <>
                <InputButton
                  value="Now"
                  onPress={() => setShowDateTimePicker(true)}
                  icon={Calendar}
                  iconRight={ChevronRight}
                />
                <Text
                  fontSize="$3"
                  color="$color11"
                  textAlign="center"
                  marginTop="$3"
                >
                  If left empty, your journey will start now.
                </Text>
              </>
            )}
            {showDateTimePicker && <DateTimeInput onChange={setStartDate} />}
          </YStack>
        </YStack>

        {/* Create Journey Button */}
        <Button
          marginBottom={bottom}
          size="$5"
          onPress={onCreate}
          disabled={isPending}
          themeInverse
        >
          {isPending ? "Creating..." : "Create Journey"}
        </Button>
      </YStack>
    </KeyboardAvoiding>
  )
}
