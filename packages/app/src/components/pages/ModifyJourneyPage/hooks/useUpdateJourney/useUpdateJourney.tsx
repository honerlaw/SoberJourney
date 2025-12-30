import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation } from "@tanstack/react-query"
import type { NotificationSettingsValue } from "../../../../NotificationSettings"

export function useUpdateJourney() {
  const trpc = useTRPC()
  const { handleError } = useToastError()

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.update.mutationOptions(),
  )

  return {
    updateJourney: async (
      journeyId: string,
      title: string,
      notificationSettings?: NotificationSettingsValue,
    ) => {
      try {
        await mutateAsync({
          journeyId,
          title,
          notificationSettings: notificationSettings
            ? {
                enabled: notificationSettings.enabled,
                frequency: notificationSettings.frequency,
                minuteOfDay: notificationSettings.minuteOfDay,
              }
            : undefined,
        })
        return true
      } catch (error) {
        handleError(error, "Failed to update journey.")
      }
      return false
    },
    isPending,
  }
}
