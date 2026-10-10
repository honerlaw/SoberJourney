import { Menu } from "@tamagui/lucide-icons"
import { useNavigation } from "expo-router"
import { DrawerActions } from "expo-router/react-navigation"
import { HeaderButton } from "@/src/components/HeaderButton"
import { TabStackLayout } from "@/src/components/TabStackLayout"
import { SPONSOR_HEADER_TITLE } from "@/src/components/pages/SponsorPage"

function OpenDrawerButton() {
  const navigation = useNavigation()
  // The conversation drawer sits above the tabs; the action bubbles up from
  // this tab's Stack to the nearest drawer navigator.
  return (
    <HeaderButton
      icon={Menu}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
    />
  )
}

export default function SponsorLayout() {
  return (
    <TabStackLayout
      title={SPONSOR_HEADER_TITLE}
      headerRight={() => <OpenDrawerButton />}
    />
  )
}
