import React from "react";
import { Stack, router } from "expo-router";
import { PlusCircle, User } from "@tamagui/lucide-icons";
import { HeaderButton } from "@/src/components/HeaderButton";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function DashboardLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
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
        name="journeys-info"
        options={{
          headerTitle: "Journey Details",
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
  );
}

