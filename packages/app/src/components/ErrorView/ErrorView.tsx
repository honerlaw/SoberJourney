import { YStack, Text, Button } from "tamagui"
import LottieView from "lottie-react-native"
import source from "@/assets/error.json"

const DEFAULT_MESSAGE = "Something went wrong."

type ErrorViewProps = {
  // Kept for call-site context; ErrorView does not report it. The hook or
  // provider that produced the error reports it (one Sentry report per error).
  error?: Error | string | null | unknown
  message?: string
  small?: boolean
  onRetry?: () => void
  retryLabel?: string
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  small,
  message,
  onRetry,
  retryLabel = "Try again",
}) => {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
      <YStack alignItems="center" gap="$3" maxWidth={400}>
        <YStack
          width={small ? "$6" : "$13"}
          height={small ? "$6" : "$13"}
          borderRadius="$4"
        >
          <LottieView
            autoPlay
            loop
            source={source}
            style={{ width: "100%", height: "100%" }}
          />
        </YStack>
        <Text fontSize={small ? "$3" : "$4"} color="$gray11" textAlign="center">
          {message ?? DEFAULT_MESSAGE}
        </Text>
        {onRetry && (
          <Button size={small ? "$2" : "$3"} onPress={onRetry}>
            {retryLabel}
          </Button>
        )}
      </YStack>
    </YStack>
  )
}
