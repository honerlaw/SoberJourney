import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect } from "react"
import { isNotFoundError } from "../../utils/isNotFoundError"

export function useJourneyInfo(journeyId: string) {
  const { report } = useReportError()
  const trpc = useTRPC()

  const { data, error, isLoading, isRefetching, refetch } = useQuery(
    trpc.journey.get.queryOptions(
      { journeyId },
      {
        enabled: !!journeyId,
        // A deleted journey (stale deep link) won't come back: don't retry
        retry: (failureCount, err) => !isNotFoundError(err) && failureCount < 3,
      },
    ),
  )

  useFocusEffect(
    useCallback(() => {
      if (journeyId) {
        refetch()
      }
    }, [journeyId, refetch]),
  )

  useEffect(() => {
    // NOT_FOUND is an expected outcome (rendered as JourneyNotFoundView)
    if (error && !isNotFoundError(error)) {
      report(error)
    }
  }, [error, report])

  return {
    journey: data?.journey ?? null,
    error,
    isLoading: isLoading && !isRefetching,
    refetch,
  }
}
