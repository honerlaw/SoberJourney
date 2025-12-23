import { useToastError } from "@/src/hooks/useToastError"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useSendMessage(conversationId: string | null) {
  const trpc = useTRPC()
  const { handleError } = useToastError()
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation(
    trpc.conversation.sponsorChat.mutationOptions(),
  )

  return {
    sendMessage: async (text: string) => {
      if (!conversationId) {
        return null
      }
      try {
        const result = await mutateAsync({ conversationId, text })
        // Invalidate the conversation query to refetch with new messages
        await queryClient.invalidateQueries({
          queryKey: trpc.conversation.get.queryKey({ conversationId }),
        })
        return result.response
      } catch (error) {
        handleError(error, "Failed to send message.")
        return null
      }
    },
    isPending,
  }
}
