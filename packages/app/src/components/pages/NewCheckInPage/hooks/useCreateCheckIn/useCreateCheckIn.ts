import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation } from "@tanstack/react-query"
import { MoodOption } from "../../MoodPulse/hooks"

type CreateCheckInInput = {
  journeyId: string
  mood: MoodOption
  urgeStrength: number
  journalEntry?: string | null
}

export function useCreateCheckIn() {
  const trpc = useTRPC()
  const { handleError } = useToastError()

  const { mutateAsync, isPending } = useMutation(
    trpc.checkin.create.mutationOptions(),
  )

  return {
    createCheckIn: async (input: CreateCheckInInput) => {
      try {
        await mutateAsync({
          journeyId: input.journeyId,
          mood: input.mood.id,
          urgeStrength: input.urgeStrength,
          journalEntry: input.journalEntry,
        })
        return true
      } catch (error) {
        handleError(error, "Failed to create check-in.")
      }
      return false
    },
    isPending,
  }
}
