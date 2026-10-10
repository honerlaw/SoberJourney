import { BookOpen, Home, MessageCircle } from "@tamagui/lucide-icons"
import { Tabs } from "expo-router"

/**
 * Web keeps the JS tab bar (native tabs only have a basic web fallback).
 * Headers come from each tab's Stack, so the tab navigator shows none.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          elevation: 0,
          borderTopWidth: 0,
          paddingTop: 14,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Home color={color as string} size={size} pointerEvents="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="sponsor"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MessageCircle
              color={color as string}
              size={size}
              pointerEvents="none"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color as string} size={size} pointerEvents="none" />
          ),
        }}
      />
    </Tabs>
  )
}
