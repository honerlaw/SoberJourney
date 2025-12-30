import { useTRPC } from "@/src/providers/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import type { NotificationSettingsValue } from "../../types"

export function useNotificationSettingsForJourney(
  journeyId: string | undefined,
) {
  const trpc = useTRPC()

  const queryOptions = trpc.notification.getSettingsForJourney.queryOptions(
    { journeyId: journeyId ?? "" },
    { enabled: !!journeyId },
  )

  const { data, isLoading, error } = useQuery(queryOptions)

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
  }
}
