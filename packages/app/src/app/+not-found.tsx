import { YStack, Text, Button } from "tamagui";
import Icon from "@/assets/icon.svg";
import { WebLayout } from "../components/WebLayout";
import { Platform } from "react-native";
import { Redirect, router } from "expo-router";

export default function NotFound() {
  // on none-web platforms, redirect to the home page
  if (Platform.OS !== "web") {
    return <Redirect href="/" />;
  }

  return (
    <WebLayout>
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        padding="$4"
        gap="$4"
      >
        <Icon width={100} height={100} />
        <Text
          fontSize="$5"
          textAlign="center"
          lineHeight={"$5"}
          color="$color11"
          maxWidth={350}
        >
          Unfortunately we are not able to find the content you are looking for.
          It doesn&apos;t exist or has been moved.
        </Text>
        <Button onPress={() => router.push("/")}>
          <Text>Go to home</Text>
        </Button>
      </YStack>
    </WebLayout>
  );
}
