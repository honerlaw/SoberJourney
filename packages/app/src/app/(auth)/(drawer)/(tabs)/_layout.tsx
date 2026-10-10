import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useTheme } from "tamagui"

/**
 * System tab bar: Liquid Glass on iOS 26, the classic bar on earlier iOS,
 * Material 3 on Android. Each tab's header comes from its own Stack. Web uses
 * `_layout.web.tsx`.
 */
export default function TabsLayout() {
  const theme = useTheme()

  return (
    <NativeTabs tintColor={theme.color?.val}>
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label hidden>Journeys</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sponsor">
        <NativeTabs.Trigger.Icon
          sf={{ default: "bubble.left", selected: "bubble.left.fill" }}
          md="chat"
        />
        <NativeTabs.Trigger.Label hidden>Sponsor</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <NativeTabs.Trigger.Icon
          sf={{ default: "book", selected: "book.fill" }}
          md="book"
        />
        <NativeTabs.Trigger.Label hidden>Journal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
