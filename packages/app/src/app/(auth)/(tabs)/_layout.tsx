import { BookOpen, Home, Users } from "@tamagui/lucide-icons"
import { Tabs } from "expo-router"

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        tabBarShowLabel: false,
        headerBackButtonDisplayMode: "minimal",
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
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} pointerEvents="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} pointerEvents="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="sponsor"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={size} pointerEvents="none" />
          ),
        }}
      />
    </Tabs>
  )
}
