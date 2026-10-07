import { XStack, Text, Button } from "tamagui"
import { RotateCcw } from "@tamagui/lucide-icons"

type RetryNoticeProps = {
  onRetry: () => void
}

/**
 * Shown under a saved user message that has no reply (a failed or cut-off
 * turn). Retrying generates the reply without sending the message again.
 */
export const RetryNotice: React.FC<RetryNoticeProps> = ({ onRetry }) => (
  <XStack justifyContent="flex-end" alignItems="center" gap="$2">
    <Text fontSize="$2" color="$color11">
      No reply yet
    </Text>
    <Button
      size="$2"
      chromeless
      icon={RotateCcw}
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Retry getting a reply to this message"
    >
      Retry
    </Button>
  </XStack>
)
