import { Pencil } from "@tamagui/lucide-icons"
import { HeaderButton } from "@/src/components/HeaderButton"
import { TabStackLayout } from "@/src/components/TabStackLayout"

export default function JournalLayout() {
  return (
    <TabStackLayout
      title="Journal"
      headerRight={() => (
        <HeaderButton
          icon={Pencil}
          label="New journal entry"
          href="/journal-new"
        />
      )}
    />
  )
}
