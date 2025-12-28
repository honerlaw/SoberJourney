import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import type { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs"

export type MoodOption = NonNullable<
  AppRouter["checkin"]["getMoods"]["_def"]["$types"]["output"]["moods"][number]
>

export function useMoods() {
  const { report } = useReportError()
  const trpc = useTRPC()

  const { data, error, isLoading } = useQuery(
    trpc.checkin.getMoods.queryOptions(),
  )

  useEffect(() => {
    if (error) {
      report(error)
    }
  }, [error, report])

  return {
    moods: (data?.moods ?? []) as MoodOption[],
    error,
    isLoading,
  }
}
