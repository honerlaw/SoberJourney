import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

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

export function useConversation(conversationId: string | null) {
  const { report } = useReportError()
  const trpc = useTRPC()

  const { data, error, isLoading, isRefetching, refetch } = useQuery(
    trpc.conversation.get.queryOptions(
      { conversationId: conversationId ?? "" },
      { enabled: !!conversationId },
    ),
  )

  useEffect(() => {
    if (error) {
      report(error)
    }
  }, [error, report])

  return {
    conversation: (data?.conversation as Conversation | null) ?? null,
    error,
    isLoading: isLoading && !isRefetching,
    isRefetching,
    refetch,
  }
}
