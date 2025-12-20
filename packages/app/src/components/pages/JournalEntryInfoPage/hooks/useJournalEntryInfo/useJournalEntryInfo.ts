import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import { useFocusEffect } from "expo-router"
import { useEffect } from "react"

type JournalEntryInfo = {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export function useJournalEntryInfo(entryId: string) {
  const { report } = useReportError()
  const trpc = useTRPC()

  const { data, error, isLoading, isRefetching, refetch } = useQuery(
    trpc.journal.get.queryOptions({ entryId }, { enabled: !!entryId }),
  )

  useFocusEffect(() => {
    if (entryId) {
      refetch()
    }
  })

  useEffect(() => {
    if (error) {
      report(error)
    }
  }, [error, report])

  const typedData = data as { entry: JournalEntryInfo } | undefined

  return {
    entry: typedData?.entry ?? null,
    error,
    isLoading: isLoading && !isRefetching,
    refetch,
  }
}
