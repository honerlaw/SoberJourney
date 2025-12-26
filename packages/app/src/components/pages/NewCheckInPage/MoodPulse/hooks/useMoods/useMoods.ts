import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

export type MoodOption = {
  id: string
  label: string
  icon: string
}

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
