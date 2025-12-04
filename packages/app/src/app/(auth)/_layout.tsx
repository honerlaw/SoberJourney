import { LoadingView } from "@/src/components/LoadingView";
import { useAuth } from "@/src/hooks/useAuth";
import { Redirect, router, Stack } from "expo-router";
import { WebLayout } from "@/src/components/WebLayout";
import React from "react";
import { PlusCircle , User} from "@tamagui/lucide-icons";
import { HeaderButton } from "@/src/components/HeaderButton";

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
            headerRight: () => (
              <HeaderButton
                icon={PlusCircle}
                onPress={() => router.push("/journeys-new")}
              />
            ),
            headerLeft: () => (
              <HeaderButton
                icon={User}
                onPress={() => router.push("/profile")}
              />
            ),
          }}
        />
        <Stack.Screen
          name="journeys-new"
          options={{
            headerTitle: "New Journey",
          }}
        />
        <Stack.Screen
          name="journeys-modify"
          options={{
            headerTitle: "Edit Journey",
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            headerTitle: "Profile",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </WebLayout>
  );
}
