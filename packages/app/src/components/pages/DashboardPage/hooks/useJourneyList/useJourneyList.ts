import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect } from "react"

export function useJourneyList() {
  const { report } = useReportError()
  const trpc = useTRPC()

  const { data, error, isLoading, isRefetching, refetch } = useQuery(
    trpc.journey.list.queryOptions(),
  )

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch]),
  )

  useEffect(() => {
    if (error) {
      report(error)
    }
  }, [error, report])

  return {
    journeys: data?.journeys ?? [],
    error,
    isLoading: isLoading && !isRefetching,
    refetch,
  }
}
