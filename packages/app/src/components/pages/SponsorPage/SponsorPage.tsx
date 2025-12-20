import { YStack, ScrollView } from "tamagui";
import { useEffect, useRef } from "react";
import type { ScrollView as ScrollViewType } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { LoadingView } from "@/src/components/LoadingView";
import { useSponsorChat } from "./hooks/useSponsorChat";
import { useKeyboardHeight } from "./hooks/useKeyboardHeight";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { EmptyChatView } from "./EmptyChatView";

export const SponsorPage: React.FC = () => {
  const scrollViewRef = useRef<ScrollViewType>(null);
  const tabBarHeight = useBottomTabBarHeight();
  const keyboardHeight = useKeyboardHeight();

  const { messages, sendMessage, isSending, isInitializing, isLoading } =
    useSponsorChat();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  if (isInitializing || isLoading) {
    return (
      <YStack flex={1}>
        <LoadingView />
      </YStack>
    );
  }

  const inputBottomPadding =
    keyboardHeight > 0 ? keyboardHeight - tabBarHeight + 14 : "$3";

  const hasMessages = messages.length > 0 || isSending;

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
            {isSending && <ThinkingIndicator />}
          </YStack>
        </ScrollView>
      ) : (
        <EmptyChatView />
      )}

      <ChatInput
        onSend={sendMessage}
        disabled={isSending}
        bottomPadding={inputBottomPadding}
      />
    </YStack>
  );
};
