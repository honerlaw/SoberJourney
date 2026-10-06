import { YStack, Label, Input, Button, H5 } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { useState, useRef, useEffect } from "react"
import { useUpdateJourney } from "./hooks/useUpdateJourney"
import { useToastController } from "@tamagui/toast"
import { useLocalSearchParams, useRouter } from "expo-router"
import {
  NotificationSettings,
  NotificationSettingsRef,
} from "../../NotificationSettings"
import { useJourneyInfo } from "../JourneyInfoPage/hooks/useJourneyInfo"

export const ModifyJourneyPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets()
  const { journeyId, currentTitle } = useLocalSearchParams<{
    journeyId: string
    currentTitle: string
  }>()
  // `currentTitle` can be missing (e.g. a deep link); fall back to the journey
  const [title, setTitle] = useState<string>(currentTitle ?? "")
  const hasEditedTitle = useRef(!!currentTitle)
  const { journey } = useJourneyInfo(journeyId)
  const toast = useToastController()
  const router = useRouter()
  const { updateJourney, isPending } = useUpdateJourney()
  const notificationSettingsRef = useRef<NotificationSettingsRef>(null)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (!hasEditedTitle.current && journey?.title) {
      hasEditedTitle.current = true
      setTitle(journey.title)
    }
  }, [journey?.title])

  const onTitleChange = (value: string) => {
    hasEditedTitle.current = true
    setTitle(value)
  }

  const trimmedTitle = title.trim()

  const onUpdate = async () => {
    if (!journeyId || !trimmedTitle || isSubmittingRef.current) return
    isSubmittingRef.current = true

    try {
      const notificationSettings =
        notificationSettingsRef.current?.notificationSettings ?? undefined
      const success = await updateJourney(
        journeyId,
        trimmedTitle,
        notificationSettings,
      )
      if (success) {
        toast.show("Your journey has been updated.", {
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
              <H5 textAlign="center">Update your journey details</H5>
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
                onChangeText={onTitleChange}
              />
            </YStack>

            {/* Notification Settings */}
            {journeyId && (
              <YStack>
                <NotificationSettings
                  ref={notificationSettingsRef}
                  journeyId={journeyId}
                />
              </YStack>
            )}
          </YStack>
        </YStack>
      </KeyboardAvoiding>

      {/* Update Journey Button */}
      <Button
        margin="$4"
        marginBottom={bottom}
        size="$5"
        onPress={onUpdate}
        disabled={isPending || !trimmedTitle}
        themeInverse
      >
        {isPending ? "Updating..." : "Update Journey"}
      </Button>
    </>
  )
}
