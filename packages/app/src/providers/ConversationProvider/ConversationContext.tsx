import { createContext, useContext } from "react"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs"

type RouterOutputs = inferRouterOutputs<AppRouter>

/** Shape of a `conversation.get` response (the query cache entry). */
export type ConversationGetOutput = RouterOutputs["conversation"]["get"]

/** A conversation with its decrypted messages, as returned by `conversation.get`. */
export type Conversation = ConversationGetOutput["conversation"]

/** A single message. `role` is the server's Prisma enum: `"USER" | "MODEL"`. */
export type Message = Conversation["messages"][number]

export type MessageRole = Message["role"]

/** Events of `conversation.streamSponsorChat` (`saved` → `delta`* → `done`). */
export type SponsorChatStreamEvent =
  RouterOutputs["conversation"]["streamSponsorChat"] extends AsyncIterable<
    infer TEvent
  >
    ? TEvent
    : never

/** Shape of a `conversation.list` response (one page of the drawer). */
export type ConversationListOutput = RouterOutputs["conversation"]["list"]

/** A drawer entry, as returned by `conversation.list`. */
export type ConversationListItem =
  ConversationListOutput["conversations"][number]

export type ConversationContextType = {
  conversationId: string | null
  conversation: Conversation | null
  conversations: ConversationListItem[]
  messages: Message[]
  /**
   * Resolves `true` when the message reached the server (the input clears),
   * even if the reply then failed: the saved message is shown with a Retry
   * action (`retryableMessageId`). Resolves `false` when the server did not
   * keep it (the text stays in, or is restored to, the input). Never rejects.
   */
  sendMessage: (text: string) => Promise<boolean>
  /**
   * Server id of the newest message when it is a saved USER message with no
   * reply (a failed turn) and nothing is in flight; null otherwise.
   */
  retryableMessageId: string | null
  /** Generates the missing reply to a saved user message without re-saving it. Never rejects. */
  retryMessage: (messageId: string) => Promise<boolean>
  /** Deletes a conversation (after the UI confirmed). Resolves `true` when it is gone. Never rejects. */
  deleteConversation: (id: string) => Promise<boolean>
  /** Renames a conversation. Resolves `true` on success. Never rejects. */
  renameConversation: (id: string, title: string) => Promise<boolean>
  /** A send or retry is in flight for this conversation (delete is disabled then). */
  isConversationBusy: (id: string) => boolean
  /** Older messages of the current conversation exist on the server. */
  hasOlderMessages: boolean
  isLoadingOlderMessages: boolean
  loadOlderMessages: () => void
  hasMoreConversations: boolean
  isLoadingMoreConversations: boolean
  loadMoreConversations: () => void
  createConversation: () => Promise<void>
  selectConversation: (id: string) => void
  /** Lazily resolves the initial conversation. Idempotent. */
  initialize: () => void
  retryInitialize: () => void
  retryConversation: () => void
  /** Text of a failed send, keyed by conversation id, waiting to be restored to the input. */
  failedDrafts: Record<string, string>
  clearFailedDraft: (conversationId: string) => void
  /** A send is in flight for the currently selected conversation. */
  isSending: boolean
  isCreatingConversation: boolean
  isInitializing: boolean
  initError: unknown
  isLoading: boolean
  conversationError: unknown
  isConversationNotFound: boolean
  isLoadingConversations: boolean
  /** The current conversation is waiting for the first part of a reply. */
  isThinking: boolean
  /** A streamed send is in flight for the current conversation and can be stopped. */
  canCancelReply: boolean
  /**
   * Stops the in-flight streamed reply of the current conversation. The
   * message stays saved (with a Retry action) when the server kept it; no
   * error toast is shown.
   */
  cancelReply: () => void
}

export const ConversationContext =
  createContext<ConversationContextType | null>(null)

export function useConversation(): ConversationContextType {
  const context = useContext(ConversationContext)
  if (!context) {
    throw new Error(
      "useConversation must be used within a ConversationProvider",
    )
  }
  return context
}
