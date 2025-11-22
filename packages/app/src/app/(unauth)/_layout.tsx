import { LoadingView } from "@/src/components/LoadingView";
import { WebLayout } from "@/src/components/WebLayout";
import { useAuth } from "@/src/hooks/useAuth";
import { Redirect, Stack } from "expo-router";

export const unstable_settings = {
  initialRouteName: "signin",
};

export default function UnauthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <LoadingView />;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return (
    <WebLayout>
      <Stack
        initialRouteName="signin"
        screenOptions={{
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="signin" options={{ headerTitle: "" }} />
        <Stack.Screen name="signup" options={{ headerTitle: "" }} />
        <Stack.Screen
          name="password/forgot"
          options={{ headerTitle: "Forgot Password" }}
        />
      </Stack>
    </WebLayout>
  );
}
