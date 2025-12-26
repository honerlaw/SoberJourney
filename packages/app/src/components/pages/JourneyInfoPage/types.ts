import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs"

type RouterOutput = inferRouterOutputs<AppRouter>

// Infer types from tRPC router outputs
export type JourneyGetOutput = RouterOutput["journey"]["get"]
export type JourneyInfo = JourneyGetOutput["journey"]
export type JourneyEntry = JourneyInfo["entries"][number]

export type CheckInGetEntriesOutput = RouterOutput["checkin"]["getEntries"]
export type CheckInEntry = CheckInGetEntriesOutput["entries"][number]

// UI-specific types
export type TabValue = "resets" | "checkins"

export type DurationSection = {
  value: number
  max: number
  label: string
  singularLabel: string
}
