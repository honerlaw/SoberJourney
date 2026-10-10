import React from "react"
import { Platform } from "react-native"
import { Stack } from "expo-router"
import { User } from "@tamagui/lucide-icons"
import { View } from "tamagui"
import { HeaderButton } from "@/src/components/HeaderButton"

type TabStackLayoutProps = {
  title: string
  headerRight?: () => React.ReactNode
}

/**
 * Web's JS header leaves only 4px between the left button and the title, so
 * tab headers pad their buttons on web. Native headers lay out their own bar
 * button items and get the buttons unwrapped.
 */
const webHeaderSide = (render?: () => React.ReactNode) =>
  render && Platform.OS === "web"
    ? () => <View paddingHorizontal={6}>{render()}</View>
    : render

const ProfileButton = () => (
  <HeaderButton icon={User} label="Profile" href="/profile" />
)

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
        headerLeft: webHeaderSide(() => <ProfileButton />),
        headerRight: webHeaderSide(headerRight),
      }}
    />
  </Stack>
)
