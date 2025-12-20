import { YStack, H4, Paragraph } from "tamagui";
import { MessageCircle } from "@tamagui/lucide-icons";

export const EmptyChatView: React.FC = () => {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
      <YStack
        width="$8"
        height="$8"
        borderRadius="$12"
        backgroundColor="$color3"
        justifyContent="center"
        alignItems="center"
        marginBottom="$4"
      >
        <MessageCircle size="$3" color="$color11" />
      </YStack>
      <H4 textAlign="center" marginBottom="$2">
        Start the conversation
      </H4>
      <Paragraph
        textAlign="center"
        color="$color10"
        maxWidth={280}
        lineHeight="$5"
      >
        Your AI sponsor is here to support you on your journey. Send a message
        to get started.
      </Paragraph>
    </YStack>
  );
};

