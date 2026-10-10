import { BookOpen, Home, MessageCircle } from "@tamagui/lucide-icons"
import { Tabs } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// The JS tab bar keeps a fixed height and pads inside it, so the padding is
// set together with the height: 48px for the icons, 8px clear above and below.
const TAB_BAR_HEIGHT = 64
const TAB_BAR_PADDING = 8

/**
 * Web keeps the JS tab bar (native tabs only have a basic web fallback).
 * Headers come from each tab's Stack, so the tab navigator shows none.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          elevation: 0,
          borderTopWidth: 0,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: TAB_BAR_PADDING,
          paddingBottom: TAB_BAR_PADDING + insets.bottom,
        },
        // Each tab stacks icon over label from the top; with labels hidden,
        // auto margins center the icon in the tab instead.
        tabBarIconStyle: { marginVertical: "auto" },
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
            <BookOpen
              color={color as string}
              size={size}
              pointerEvents="none"
            />
          ),
        }}
      />
    </Tabs>
  )
}
