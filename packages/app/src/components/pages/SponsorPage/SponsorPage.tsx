import { YStack, Spinner } from "tamagui"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { FlatList, type ListRenderItem } from "react-native"
import { useNavigation } from "expo-router"

import { LoadingView } from "@/src/components/LoadingView"
import { useConversation } from "@/src/providers/ConversationProvider"
import { useKeyboardHeight } from "./hooks/useKeyboardHeight"
import { useInputBottomPadding } from "./hooks/useInputBottomPadding"
import { MessageBubble } from "./MessageBubble"
import { ChatInput } from "./ChatInput"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { EmptyChatView } from "./EmptyChatView"
import { ChatErrorView } from "./ChatErrorView"
import { RetryNotice } from "./RetryNotice"
import type { Message } from "@/src/providers/ConversationProvider"
import { LIST_PLACEHOLDER_TITLE } from "@/src/providers/ConversationProvider/conversationCache"

/** The Sponsor header title until a conversation title is known (`sponsor/_layout.tsx`). */
export const SPONSOR_HEADER_TITLE = "Sponsor"
/** Vertical space between message bubbles. */
const MESSAGE_SPACING = 12

export const SponsorPage: React.FC = () => {
  const listRef = useRef<FlatList<Message>>(null)
  const keyboardHeight = useKeyboardHeight()
  const { bottomPadding: inputBottomPadding, onRootLayout, rootRef } =
    useInputBottomPadding(keyboardHeight)
  const navigation = useNavigation()

  const {
    conversationId,
    conversation,
    conversations,
    messages,
    sendMessage,
    initialize,
    retryInitialize,
    retryConversation,
    createConversation,
    failedDrafts,
    clearFailedDraft,
    isSending,
    isCreatingConversation,
    isInitializing,
    initError,
    isLoading,
    conversationError,
    isConversationNotFound,
    isThinking,
    canCancelReply,
    cancelReply,
    retryableMessageId,
    retryMessage,
    hasOlderMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
  } = useConversation()

  // Resolve the initial conversation only once the user opens Sponsor.
  useEffect(() => {
    initialize()
  }, [initialize])

  // The `get` cache is not refetched after a send, so a title generated after
  // the first message arrives through the (refreshed) drawer list instead.
  // The list substitutes this placeholder for a missing title.
  const listTitle = conversations.find((c) => c.id === conversationId)?.title
  const headerTitle =
    conversation?.title ||
    (listTitle && listTitle !== LIST_PLACEHOLDER_TITLE ? listTitle : null) ||
    SPONSOR_HEADER_TITLE
  useEffect(() => {
    navigation.setOptions({ headerTitle })
  }, [navigation, headerTitle])

  // The list is inverted (newest message at the bottom, offset 0), so it
  // stays anchored at the newest message on its own. Jump back there when a
  // send or retry starts, in case the user had scrolled up.
  useEffect(() => {
    if (!isSending) return
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [isSending])

  // Inverted list data: newest first.
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages])

  const renderMessage = useCallback<ListRenderItem<Message>>(
    ({ item }) => (
      // Spacing lives in the cell, not as `gap` on the content container:
      // VirtualizedList sizes its placeholder spacers from measured cells and
      // is unaware of container gap, so positions can shift as the inverted
      // list renders in batches.
      <YStack paddingVertical={MESSAGE_SPACING / 2}>
        <MessageBubble message={item} />
        {item.id === retryableMessageId ? (
          <RetryNotice onRetry={() => void retryMessage(item.id)} />
        ) : null}
      </YStack>
    ),
    [retryableMessageId, retryMessage],
  )

  const onEndReached = useCallback(() => {
    // Can fire right away when the content is shorter than the viewport.
    if (hasOlderMessages && !isLoadingOlderMessages) {
      loadOlderMessages()
    }
  }, [hasOlderMessages, isLoadingOlderMessages, loadOlderMessages])

  const failedDraft = conversationId ? failedDrafts[conversationId] : undefined
  const onFailedDraftConsumed = useCallback(() => {
    if (conversationId) clearFailedDraft(conversationId)
  }, [conversationId, clearFailedDraft])

  if (initError && !conversationId) {
    return (
      <ChatErrorView
        title="Couldn't load your conversation"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={retryInitialize}
      />
    )
  }

  if (conversationError && !conversation) {
    return isConversationNotFound ? (
      <ChatErrorView
        title="Conversation not found"
        message="This conversation is no longer available."
        actionLabel="Start a new conversation"
        onAction={() => void createConversation()}
        isActionPending={isCreatingConversation}
      />
    ) : (
      <ChatErrorView
        title="Couldn't load this conversation"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={retryConversation}
      />
    )
  }

  const hasMessages = messages.length > 0 || isSending
  // The input stays mounted (disabled) while the conversation resolves, so
  // the screen does not swap layouts and pop the input in once it loads.
  const isResolving = isInitializing || isLoading

  return (
    <YStack flex={1} ref={rootRef} onLayout={onRootLayout}>
      {isResolving ? (
        <YStack flex={1}>
          <LoadingView />
        </YStack>
      ) : hasMessages ? (
        <FlatList
          // A fresh list per conversation: opens at the newest message rather
          // than at the previous conversation's scroll offset.
          key={conversationId ?? "none"}
          ref={listRef}
          inverted
          data={invertedMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          extraData={retryableMessageId}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          // Inverted: the header renders at the bottom, the footer at the top.
          ListHeaderComponent={isThinking ? <ThinkingIndicator /> : null}
          ListFooterComponent={
            isLoadingOlderMessages ? (
              <YStack paddingVertical="$3" alignItems="center">
                <Spinner accessibilityLabel="Loading older messages" />
              </YStack>
            ) : null
          }
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <EmptyChatView />
      )}

      <ChatInput
        key={conversationId ?? "none"}
        onSend={sendMessage}
        disabled={isSending || isResolving}
        canStop={canCancelReply}
        onStop={cancelReply}
        bottomPadding={inputBottomPadding}
        failedDraft={failedDraft}
        onFailedDraftConsumed={onFailedDraftConsumed}
      />
    </YStack>
  )
}
