import { LoadingView } from "@/src/components/LoadingView";
import { useAuth } from "@/src/hooks/useAuth";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import { WebLayout } from "@/src/components/WebLayout";
import React from "react";
import { HeaderButton } from "@/src/components/HeaderButton";
import { PlusCircle, User } from "@tamagui/lucide-icons";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Determine which tab is active based on route segments
  const isJournalTab = (segments as string[]).includes("journal");

  if (!isLoaded) {
    return <LoadingView />;
  }

  if (!isSignedIn) {
    return <Redirect href="/" />;
  }

  const handleAddPress = () => {
    if (isJournalTab) {
      router.push("/journal-new");
    } else {
      router.push("/journeys-new");
    }
  };

  return (
    <WebLayout>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerTitle: "SoberJourney",
            headerRight: () => (
              <HeaderButton icon={PlusCircle} onPress={handleAddPress} />
            ),
            headerLeft: () => (
              <HeaderButton
                icon={User}
                onPress={() => router.push("/profile")}
              />
            ),
          }}
        />

        {/* Journey Routes */}
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
          name="journeys-info"
          options={{
            headerTitle: "Journey Details",
          }}
        />

        {/* Journal Routes */}
        <Stack.Screen
          name="journal-new"
          options={{
            headerTitle: "New Entry",
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
