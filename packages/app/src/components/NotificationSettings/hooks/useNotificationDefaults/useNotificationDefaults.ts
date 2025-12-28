import { useTRPC } from "@/src/providers/TRPCProvider"
import { useQuery } from "@tanstack/react-query"

export function useNotificationDefaults() {
  const trpc = useTRPC()

  const { data, isLoading, error } = useQuery(
    trpc.notification.getDefaults.queryOptions(),
  )

  return {
    defaults: data?.defaults,
    frequencies: data?.frequencies,
    isLoading,
    error,
  }
}
