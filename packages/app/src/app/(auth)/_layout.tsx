import { LoadingView } from "@/src/components/LoadingView";
import { useAuth } from "@/src/hooks/useAuth";
import { Redirect, Stack } from "expo-router";
import { WebLayout } from "@/src/components/WebLayout";
import React from "react";

export const unstable_settings = {
  initialRouteName: "dashboard",
};

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <LoadingView />;
  }

  if (!isSignedIn) {
    return <Redirect href="/" />;
  }

  return (
        <WebLayout>
          <Stack
            initialRouteName="dashboard"
            screenOptions={{
              headerBackButtonDisplayMode: "minimal",
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen
              name="dashboard"
              options={{
                headerTitle: "SoberJourney",
              }}
            />
          </Stack>
        </WebLayout>
  );
}
