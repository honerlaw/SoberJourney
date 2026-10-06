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

/** A drawer entry, as returned by `conversation.list`. */
export type ConversationListItem =
  RouterOutputs["conversation"]["list"]["conversations"][number]

export type ConversationContextType = {
  conversationId: string | null
  conversation: Conversation | null
  conversations: ConversationListItem[]
  messages: Message[]
  /** Resolves `true` when the send succeeded, `false` otherwise. Never rejects. */
  sendMessage: (text: string) => Promise<boolean>
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
  /** The current conversation is waiting for a reply. */
  isThinking: boolean
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
