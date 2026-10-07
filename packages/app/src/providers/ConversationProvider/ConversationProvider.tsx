import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { TRPCClientError } from "@trpc/client"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useToastError } from "@/src/hooks/useToastError"
import {
  ConversationContext,
  type ConversationContextType,
  type Message,
} from "./ConversationContext"
import {
  appendToNewestPage,
  conversationFromPages,
  createPendingId,
  flattenConversations,
  flattenMessages,
  classifyFailedSend,
  mergePending,
  nextConversationAfterDelete,
  nextListCursor,
  nextMessagesCursor,
  removeFromList,
  renameInList,
  retryableMessageId as getRetryableMessageId,
  serverMessageIds,
  setConversationTitle,
  trimToNewestPage,
  type ConversationListPages,
  type ConversationPages,
} from "./conversationCache"

/**
 * An in-flight send (rendered as an optimistic user bubble until the reply
 * lands) or retry (no bubble: the user message is already shown).
 */
type PendingSend = {
  clientId: string
  userMessage?: Message
}

/** Delays (ms) after a first message at which the drawer list is refetched to pick up the async title. */
const TITLE_REFRESH_DELAYS_MS = [3_000, 8_000]

/** Messages per `conversation.get` page; older pages load on scroll up. */
const MESSAGE_PAGE_SIZE = 30
/** Drawer entries per `conversation.list` page. */
const LIST_PAGE_SIZE = 20

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

  // Read through refs so no effect or callback depends on these identities.
  const handleErrorRef = useRef(handleError)
  handleErrorRef.current = handleError
  const reportRef = useRef(report)
  reportRef.current = report
  const conversationIdRef = useRef<string | null>(null)
  conversationIdRef.current = conversationId
  // Synchronous mirror of pendingByConversation: the double-send guard.
  const pendingRef = useRef<Record<string, PendingSend>>({})
  const initStartedRef = useRef(false)
  // Conversations whose newest page is being refetched (older-page loads wait).
  const refreshingRef = useRef(new Set<string>())
  const titleTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const timers = titleTimersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  /**
   * Shows an error toast. Never throws: a throw here must not break a send's
   * contract.
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

  const clearPending = useCallback(
    (id: string) =>
      updatePending((prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }),
    [updatePending],
  )

  const { mutateAsync: getOrCreateConversationMutation } = useMutation(
    trpc.conversation.getOrCreate.mutationOptions(),
  )

  const {
    mutateAsync: createConversationMutation,
    isPending: isCreatingConversation,
  } = useMutation(trpc.conversation.create.mutationOptions())

  const { mutateAsync: removeConversationMutation } = useMutation(
    trpc.conversation.remove.mutationOptions(),
  )

  const { mutateAsync: renameConversationMutation } = useMutation(
    trpc.conversation.rename.mutationOptions(),
  )

  const { mutateAsync: sendMessageMutation } = useMutation(
    trpc.conversation.sponsorChat.mutationOptions(),
  )

  const { mutateAsync: retryMessageMutation } = useMutation(
    trpc.conversation.retrySponsorChat.mutationOptions(),
  )

  // Freshness is explicit (select / retry / failed send), never on
  // mount/focus/reconnect, so a send never triggers a refetch and nothing can
  // refetch a conversation while one of its sends is in flight. Pages are
  // newest first; older ones load on scroll up.
  const {
    data: conversationData,
    error: conversationError,
    isLoading: isLoadingConversation,
    hasNextPage: hasOlderMessages,
    isFetchingNextPage: isLoadingOlderMessages,
    fetchNextPage: fetchOlderMessages,
    refetch: refetchConversation,
  } = useInfiniteQuery(
    trpc.conversation.get.infiniteQueryOptions(
      { conversationId: conversationId ?? "", limit: MESSAGE_PAGE_SIZE },
      {
        enabled: !!conversationId,
        staleTime: Infinity,
        getNextPageParam: nextMessagesCursor,
        retry: (failureCount, error) => {
          const code = errorCode(error)
          return !(code && NON_RETRYABLE_CODES.has(code)) && failureCount < 3
        },
      },
    ),
  )

  const {
    data: conversationsData,
    isLoading: isLoadingConversations,
    hasNextPage: hasMoreConversations,
    isFetchingNextPage: isLoadingMoreConversations,
    fetchNextPage: fetchMoreConversations,
  } = useInfiniteQuery(
    trpc.conversation.list.infiniteQueryOptions(
      { limit: LIST_PAGE_SIZE },
      { getNextPageParam: nextListCursor },
    ),
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
    (id: string) =>
      trpc.conversation.get.infiniteQueryKey({
        conversationId: id,
        limit: MESSAGE_PAGE_SIZE,
      }),
    [trpc],
  )

  const listQueryKey = useMemo(
    () => trpc.conversation.list.infiniteQueryKey({ limit: LIST_PAGE_SIZE }),
    [trpc],
  )

  const invalidateList = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: trpc.conversation.list.pathKey(),
      }),
    [queryClient, trpc],
  )

  /**
   * Refetches a conversation from its newest page only (one request however
   * far the user scrolled). Resolves the refreshed cache entry; never rejects.
   */
  const refreshConversation = useCallback(
    async (id: string): Promise<ConversationPages | undefined> => {
      const queryKey = conversationQueryKey(id)
      if (!queryClient.getQueryData(queryKey)) return undefined
      refreshingRef.current.add(id)
      try {
        // Cancel an in-flight load of older pages first: a refetch would
        // otherwise join it and resolve with the old newest page.
        await queryClient.cancelQueries({ queryKey })
        queryClient.setQueryData<ConversationPages>(queryKey, (old) =>
          trimToNewestPage(old),
        )
        await queryClient
          .refetchQueries({ queryKey }, { cancelRefetch: true })
          .catch(() => undefined)
      } finally {
        refreshingRef.current.delete(id)
      }
      const state = queryClient.getQueryState(queryKey)
      return state?.status === "success" && !state.error
        ? queryClient.getQueryData<ConversationPages>(queryKey)
        : undefined
    },
    [conversationQueryKey, queryClient],
  )

  const refreshListForTitle = useCallback(() => {
    for (const delay of TITLE_REFRESH_DELAYS_MS) {
      const timer = setTimeout(() => {
        titleTimersRef.current.delete(timer)
        void invalidateList()
      }, delay)
      titleTimersRef.current.add(timer)
    }
  }, [invalidateList])

  const clearFailedDraft = useCallback((id: string) => {
    setFailedDrafts((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const sendMessage = useCallback(
    async (rawText: string): Promise<boolean> => {
      const text = rawText.trim()
      const targetId = conversationId
      if (!text || !targetId || pendingRef.current[targetId]) return false

      const queryKey = conversationQueryKey(targetId)
      const before = queryClient.getQueryData<ConversationPages>(queryKey)
      const beforeConversation = conversationFromPages(before)
      if (!beforeConversation) return false
      const hadTitle = !!beforeConversation.title
      const knownServerIds = serverMessageIds(beforeConversation.messages)

      const clientId = createPendingId()
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
        queryClient.setQueryData<ConversationPages>(queryKey, (old) =>
          appendToNewestPage(old, [userMessage, reply]),
        )
        clearPending(targetId)
        clearFailedDraft(targetId)

        void invalidateList()
        if (!hadTitle) {
          refreshListForTitle()
        }
        return true
      } catch (error) {
        // The server persists the user message before generating, so it may
        // have saved it (and even the reply) although the call failed. Check
        // (newest page only) while the pending bubble is still shown; restore
        // the typed text only when the server did not keep a new copy of it.
        const after = await refreshConversation(targetId)
        const outcome = after
          ? classifyFailedSend(flattenMessages(after), text, knownServerIds)
          : "not-saved"
        clearPending(targetId)
        if (outcome === "not-saved") {
          showError(error, "Failed to send message.")
          setFailedDrafts((prev) => ({ ...prev, [targetId]: text }))
          return false
        }
        // The message is on the server, so the input clears as for a
        // successful send (re-sending would duplicate it). Without a reply it
        // is shown with a Retry action.
        if (outcome === "saved-unanswered") {
          showError(error, "Your message was saved, but no reply came back.")
        }
        clearFailedDraft(targetId)
        void invalidateList()
        if (!hadTitle) {
          refreshListForTitle()
        }
        return true
      }
    },
    [
      conversationId,
      conversationQueryKey,
      queryClient,
      sendMessageMutation,
      updatePending,
      clearPending,
      clearFailedDraft,
      invalidateList,
      refreshListForTitle,
      refreshConversation,
      showError,
    ],
  )

  const retryMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      const targetId = conversationId
      if (!targetId || pendingRef.current[targetId]) return false

      const queryKey = conversationQueryKey(targetId)
      const hadTitle = !!conversationFromPages(
        queryClient.getQueryData<ConversationPages>(queryKey),
      )?.title
      const clientId = createPendingId()
      updatePending((prev) => ({ ...prev, [targetId]: { clientId } }))
      void queryClient.cancelQueries({ queryKey })

      try {
        const result = await retryMessageMutation({
          conversationId: targetId,
          messageId,
        })
        const reply: Message = {
          id: result.modelMessageId || `${clientId}-reply`,
          role: "MODEL",
          content: result.response,
          createdAt: new Date(),
        }
        queryClient.setQueryData<ConversationPages>(queryKey, (old) =>
          appendToNewestPage(old, [reply]),
        )
        clearPending(targetId)
        void invalidateList()
        if (!hadTitle) {
          refreshListForTitle()
        }
        return true
      } catch (error) {
        // A CONFLICT means the message was answered meanwhile (e.g. on another
        // device): the refetch shows that reply.
        if (errorCode(error) !== "CONFLICT") {
          showError(error, "Failed to get a reply.")
        }
        await refreshConversation(targetId)
        clearPending(targetId)
        return false
      }
    },
    [
      conversationId,
      conversationQueryKey,
      queryClient,
      retryMessageMutation,
      updatePending,
      clearPending,
      invalidateList,
      refreshListForTitle,
      refreshConversation,
      showError,
    ],
  )

  const conversation = useMemo(
    () => conversationFromPages(conversationData),
    [conversationData],
  )
  const conversations = useMemo(
    () => flattenConversations(conversationsData),
    [conversationsData],
  )
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations

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
      await invalidateList()
    } catch (error) {
      showError(error, "Failed to create conversation.")
    }
  }, [
    conversationId,
    conversation,
    createConversationMutation,
    invalidateList,
    showError,
  ])

  const selectConversation = useCallback(
    (id: string) => {
      setConversationId(id)
      setInitError(null)
      // Reconcile an already-cached conversation with the server, unless a send
      // for it is in flight. An uncached one is fetched by the query itself.
      if (!pendingRef.current[id]) {
        void refreshConversation(id)
      }
    },
    [refreshConversation],
  )

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      if (pendingRef.current[id]) return false
      try {
        await removeConversationMutation({ conversationId: id })
      } catch (error) {
        // NOT_FOUND usually means it was already deleted (e.g. on another
        // device), but the server also reports database errors (and an older
        // server an unknown procedure) as NOT_FOUND. Only treat it as deleted
        // when a fresh list no longer contains it.
        const stillListed =
          isNotFoundError(error) &&
          (await queryClient
            .fetchInfiniteQuery(
              trpc.conversation.list.infiniteQueryOptions(
                { limit: LIST_PAGE_SIZE },
                { getNextPageParam: nextListCursor, staleTime: 0 },
              ),
            )
            .then((fresh) =>
              flattenConversations(fresh).some((c) => c.id === id),
            )
            .catch(() => true))
        if (!isNotFoundError(error) || stillListed) {
          showError(error, "Failed to delete conversation.")
          return false
        }
      }

      const next = nextConversationAfterDelete(conversationsRef.current, id)
      queryClient.setQueryData<ConversationListPages>(listQueryKey, (old) =>
        removeFromList(old, id),
      )
      queryClient.removeQueries({ queryKey: conversationQueryKey(id) })
      clearFailedDraft(id)

      if (conversationIdRef.current === id) {
        if (next) {
          selectConversation(next)
        } else {
          // Nothing left: start fresh (getOrCreate returns the most recent
          // remaining conversation, or a new empty one).
          setConversationId(null)
          setInitError(null)
          initStartedRef.current = true
          void runInit()
        }
      }
      void invalidateList()
      return true
    },
    [
      removeConversationMutation,
      showError,
      queryClient,
      trpc,
      listQueryKey,
      conversationQueryKey,
      clearFailedDraft,
      selectConversation,
      runInit,
      invalidateList,
    ],
  )

  const renameConversation = useCallback(
    async (id: string, rawTitle: string): Promise<boolean> => {
      const title = rawTitle.trim()
      if (!title) return false
      try {
        const result = await renameConversationMutation({
          conversationId: id,
          title,
        })
        const saved = result.conversation.title ?? title
        queryClient.setQueryData<ConversationListPages>(listQueryKey, (old) =>
          renameInList(old, id, saved),
        )
        queryClient.setQueryData<ConversationPages>(
          conversationQueryKey(id),
          (old) => setConversationTitle(old, saved),
        )
        void invalidateList()
        return true
      } catch (error) {
        showError(error, "Failed to rename conversation.")
        return false
      }
    },
    [
      renameConversationMutation,
      queryClient,
      listQueryKey,
      conversationQueryKey,
      invalidateList,
      showError,
    ],
  )

  const isConversationBusy = useCallback(
    (id: string) => !!pendingByConversation[id],
    [pendingByConversation],
  )

  const retryConversation = useCallback(() => {
    const id = conversationIdRef.current
    if (id && queryClient.getQueryData(conversationQueryKey(id))) {
      void refreshConversation(id)
    } else {
      void refetchConversation()
    }
  }, [
    queryClient,
    conversationQueryKey,
    refreshConversation,
    refetchConversation,
  ])

  const loadOlderMessages = useCallback(() => {
    const id = conversationIdRef.current
    // Never while a send/retry/refresh is in flight: a page fetch writes back
    // the pages it started from, dropping an append made meanwhile.
    if (
      !id ||
      pendingRef.current[id] ||
      refreshingRef.current.has(id) ||
      !hasOlderMessages ||
      isLoadingOlderMessages
    ) {
      return
    }
    void fetchOlderMessages().catch(() => undefined)
  }, [hasOlderMessages, isLoadingOlderMessages, fetchOlderMessages])

  const loadMoreConversations = useCallback(() => {
    if (hasMoreConversations && !isLoadingMoreConversations) {
      void fetchMoreConversations().catch(() => undefined)
    }
  }, [hasMoreConversations, isLoadingMoreConversations, fetchMoreConversations])

  // Merge cached messages with this conversation's pending bubble (id-keyed).
  const messages = useMemo(
    () =>
      mergePending(conversation?.messages ?? [], currentPending?.userMessage),
    [conversation?.messages, currentPending],
  )

  const isSending = !!currentPending
  const retryableMessageId = useMemo(
    () => getRetryableMessageId(messages, isSending),
    [messages, isSending],
  )
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
    retryableMessageId,
    retryMessage,
    deleteConversation,
    renameConversation,
    isConversationBusy,
    hasOlderMessages: !!hasOlderMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    hasMoreConversations: !!hasMoreConversations,
    isLoadingMoreConversations,
    loadMoreConversations,
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
