import { YStack, XStack, Text, Input, Button, ScrollView } from "tamagui";
import { useEffect, useState, useRef } from "react";
import { LoadingView } from "@/src/components/LoadingView";
import { useCreateConversation } from "./hooks/useCreateConversation";
import { useConversation, type Message } from "./hooks/useConversation";
import { useSendMessage } from "./hooks/useSendMessage";
import type { ScrollView as ScrollViewType } from "react-native";
import { KeyboardAvoidingView, Platform } from "react-native";
import { MessageBubble } from "./MessageBubble";
import { Send } from "@tamagui/lucide-icons";

export const SponsorPage: React.FC = () => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollViewType>(null);

  const { createConversation, isPending: isCreating } = useCreateConversation();
  const { conversation, isLoading: isLoadingConversation } = useConversation(conversationId);
  const { sendMessage, isPending: isSending } = useSendMessage(conversationId);

  // Create conversation on mount
  useEffect(() => {
    const initConversation = async () => {
      const conv = await createConversation("Sponsor Chat");
      if (conv) {
        setConversationId(conv.id);
      }
    };
    initConversation();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (conversation?.messages?.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation?.messages?.length]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText("");
    await sendMessage(text);
  };

  // Show loading while creating conversation
  if (isCreating || (!conversationId && !conversation)) {
    return (
      <YStack flex={1}>
        <LoadingView />
      </YStack>
    );
  }

  // Show loading while fetching conversation
  if (isLoadingConversation && !conversation) {
    return (
      <YStack flex={1}>
        <LoadingView />
      </YStack>
    );
  }

  const messages = conversation?.messages ?? [];

  return (
    <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
      <YStack flex={1}>
        {/* Message List */}
        <ScrollView 
          ref={scrollViewRef}
          flex={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <YStack gap="$3" flex={1} paddingHorizontal={"$3"}>
            {messages.map((message: Message) => (
                <MessageBubble key={message.id} message={message} />
            ))}
            {isSending && (
              <YStack alignItems="flex-start">
                <YStack
                  backgroundColor="$color4"
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$4"
                  maxWidth="80%"
                >
                  <Text color="$gray11">Thinking...</Text>
                </YStack>
              </YStack>
            )}
          </YStack>
        </ScrollView>

        {/* Input Area */}
        <YStack
          padding="$3"
          borderTopWidth={1}
          borderBottomWidth={1}
          borderColor="$color3"
          backgroundColor="$background"
        >
          <XStack gap="$2" alignItems="center">
            <Input
              flex={1}
              placeholder="Type a message..."
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isSending}
            />
            <Button
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
              themeInverse
              icon={<Send size="$1" />}
            />
          </XStack>
        </YStack>
      </YStack>
      </KeyboardAvoidingView>
  );
};