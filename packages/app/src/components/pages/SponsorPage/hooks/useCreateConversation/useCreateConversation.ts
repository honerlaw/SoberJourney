import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation } from "@tanstack/react-query"

export function useCreateConversation() {
  const trpc = useTRPC()
  const { handleError } = useToastError()

  const { mutateAsync, isPending, data } = useMutation(
    trpc.conversation.create.mutationOptions(),
  )

  return {
    createConversation: async (title?: string) => {
      try {
        const result = await mutateAsync({ title })
        return result.conversation
      } catch (error) {
        handleError(error, "Failed to create conversation.")
        return null
      }
    },
    isPending,
    conversation: data?.conversation ?? null,
  }
}
