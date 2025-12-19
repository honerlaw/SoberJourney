import { XStack, YStack, Input, Button } from "tamagui";
import { Send } from "@tamagui/lucide-icons";
import { useState } from "react";

type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  bottomPadding: number | string;
};

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  bottomPadding,
}) => {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <YStack
      padding="$3"
      paddingBottom={bottomPadding}
      borderTopWidth={1}
      borderBottomWidth={1}
      borderColor="$color3"
      backgroundColor="$background"
      animation="quick"
    >
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          placeholder="Type a message..."
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!disabled}
        />
        <Button
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          themeInverse
          icon={<Send size="$1" pointerEvents="none" />}
        />
      </XStack>
    </YStack>
  );
};

