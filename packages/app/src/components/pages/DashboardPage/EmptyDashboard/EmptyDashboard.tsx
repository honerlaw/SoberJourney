import { Button } from "tamagui"
import { useRouter } from "expo-router"
import Icon from "@/assets/logo/icon.svg"
import { EmptyPageView } from "@/src/components/EmptyPageView"

export const EmptyDashboard: React.FC = () => {
  const router = useRouter()
  const handleCreateJourney = () => {
    router.push("/journeys-new")
  }

  return (
    <EmptyPageView
      title="Begin your journey whenever you're ready"
      message="Every step forward is progress. Start tracking your journey at your own pace, with compassion and care."
      icon={() => <Icon width={120} height={120} />}
    >
      <Button paddingHorizontal="$7" onPress={handleCreateJourney} themeInverse>
        Create Your First Journey
      </Button>
    </EmptyPageView>
  )
}
