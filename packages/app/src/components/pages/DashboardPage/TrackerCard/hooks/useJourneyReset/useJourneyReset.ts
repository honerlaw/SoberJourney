import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation } from "@tanstack/react-query"

export function useJourneyReset() {
  const { handleError } = useToastError()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.reset.mutationOptions(),
  )

  return {
    isPending,
    resetJourney: async (journeyId: string) => {
      try {
        await mutateAsync({ journeyId })
        return true
      } catch (error) {
        handleError(error, "Failed to reset journey.")
      }
      return false
    },
  }
}
