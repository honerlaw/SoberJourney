import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation } from "@tanstack/react-query"
import type { NotificationSettingsValue } from "../../../../NotificationSettings"

export function useCreateJourney() {
  const trpc = useTRPC()
  const { handleError } = useToastError()

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.create.mutationOptions(),
  )

  return {
    createJourney: async (
      title: string,
      startDateTime: Date,
      notificationSettings?: NotificationSettingsValue,
    ) => {
      try {
        await mutateAsync({
          title,
          startDateTime,
          notificationSettings: notificationSettings
            ? {
                frequency: notificationSettings.frequency,
                minuteOfDay: notificationSettings.minuteOfDay,
              }
            : undefined,
        })
        return true
      } catch (error) {
        handleError(error, "Failed to create journey.")
      }
      return false
    },
    isPending,
  }
}
