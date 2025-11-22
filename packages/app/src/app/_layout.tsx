import { Stack } from "expo-router";
import "react-native-reanimated";
import { AppLayout } from "@/src/components/AppLayout";
import * as Sentry from "@sentry/react-native";

export const unstable_settings = {
  anchor: "index",
};

function RootLayout() {
  return (
    <AppLayout>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(unauth)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="privacy"
          options={{
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="terms"
          options={{
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
        <Stack.Screen
          name="+not-found"
          options={{
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="support"
          options={{
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </AppLayout>
  );
}

export default Sentry.wrap(RootLayout);
