import { LoadingView } from "@/src/components/LoadingView";
import { useAuth } from "@/src/hooks/useAuth";
import { Redirect, Tabs } from "expo-router";
import { WebLayout } from "@/src/components/WebLayout";
import React from "react";
import { Home, BookOpen } from "@tamagui/lucide-icons";

export const unstable_settings = {
  initialRouteName: "(dashboard)",
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
      <Tabs
        screenOptions={{
          headerShadowVisible: false,
          tabBarShowLabel: true,
        }}
      >
        <Tabs.Screen
          name="(dashboard)"
          options={{
            headerShown: false,
            title: "Journeys",
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="(journal)"
          options={{
            headerShown: false,
            title: "Journal",
            tabBarIcon: ({ color, size }) => (
              <BookOpen color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </WebLayout>
  );
}
