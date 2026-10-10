import { Pencil } from "@tamagui/lucide-icons"
import { HeaderButton } from "@/src/components/HeaderButton"
import { TabStackLayout } from "@/src/components/TabStackLayout"

export default function JournalLayout() {
  return (
    <TabStackLayout
      title="Journal"
      headerRight={() => <HeaderButton icon={Pencil} href="/journal-new" />}
    />
  )
}
