import { useState, useEffect, useCallback } from "react";
import { useCreateConversation } from "../useCreateConversation";
import { useConversation } from "../useConversation";
import { useSendMessage } from "../useSendMessage";

export function useSponsorChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);

  const { createConversation, isPending: isCreating } = useCreateConversation();
  const { conversation, isLoading: isLoadingConversation } =
    useConversation(conversationId);
  const {
    sendMessage: sendMessageMutation,
    isPending: isSending,
  } = useSendMessage(conversationId);

  // Initialize conversation on mount
  useEffect(() => {
    const init = async () => {
      const conv = await createConversation("Sponsor Chat");
      if (conv) {
        setConversationId(conv.id);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;
      await sendMessageMutation(text.trim());
    },
    [isSending, sendMessageMutation]
  );

  const isInitializing = isCreating || (!conversationId && !conversation);
  const isLoading = isLoadingConversation && !conversation;

  return {
    messages: conversation?.messages ?? [],
    sendMessage,
    isSending,
    isInitializing,
    isLoading,
  };
}

