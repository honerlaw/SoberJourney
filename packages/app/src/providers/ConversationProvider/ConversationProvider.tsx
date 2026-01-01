import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useToastError } from "@/src/hooks/useToastError"
import {
  ConversationContext,
  type Message,
  type Conversation,
  type ConversationListItem,
} from "./ConversationContext"

export const ConversationProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null)

  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { report } = useReportError()
  const { handleError } = useToastError()

  // Get or create conversation mutation
  const {
    mutateAsync: getOrCreateConversationMutation,
    isPending: isInitialCreating,
  } = useMutation(trpc.conversation.getOrCreate.mutationOptions())

  // Create new conversation mutation
  const {
    mutateAsync: createConversationMutation,
    isPending: isCreatingConversation,
  } = useMutation(trpc.conversation.create.mutationOptions())

  // Get conversation query
  const {
    data: conversationData,
    error: conversationError,
    isLoading: isLoadingConversation,
    isRefetching: isRefetchingConversation,
  } = useQuery(
    trpc.conversation.get.queryOptions(
      { conversationId: conversationId ?? "" },
      { enabled: !!conversationId },
    ),
  )

  // List conversations query
  const { data: conversationsData, isLoading: isLoadingConversations } =
    useQuery(trpc.conversation.list.queryOptions())

  // Send message mutation
  const { mutateAsync: sendMessageMutation, isPending: isSending } =
    useMutation(trpc.conversation.sponsorChat.mutationOptions())

  // Report conversation errors
  useEffect(() => {
    if (conversationError) {
      report(conversationError)
    }
  }, [conversationError, report])

  // Clear pending message once it appears in the fetched conversation data
  // This prevents flickering by only clearing after the refetch completes
  useEffect(() => {
    if (pendingMessage && conversationData?.conversation?.messages) {
      const messageExists = conversationData.conversation.messages.some(
        (msg: Message) =>
          msg.role === "user" && msg.content === pendingMessage.content,
      )
      if (messageExists) {
        setPendingMessage(null)
      }
    }
  }, [conversationData?.conversation?.messages, pendingMessage])

  // Initialize conversation on mount
  useEffect(() => {
    const init = async () => {
      try {
        const result = await getOrCreateConversationMutation({})
        if (result?.conversation) {
          setConversationId(result.conversation.id)
        }
      } catch (error) {
        handleError(error, "Failed to initialize conversation.")
      }
    }
    init()
  }, [getOrCreateConversationMutation, handleError, setConversationId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending || !conversationId) return

      // Optimistically add the user message immediately
      const optimisticMessage: Message = {
        id: `pending-${Date.now()}`,
        role: "user",
        content: text.trim(),
        createdAt: new Date(),
      }
      setPendingMessage(optimisticMessage)

      try {
        await sendMessageMutation({ conversationId, text: text.trim() })
        // Invalidate the conversation query to refetch with new messages
        // Note: pendingMessage is cleared by useEffect once the message appears in conversation
        await queryClient.invalidateQueries({
          queryKey: trpc.conversation.get.queryKey({ conversationId }),
        })
      } catch (error) {
        // Clear pending message on error since it won't be added to the conversation
        setPendingMessage(null)
        handleError(error, "Failed to send message.")
      }
    },
    [
      isSending,
      conversationId,
      sendMessageMutation,
      queryClient,
      trpc,
      handleError,
    ],
  )

  const createConversation = useCallback(async () => {
    try {
      const result = await createConversationMutation({})
      if (result?.conversation) {
        setConversationId(result.conversation.id)
      }
      // Invalidate conversation list to update the drawer
      await queryClient.invalidateQueries({
        queryKey: trpc.conversation.list.queryKey(),
      })
    } catch (error) {
      handleError(error, "Failed to create conversation.")
    }
  }, [createConversationMutation, queryClient, trpc, handleError])

  const conversation =
    (conversationData?.conversation as Conversation | null) ?? null

  const conversations = (conversationsData?.conversations ??
    []) as ConversationListItem[]

  const isInitializing = isInitialCreating || (!conversationId && !conversation)
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

  const selectConversation = (id: string) => {
    setConversationId(id)
  }

  const value = {
    conversationId,
    conversation,
    conversations,
    messages,
    sendMessage,
    createConversation,
    selectConversation,
    isSending,
    isCreatingConversation,
    isInitializing,
    isLoading,
    isLoadingConversations,
    isThinking: isSending || isRefetchingConversation,
  }

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  )
}
