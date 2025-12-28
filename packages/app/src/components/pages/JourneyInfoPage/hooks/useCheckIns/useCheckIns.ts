import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import { useFocusEffect } from "expo-router"
import { useEffect } from "react"

export function useCheckIns(journeyId: string) {
  const { report } = useReportError()
  const trpc = useTRPC()

  const { data, error, isLoading, isRefetching, refetch } = useQuery(
    trpc.checkin.getEntries.queryOptions(
      { journeyId },
      { enabled: !!journeyId },
    ),
  )

  useFocusEffect(() => {
    if (journeyId) {
      refetch()
    }
  })

  useEffect(() => {
    if (error) {
      report(error)
    }
  }, [error, report])

  return {
    entries: data?.entries ?? [],
    error,
    isLoading: isLoading && !isRefetching,
    refetch,
  }
}
