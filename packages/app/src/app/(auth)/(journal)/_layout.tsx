import React from "react";
import { Stack, router } from "expo-router";
import { PlusCircle, User } from "@tamagui/lucide-icons";
import { HeaderButton } from "@/src/components/HeaderButton";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function JournalLayout() {
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
          headerTitle: "Journal",
          headerRight: () => (
            <HeaderButton
              icon={PlusCircle}
              onPress={() => router.push("/journal-new")}
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
  );
}

