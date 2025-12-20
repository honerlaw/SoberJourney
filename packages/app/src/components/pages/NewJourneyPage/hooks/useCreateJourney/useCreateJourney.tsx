import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation } from "@tanstack/react-query"

export function useCreateJourney() {
  const trpc = useTRPC()
  const { handleError } = useToastError()

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.create.mutationOptions(),
  )

  return {
    createJourney: async (title: string, startDateTime: Date) => {
      try {
        await mutateAsync({
          title,
          startDateTime,
        })
        return true
      } catch (error) {
        handleError(error, "Failed to create journey.")
      }
      return false
    },
    isPending,
  }
}
