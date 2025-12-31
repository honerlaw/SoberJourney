import { useState, useEffect, useCallback, useMemo } from "react"
import { useCreateConversation } from "../useCreateConversation"
import { useConversation, type Message } from "../useConversation"
import { useSendMessage } from "../useSendMessage"

export function useSponsorChat() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null)

  const { createConversation, isPending: isCreating } = useCreateConversation()
  const {
    conversation,
    isLoading: isLoadingConversation,
    isRefetching: isRefetchingConversation,
  } = useConversation(conversationId)
  const { sendMessage: sendMessageMutation, isPending: isSending } =
    useSendMessage(conversationId)

  // Initialize conversation on mount
  useEffect(() => {
    const init = async () => {
      const conv = await createConversation("Sponsor Chat")
      if (conv) {
        setConversationId(conv.id)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return

      // Optimistically add the user message immediately
      const optimisticMessage: Message = {
        id: `pending-${Date.now()}`,
        role: "user",
        content: text.trim(),
        createdAt: new Date(),
      }
      setPendingMessage(optimisticMessage)

      await sendMessageMutation(text.trim())

      // Clear pending message after response is received
      setPendingMessage(null)
    },
    [isSending, sendMessageMutation],
  )

  const isInitializing = isCreating || (!conversationId && !conversation)
  const isLoading = isLoadingConversation && !conversation

  // Combine conversation messages with pending message
  // Only include pending message if conversation doesn't already have it
  const messages = useMemo(() => {
    const baseMessages = conversation?.messages ?? []
    if (pendingMessage) {
      // Check if the pending message is already in the conversation
      const alreadyExists = baseMessages.some(
        (msg) => msg.role === "user" && msg.content === pendingMessage.content,
      )
      if (!alreadyExists) {
        return [...baseMessages, pendingMessage]
      }
    }
    return baseMessages
  }, [conversation?.messages, pendingMessage])

  return {
    messages,
    sendMessage,
    isSending,
    isInitializing,
    isLoading,
    isThinking: isSending || isRefetchingConversation,
  }
}
