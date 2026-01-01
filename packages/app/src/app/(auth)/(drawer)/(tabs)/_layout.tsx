import { HeaderButton } from "@/src/components/HeaderButton"
import {
  BookOpen,
  Home,
  Menu,
  MessageCircle,
  Pencil,
  PlusCircle,
  User,
} from "@tamagui/lucide-icons"
import { Tabs } from "expo-router"
import { useLiquidGlass } from "@/src/hooks/useLiquidGlass"

export default function TabsLayout() {
  const { isLiquidGlassEnabled } = useLiquidGlass()

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        tabBarShowLabel: false,
        headerBackButtonDisplayMode: "minimal",
        headerStyle: isLiquidGlassEnabled
          ? {
              height: 120,
            }
          : undefined,
        tabBarStyle: {
          elevation: 0,
          borderTopWidth: 0,
          paddingTop: 14,
        },
        headerLeftContainerStyle: {
          paddingLeft: 14,
        },
        headerRightContainerStyle: {
          paddingRight: 14,
        },
        headerLeft: () => (
          <HeaderButton icon={User} href="/profile" forceGlass />
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          headerTitle: "Journeys",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} pointerEvents="none" />
          ),
          headerRight: () => {
            return (
              <HeaderButton icon={PlusCircle} href="/journeys-new" forceGlass />
            )
          },
        }}
      />
      <Tabs.Screen
        name="sponsor/index"
        options={{
          headerTitle: "Sponsor",
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} pointerEvents="none" />
          ),
          headerRight: () => {
            return <HeaderButton icon={Menu} href="openDrawer" forceGlass />
          },
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          headerTitle: "Journal",
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} pointerEvents="none" />
          ),
          headerRight: () => {
            return <HeaderButton icon={Pencil} href="/journal-new" forceGlass />
          },
        }}
      />
    </Tabs>
  )
}
