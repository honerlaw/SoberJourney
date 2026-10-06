import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { TRPCClientError } from "@trpc/client"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useToastError } from "@/src/hooks/useToastError"
import {
  ConversationContext,
  type ConversationContextType,
  type ConversationGetOutput,
  type Message,
} from "./ConversationContext"

/** An in-flight send, rendered as an optimistic user bubble until the reply lands. */
type PendingSend = {
  clientId: string
  userMessage: Message
}

/** Delays (ms) after a first message at which the drawer list is refetched to pick up the async title. */
const TITLE_REFRESH_DELAYS_MS = [3_000, 8_000]

const errorCode = (error: unknown): string | undefined =>
  error instanceof TRPCClientError ? error.data?.code : undefined

/** The conversation does not exist for this user, or its id is malformed. */
const isNotFoundError = (error: unknown): boolean => {
  const code = errorCode(error)
  return code === "NOT_FOUND" || code === "BAD_REQUEST"
}

/** Client errors (auth, not found, validation) never succeed on retry. */
const NON_RETRYABLE_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
])

const createClientId = (): string =>
  `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const ConversationProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [pendingByConversation, setPendingByConversation] = useState<
    Record<string, PendingSend>
  >({})
  const [failedDrafts, setFailedDrafts] = useState<Record<string, string>>({})
  const [initError, setInitError] = useState<unknown>(null)

  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { report } = useReportError()
  const { handleError } = useToastError()

  // Read through refs so no effect or callback depends on these identities
  // (useToastError returns a new handleError every render).
  const handleErrorRef = useRef(handleError)
  handleErrorRef.current = handleError
  const reportRef = useRef(report)
  reportRef.current = report
  const conversationIdRef = useRef<string | null>(null)
  conversationIdRef.current = conversationId
  // Synchronous mirror of pendingByConversation: the double-send guard.
  const pendingRef = useRef<Record<string, PendingSend>>({})
  const initStartedRef = useRef(false)
  const titleTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const timers = titleTimersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  /**
   * Shows an error toast. Never throws: the toast hook can itself throw on
   * some error shapes, and a throw here must not break a send's contract.
   */
  const showError = useCallback((error: unknown, fallbackMessage: string) => {
    try {
      handleErrorRef.current(error, fallbackMessage)
    } catch (toastError) {
      reportRef.current(error, fallbackMessage)
      reportRef.current(toastError)
    }
  }, [])

  const updatePending = useCallback(
    (
      update: (
        prev: Record<string, PendingSend>,
      ) => Record<string, PendingSend>,
    ) => {
      pendingRef.current = update(pendingRef.current)
      setPendingByConversation(pendingRef.current)
    },
    [],
  )

  const { mutateAsync: getOrCreateConversationMutation } = useMutation(
    trpc.conversation.getOrCreate.mutationOptions(),
  )

  const {
    mutateAsync: createConversationMutation,
    isPending: isCreatingConversation,
  } = useMutation(trpc.conversation.create.mutationOptions())

  // Freshness is explicit (select / retry / failed send), never on
  // mount/focus/reconnect, so a send never triggers a full refetch and nothing
  // can refetch a conversation while one of its sends is in flight.
  const {
    data: conversationData,
    error: conversationError,
    isLoading: isLoadingConversation,
    refetch: refetchConversation,
  } = useQuery(
    trpc.conversation.get.queryOptions(
      { conversationId: conversationId ?? "" },
      {
        enabled: !!conversationId,
        staleTime: Infinity,
        retry: (failureCount, error) => {
          const code = errorCode(error)
          return !(code && NON_RETRYABLE_CODES.has(code)) && failureCount < 3
        },
      },
    ),
  )

  const { data: conversationsData, isLoading: isLoadingConversations } =
    useQuery(trpc.conversation.list.queryOptions())

  const { mutateAsync: sendMessageMutation } = useMutation(
    trpc.conversation.sponsorChat.mutationOptions(),
  )

  useEffect(() => {
    if (conversationError) {
      report(conversationError)
    }
  }, [conversationError, report])

  const runInit = useCallback(async () => {
    try {
      const result = await getOrCreateConversationMutation({})
      const id = result?.conversation?.id
      if (!id) throw new Error("Failed to get or create conversation.")
      // Never override a conversation the user picked in the meantime.
      setConversationId((current) => current ?? id)
    } catch (error) {
      // Irrelevant once the user has picked a conversation from the drawer.
      if (conversationIdRef.current) return
      setInitError(error)
      showError(error, "Failed to load your conversation.")
    }
  }, [getOrCreateConversationMutation, showError])

  /** Lazily resolves the initial conversation. Runs once (StrictMode-safe). */
  const initialize = useCallback(() => {
    if (initStartedRef.current) return
    initStartedRef.current = true
    void runInit()
  }, [runInit])

  const retryInitialize = useCallback(() => {
    setInitError(null)
    initStartedRef.current = true
    void runInit()
  }, [runInit])

  const conversationQueryKey = useCallback(
    (id: string) => trpc.conversation.get.queryKey({ conversationId: id }),
    [trpc],
  )

  const refreshListForTitle = useCallback(() => {
    for (const delay of TITLE_REFRESH_DELAYS_MS) {
      const timer = setTimeout(() => {
        titleTimersRef.current.delete(timer)
        void queryClient.invalidateQueries({
          queryKey: trpc.conversation.list.queryKey(),
        })
      }, delay)
      titleTimersRef.current.add(timer)
    }
  }, [queryClient, trpc])

  const sendMessage = useCallback(
    async (rawText: string): Promise<boolean> => {
      const text = rawText.trim()
      const targetId = conversationId
      if (!text || !targetId || pendingRef.current[targetId]) return false

      const queryKey = conversationQueryKey(targetId)
      const before = queryClient.getQueryData<ConversationGetOutput>(queryKey)
      if (!before?.conversation) return false
      const hadTitle = !!before.conversation.title

      const clientId = createClientId()
      const userMessage: Message = {
        id: clientId,
        role: "USER",
        content: text,
        createdAt: new Date(),
      }
      updatePending((prev) => ({
        ...prev,
        [targetId]: { clientId, userMessage },
      }))
      void queryClient.cancelQueries({ queryKey })

      try {
        // Only the long-standing `response` field is read, so this works
        // against servers with or without additive response fields.
        const result = await sendMessageMutation({
          conversationId: targetId,
          text,
        })
        const reply: Message = {
          id: `${clientId}-reply`,
          role: "MODEL",
          content: result.response,
          createdAt: new Date(),
        }

        // The user message enters the cache under the same clientId as the
        // pending bubble, so the merged list never shows it twice or drops it,
        // whichever of these two updates renders first. If the entry was
        // garbage-collected (nobody is viewing X), this is a no-op and the next
        // open of X fetches the persisted messages.
        queryClient.setQueryData<ConversationGetOutput>(queryKey, (old) =>
          old?.conversation
            ? {
                ...old,
                conversation: {
                  ...old.conversation,
                  updatedAt: new Date(),
                  messages: [...old.conversation.messages, userMessage, reply],
                },
              }
            : old,
        )
        updatePending((prev) => {
          const next = { ...prev }
          delete next[targetId]
          return next
        })
        setFailedDrafts((prev) => {
          if (!(targetId in prev)) return prev
          const next = { ...prev }
          delete next[targetId]
          return next
        })

        void queryClient.invalidateQueries({
          queryKey: trpc.conversation.list.queryKey(),
        })
        if (!hadTitle) {
          refreshListForTitle()
        }
        return true
      } catch (error) {
        updatePending((prev) => {
          const next = { ...prev }
          delete next[targetId]
          return next
        })
        setFailedDrafts((prev) => ({ ...prev, [targetId]: text }))
        // A server that persists the user message before generating may have
        // saved it even though the reply failed; show what the server has.
        void queryClient.refetchQueries({ queryKey }).catch(() => undefined)
        showError(error, "Failed to send message.")
        return false
      }
    },
    [
      conversationId,
      conversationQueryKey,
      queryClient,
      sendMessageMutation,
      trpc,
      updatePending,
      refreshListForTitle,
      showError,
    ],
  )

  const clearFailedDraft = useCallback((id: string) => {
    setFailedDrafts((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const conversation = conversationData?.conversation ?? null
  const conversations = useMemo(
    () => conversationsData?.conversations ?? [],
    [conversationsData?.conversations],
  )

  const currentPending = conversationId
    ? pendingByConversation[conversationId]
    : undefined

  const createConversation = useCallback(async () => {
    // Reuse the current conversation if it is still empty.
    if (
      conversationId &&
      conversation &&
      conversation.id === conversationId &&
      conversation.messages.length === 0 &&
      !pendingRef.current[conversationId]
    ) {
      return
    }
    try {
      const result = await createConversationMutation({})
      if (result?.conversation) {
        setConversationId(result.conversation.id)
        setInitError(null)
      }
      await queryClient.invalidateQueries({
        queryKey: trpc.conversation.list.queryKey(),
      })
    } catch (error) {
      showError(error, "Failed to create conversation.")
    }
  }, [
    conversationId,
    conversation,
    createConversationMutation,
    queryClient,
    trpc,
    showError,
  ])

  const selectConversation = useCallback(
    (id: string) => {
      setConversationId(id)
      setInitError(null)
      // Reconcile an already-cached conversation with the server, unless a send
      // for it is in flight. An uncached one is fetched by the query itself.
      const queryKey = conversationQueryKey(id)
      if (!pendingRef.current[id] && queryClient.getQueryData(queryKey)) {
        void queryClient
          .refetchQueries({ queryKey }, { cancelRefetch: false })
          .catch(() => undefined)
      }
    },
    [conversationQueryKey, queryClient],
  )

  const retryConversation = useCallback(() => {
    void refetchConversation()
  }, [refetchConversation])

  // Merge cached messages with this conversation's pending bubble (id-keyed).
  const messages = useMemo(() => {
    const base = conversation?.messages ?? []
    if (!currentPending) return base
    if (base.some((msg) => msg.id === currentPending.clientId)) return base
    return [...base, currentPending.userMessage]
  }, [conversation?.messages, currentPending])

  const isSending = !!currentPending
  // True until a conversation is selected (SponsorPage triggers initialize on
  // mount), false once init has failed so the error view can render.
  const isInitializing = !conversationId && !initError
  const isLoading = isLoadingConversation && !conversation

  const value: ConversationContextType = {
    conversationId,
    conversation,
    conversations,
    messages,
    sendMessage,
    createConversation,
    selectConversation,
    initialize,
    retryInitialize,
    retryConversation,
    failedDrafts,
    clearFailedDraft,
    isSending,
    isCreatingConversation,
    isInitializing,
    initError,
    isLoading,
    conversationError,
    isConversationNotFound: isNotFoundError(conversationError),
    isLoadingConversations,
    isThinking: isSending,
  }

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  )
}
