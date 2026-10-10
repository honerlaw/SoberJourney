import React from "react"
import { Stack } from "expo-router"
import { User } from "@tamagui/lucide-icons"
import { HeaderButton } from "@/src/components/HeaderButton"

type TabStackLayoutProps = {
  title: string
  headerRight?: () => React.ReactNode
}

/**
 * The Stack inside each tab. Native tabs render no header of their own, so
 * each tab's title and header buttons live on its Stack's `index` screen.
 * On iOS 26 this native header is Liquid Glass and its bar button views get
 * the system glass background.
 */
export const TabStackLayout: React.FC<TabStackLayoutProps> = ({
  title,
  headerRight,
}) => (
  <Stack
    screenOptions={{
      headerShadowVisible: false,
      headerBackButtonDisplayMode: "minimal",
    }}
  >
    <Stack.Screen
      name="index"
      options={{
        headerTitle: title,
        headerLeft: () => <HeaderButton icon={User} href="/profile" />,
        headerRight,
      }}
    />
  </Stack>
)
