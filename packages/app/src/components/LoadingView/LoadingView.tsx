import { YStack } from "tamagui";
import LottieView from "lottie-react-native";
import source from "@/assets/loading.json";

type LoadingViewProps = {
  small?: boolean;
};

export const LoadingView: React.FC<LoadingViewProps> = ({ small }) => {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <YStack
        width={small ? "$13" : "$20"}
        height={small ? "$13" : "$20"}
        borderRadius="$4"
      >
        <LottieView
          autoPlay
          loop
          source={source}
          style={{ width: "100%", height: "100%" }}
        />
      </YStack>
    </YStack>
  );
};
