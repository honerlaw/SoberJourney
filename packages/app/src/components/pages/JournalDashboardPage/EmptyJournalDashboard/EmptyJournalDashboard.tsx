import { Button } from "tamagui"
import { useRouter } from "expo-router"
import { EmptyPageView } from "@/src/components/EmptyPageView"
import BookIcon from "@/assets/icons/book.svg"

export const EmptyJournalDashboard: React.FC = () => {
  const router = useRouter()

  const handleCreateEntry = () => {
    router.push("/journal-new")
  }

  return (
    <EmptyPageView
      title="Start capturing your thoughts"
      message="Journaling can help you reflect on your journey, process emotions, and celebrate your progress. Write freely and honestly."
      icon={() => <BookIcon width={120} height={120} />}
    >
      <Button paddingHorizontal="$7" onPress={handleCreateEntry} themeInverse>
        Write Your First Entry
      </Button>
    </EmptyPageView>
  )
}
