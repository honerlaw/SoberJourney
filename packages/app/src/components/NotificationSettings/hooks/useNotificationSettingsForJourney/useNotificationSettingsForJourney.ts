import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { NotificationSettingsValue } from "../../types"

export function useNotificationSettingsForJourney(
  journeyId: string | undefined,
) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { handleError } = useToastError()

  const queryOptions = trpc.notification.getSettingsForJourney.queryOptions(
    { journeyId: journeyId ?? "" },
    { enabled: !!journeyId },
  )

  const { data, isLoading, error } = useQuery(queryOptions)

  const { mutateAsync, isPending: isUpdating } = useMutation(
    trpc.notification.updateForJourney.mutationOptions({
      onSuccess: () => {
        // Invalidate the query to refetch the latest data
        queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
      },
    }),
  )

  const updateNotificationSettings = async (
    settings: NotificationSettingsValue,
  ): Promise<boolean> => {
    if (!journeyId) return false

    try {
      await mutateAsync({
        journeyId,
        settings: {
          enabled: settings.enabled,
          frequency: settings.frequency,
          minuteOfDay: settings.minuteOfDay,
        },
      })
      return true
    } catch (err) {
      handleError(err, "Failed to update notification settings.")
      return false
    }
  }

  const notificationSettings: NotificationSettingsValue | undefined = data
    ? {
        enabled: data.notificationSettings.enabled,
        frequency: data.notificationSettings
          .frequency as NotificationSettingsValue["frequency"],
        minuteOfDay: data.notificationSettings.minuteOfDay,
      }
    : undefined

  return {
    notificationSettings,
    isLoading,
    error,
    updateNotificationSettings,
    isUpdating,
  }
}
