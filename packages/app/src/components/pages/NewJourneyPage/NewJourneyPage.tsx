import { YStack, Text, Label, Input, Button, H5 } from "tamagui"
import { Calendar, ChevronRight } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { DateTimeInput } from "./DateTimeInput"
import { InputButton } from "./InputButton"
import { useState, useRef } from "react"
import { useCreateJourney } from "./hooks/useCreateJourney"
import { useToastController } from "@tamagui/toast"
import { useRouter } from "expo-router"
import {
  NotificationSettings,
  NotificationSettingsRef,
} from "../../NotificationSettings"

export const NewJourneyPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets()
  const [showDateTimePicker, setShowDateTimePicker] = useState<boolean>(false)
  // null = "Now", resolved at submit time (not at mount)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [title, setTitle] = useState<string>("")
  const notificationSettingsRef = useRef<NotificationSettingsRef>(null)
  const isSubmittingRef = useRef(false)
  const toast = useToastController()
  const router = useRouter()
  const { createJourney, isPending } = useCreateJourney()

  const trimmedTitle = title.trim()

  const onUseNow = () => {
    setStartDate(null)
    setShowDateTimePicker(false)
  }

  const onCreate = async () => {
    if (!trimmedTitle) {
      toast.show("Please name your journey.", {
        type: "error",
        native: false,
      })
      return
    }
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    try {
      const settings = notificationSettingsRef.current?.notificationSettings
      const now = new Date()
      // Never send a future start date
      const start = startDate && startDate < now ? startDate : now
      const success = await createJourney(
        trimmedTitle,
        start,
        settings?.enabled ? settings : undefined,
      )
      if (success) {
        toast.show("Your journey has been created.", {
          type: "success",
          native: false,
        })
        router.back()
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  return (
    <>
      <KeyboardAvoiding>
        <YStack flex={1} padding="$4" width="100%">
          <YStack gap="$4" paddingBottom="$4">
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
              {showDateTimePicker && (
                <>
                  <DateTimeInput onChange={setStartDate} />
                  <Button
                    size="$3"
                    chromeless
                    marginTop="$2"
                    alignSelf="center"
                    onPress={onUseNow}
                  >
                    Use current time instead
                  </Button>
                </>
              )}
            </YStack>

            {/* Notification Settings */}
            <YStack>
              <NotificationSettings ref={notificationSettingsRef} />
            </YStack>
          </YStack>
        </YStack>
      </KeyboardAvoiding>
      {/* Create Journey Button */}
      <Button
        margin="$4"
        marginBottom={bottom}
        size="$5"
        onPress={onCreate}
        disabled={isPending || !trimmedTitle}
        themeInverse
      >
        {isPending ? "Creating..." : "Create Journey"}
      </Button>
    </>
  )
}
