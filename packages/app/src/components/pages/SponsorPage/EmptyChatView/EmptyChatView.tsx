import { MessageCircle } from "@tamagui/lucide-icons"
import { EmptyPageView } from "@/src/components/EmptyPageView"
import ChatIcon from "@/assets/icons/chat.svg"

export const EmptyChatView: React.FC = () => {
  return (
    <EmptyPageView
      title="Start the conversation"
      message="Your AI sponsor is here to support you on your journey. Send a message to get started."
      icon={() => <ChatIcon width={120} height={120} />}
    />
  )
}
