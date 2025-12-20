import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToastError } from "@/src/hooks/useToastError"

export function useJournalRemove() {
  const { handleError } = useToastError()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation(
    trpc.journal.remove.mutationOptions(),
  )

  return {
    isPending,
    removeEntry: async (entryId: string) => {
      try {
        await mutateAsync({ entryId })
        // Invalidate the journal list query to refetch
        await queryClient.invalidateQueries({
          queryKey: trpc.journal.list.queryKey(),
        })
        return true
      } catch (error) {
        handleError(error, "Failed to remove journal entry.")
      }
      return false
    },
  }
}
