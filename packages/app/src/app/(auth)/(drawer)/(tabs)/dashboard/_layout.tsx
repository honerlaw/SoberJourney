import { PlusCircle } from "@tamagui/lucide-icons"
import { HeaderButton } from "@/src/components/HeaderButton"
import { TabStackLayout } from "@/src/components/TabStackLayout"

export default function DashboardLayout() {
  return (
    <TabStackLayout
      title="Journeys"
      headerRight={() => (
        <HeaderButton icon={PlusCircle} href="/journeys-new" />
      )}
    />
  )
}
