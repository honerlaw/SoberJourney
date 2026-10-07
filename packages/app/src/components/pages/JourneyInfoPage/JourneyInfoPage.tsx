import React, { useState } from "react"
import { YStack, ScrollView } from "tamagui"
import { useLocalSearchParams } from "expo-router"
import { useJourneyInfo } from "./hooks/useJourneyInfo"
import { useCheckIns } from "./hooks/useCheckIns"
import { useDeleteConfirmation } from "./hooks/useDeleteConfirmation"
import { useDurationSections } from "@/src/hooks/useDurationSections"
import { LoadingView } from "@/src/components/LoadingView"
import { ErrorView } from "@/src/components/ErrorView"
import { AlertModal } from "@/src/components/AlertModal"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CurrentStreakCard } from "./CurrentStreakCard"
import { TabSelector } from "./TabSelector"
import { JourneyInfoHeader } from "./JourneyInfoHeader"
import { JourneyNotFoundView } from "./JourneyNotFoundView"
import { ResetHistoryCard } from "./ResetHistoryCard"
import { CheckInsCard } from "./CheckInsCard"
import type { TabValue } from "./types"
import { deriveResetHistory } from "./utils/deriveResetHistory"
import { isNotFoundError } from "./utils/isNotFoundError"

const TABS = [
  { value: "checkins" as const, label: "Check-ins" },
  { value: "resets" as const, label: "Reset History" },
]

export const JourneyInfoPage: React.FC = () => {
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>()
  const { journey, isLoading, error } = useJourneyInfo(journeyId)
  const { entries: checkInEntries } = useCheckIns(journeyId)
  const { showConfirmation, modalProps } = useDeleteConfirmation(journeyId)
  const { bottom } = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<TabValue>("checkins")

  const { startEntry, currentEntry, resets } = deriveResetHistory(
    journey?.entries ?? [],
  )
  const { sections } = useDurationSections({
    startDate: currentEntry?.createdAt || new Date(),
  })

  if (isLoading) {
    return <LoadingView />
  }

  // A deep link to a deleted journey surfaces as a NOT_FOUND error
  if (isNotFoundError(error)) {
    return <JourneyNotFoundView />
  }

  if (error) {
    return <ErrorView error={error} />
  }

  if (!journey || !startEntry || !currentEntry) {
    return <JourneyNotFoundView />
  }

  return (
    <>
      <JourneyInfoHeader
        journeyId={journeyId}
        journeyTitle={journey.title}
        onDeletePress={showConfirmation}
      />
      <AlertModal {...modalProps} />
      <ScrollView flex={1} contentContainerStyle={{ paddingBottom: bottom }}>
        <YStack padding="$4" gap="$4">
          <CurrentStreakCard
            sections={sections}
            startDate={new Date(startEntry.createdAt)}
            currentStreakDate={new Date(currentEntry.createdAt)}
            resetCount={resets.length}
          />
          <TabSelector
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          {activeTab === "resets" ? (
            <ResetHistoryCard resets={resets} />
          ) : (
            <CheckInsCard entries={checkInEntries} />
          )}
        </YStack>
      </ScrollView>
    </>
  )
}
