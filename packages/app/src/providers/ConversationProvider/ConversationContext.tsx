import { createContext, useContext } from "react"

export type Message = {
  id: string
  role: string
  content: string
  createdAt: Date
}

export type Conversation = {
  id: string
  title: string | null
  createdAt: Date
  updatedAt: Date
  messages: Message[]
}

export type ConversationListItem = {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
}

export type ConversationContextType = {
  conversationId: string | null
  conversation: Conversation | null
  conversations: ConversationListItem[]
  messages: Message[]
  sendMessage: (text: string) => Promise<void>
  createConversation: () => Promise<void>
  selectConversation: (id: string) => void
  isSending: boolean
  isCreatingConversation: boolean
  isInitializing: boolean
  isLoading: boolean
  isLoadingConversations: boolean
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
