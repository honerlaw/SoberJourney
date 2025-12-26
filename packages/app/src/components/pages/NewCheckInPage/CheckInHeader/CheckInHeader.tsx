import { useMemo } from "react"
import { YStack, H3, Paragraph } from "tamagui"
import { useAuth } from "@/src/hooks/useAuth"
import { useJourneyList } from "@/src/components/pages/DashboardPage/hooks/useJourneyList"
import { useDurationSections } from "@/src/hooks/useDurationSections"

export const CheckInHeader: React.FC = () => {
  const { user } = useAuth()
  const { journeys } = useJourneyList()

  // Get the first journey's start date for duration calculation
  const primaryJourney = journeys[0]
  const startDate = primaryJourney?.lastEntry?.createdAt || new Date()

  const { sections } = useDurationSections({ startDate })

  // Format duration string from sections
  const durationString = useMemo(() => {
    const parts: string[] = []
    for (const section of sections) {
      if (section.value > 0 || section.label === "seconds") {
        const label =
          section.value === 1 ? section.singularLabel : section.label
        parts.push(`${section.value} ${label}`)
        if (parts.length >= 2) break // Only show first 2 significant units
      }
    }
    return parts.join(", ")
  }, [sections])

  // Get user display name
  const displayName =
    user?.firstName ||
    user?.fullName?.split(" ")[0] ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Friend"

  // Get time-appropriate greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  return (
    <YStack gap="$2" alignItems="center">
      <H3 textAlign="center">The Daily Affirmation</H3>
      <Paragraph size="$5" textAlign="center" color="$color12">
        {greeting}, {displayName}.
      </Paragraph>
      {primaryJourney && (
        <Paragraph size="$4" textAlign="center" color="$color11">
          You have been on this journey for {durationString}.
        </Paragraph>
      )}
    </YStack>
  )
}
