import { YStack, Label, Input, Button, H5 } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAvoiding } from "../../KeyboardAvoiding"
import { useState } from "react"
import { useUpdateJourney } from "./hooks/useUpdateJourney"
import { useToastController } from "@tamagui/toast"
import { useLocalSearchParams, useRouter } from "expo-router"
import { NotificationSettings } from "../../NotificationSettings"

export const ModifyJourneyPage: React.FC = () => {
  const { bottom } = useSafeAreaInsets()
  const { journeyId, currentTitle } = useLocalSearchParams<{
    journeyId: string
    currentTitle: string
  }>()
  const [title, setTitle] = useState<string>(currentTitle || "")
  const toast = useToastController()
  const router = useRouter()
  const { updateJourney, isPending } = useUpdateJourney()

  const onUpdate = async () => {
    if (!journeyId) return

    const success = await updateJourney(journeyId, title)
    if (success) {
      toast.show("Your journey has been updated.", {
        type: "success",
        native: false,
      })
      router.back()
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
                onChangeText={setTitle}
              />
            </YStack>

            {/* Notification Settings - auto-saves when changed */}
            {journeyId && (
              <YStack>
                <NotificationSettings journeyId={journeyId} />
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
        disabled={isPending || !title.trim()}
        themeInverse
      >
        {isPending ? "Updating..." : "Update Journey"}
      </Button>
    </>
  )
}
