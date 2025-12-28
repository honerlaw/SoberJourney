import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs"

type RouterOutput = inferRouterOutputs<AppRouter>

// Infer types from tRPC router outputs
type NotificationDefaultsOutput = RouterOutput["notification"]["getDefaults"]

export type NotificationFrequency =
  NotificationDefaultsOutput["frequencies"][number]["value"]

export type NotificationSettingsValue = {
  enabled: NotificationDefaultsOutput["defaults"]["enabled"]
  frequency: NotificationFrequency
  minuteOfDay: NotificationDefaultsOutput["defaults"]["minuteOfDay"]
}

export type FrequencyOption = {
  value: NotificationFrequency
  label: string
}
