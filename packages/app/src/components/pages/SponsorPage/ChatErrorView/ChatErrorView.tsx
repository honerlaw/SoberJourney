import { Button } from "tamagui"
import { AlertCircle } from "@tamagui/lucide-icons"
import { EmptyPageView } from "@/src/components/EmptyPageView"

type ChatErrorViewProps = {
  title: string
  message: string
  actionLabel: string
  onAction: () => void
  isActionPending?: boolean
}

/** Recoverable error state for the sponsor chat (errors are reported by the provider). */
export const ChatErrorView: React.FC<ChatErrorViewProps> = ({
  title,
  message,
  actionLabel,
  onAction,
  isActionPending,
}) => (
  <EmptyPageView title={title} message={message} icon={AlertCircle}>
    <Button
      onPress={onAction}
      disabled={isActionPending}
      themeInverse
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
    >
      {actionLabel}
    </Button>
  </EmptyPageView>
)
