import { YStack, ScrollView } from "tamagui"
import { useCallback, useEffect, useRef } from "react"
import type { ScrollView as ScrollViewType } from "react-native"
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs"
import { useNavigation } from "expo-router"

import { LoadingView } from "@/src/components/LoadingView"
import { useConversation } from "@/src/providers/ConversationProvider"
import { useKeyboardHeight } from "./hooks/useKeyboardHeight"
import { MessageBubble } from "./MessageBubble"
import { ChatInput } from "./ChatInput"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { EmptyChatView } from "./EmptyChatView"
import { ChatErrorView } from "./ChatErrorView"

/** Must match the static `headerTitle` of the sponsor tab in `(tabs)/_layout.tsx`. */
const DEFAULT_HEADER_TITLE = "Sponsor"
/** Title `conversation.list` returns for an untitled conversation. */
const LIST_PLACEHOLDER_TITLE = "New conversation"

export const SponsorPage: React.FC = () => {
  const scrollViewRef = useRef<ScrollViewType>(null)
  const tabBarHeight = useBottomTabBarHeight()
  const keyboardHeight = useKeyboardHeight()
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
    DEFAULT_HEADER_TITLE
  useEffect(() => {
    navigation.setOptions({ headerTitle })
  }, [navigation, headerTitle])

  // Scroll to bottom when messages change, when sending (to show the thinking
  // indicator), or when the keyboard opens.
  useEffect(() => {
    if (!messages.length && !isSending) return
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
    return () => clearTimeout(timer)
  }, [messages.length, isSending, keyboardHeight])

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

  if (isInitializing || isLoading) {
    return (
      <YStack flex={1}>
        <LoadingView />
      </YStack>
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

  // With edge-to-edge enabled (app.json), Android does not resize the window
  // for the keyboard, so the input is lifted manually on both platforms.
  const inputBottomPadding =
    keyboardHeight > 0 ? keyboardHeight - tabBarHeight + 14 : "$3"

  const hasMessages = messages.length > 0 || isSending

  return (
    <YStack flex={1}>
      {hasMessages ? (
        <ScrollView
          ref={scrollViewRef}
          flex={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <YStack gap="$3" flex={1} paddingHorizontal="$3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isThinking && <ThinkingIndicator />}
          </YStack>
        </ScrollView>
      ) : (
        <EmptyChatView />
      )}

      <ChatInput
        key={conversationId ?? "none"}
        onSend={sendMessage}
        disabled={isSending}
        bottomPadding={inputBottomPadding}
        failedDraft={failedDraft}
        onFailedDraftConsumed={onFailedDraftConsumed}
      />
    </YStack>
  )
}
