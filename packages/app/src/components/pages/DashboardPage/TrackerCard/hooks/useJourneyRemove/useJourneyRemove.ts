import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation } from "@tanstack/react-query"
import { useToastError } from "@/src/hooks/useToastError"

export function useJourneyRemove() {
  const { handleError } = useToastError()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.remove.mutationOptions(),
  )

  return {
    isPending,
    removeJourney: async (journeyId: string) => {
      try {
        await mutateAsync({ journeyId })
        return true
      } catch (error) {
        handleError(error, "Failed to remove journey.")
      }
      return false
    },
  }
}
