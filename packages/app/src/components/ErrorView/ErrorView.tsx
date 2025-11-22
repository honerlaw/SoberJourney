import { useReportError } from "@/src/hooks/useReportError";
import { YStack, Text } from "tamagui";
import LottieView from "lottie-react-native";
import source from "@/assets/error.json";

type ErrorViewProps = {
  error: Error | string | null | unknown;
  message?: string;
  small?: boolean;
};

export const ErrorView: React.FC<ErrorViewProps> = ({
  error,
  small,
  message,
}) => {
  useReportError(error);

  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <YStack alignItems="center">
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
        {message && (
          <Text
            fontSize={small ? "$3" : "$4"}
            color="$gray11"
            textAlign="center"
          >
            {message}
          </Text>
        )}
      </YStack>
    </YStack>
  );
};
