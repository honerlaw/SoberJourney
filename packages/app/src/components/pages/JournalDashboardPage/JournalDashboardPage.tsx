import { useCallback, useMemo, useState } from "react"
import { useJournalList } from "./hooks/useJournalList"
import { LoadingView } from "@/src/components/LoadingView"
import { EmptyJournalDashboard } from "./EmptyJournalDashboard"
import { H6, YStack } from "tamagui"
import { ErrorView } from "../../ErrorView"
import { FlatList, ListRenderItem } from "react-native"
import { JournalEntryCard } from "./JournalEntryCard"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CalendarView } from "../../CalendarView"
import { format, isSameDay } from "date-fns"

type JournalEntry = {
  id: string
  createdAt: Date
  preview: string
}

export const JournalDashboardPage: React.FC = () => {
  const { entries, isLoading, error } = useJournalList()
  const { bottom } = useSafeAreaInsets()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // Calculate entries per day for the calendar heatmap
  const entriesPerDay = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries) {
      const dateKey = format(entry.createdAt, "yyyy-MM-dd")
      counts[dateKey] = (counts[dateKey] ?? 0) + 1
    }
    return counts
  }, [entries])

  // Filter entries based on selected date
  const filteredEntries = useMemo(() => {
    if (!selectedDate) {
      return entries
    }
    return entries.filter((entry) => isSameDay(entry.createdAt, selectedDate))
  }, [entries, selectedDate])

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate((prev) =>
      prev && isSameDay(prev, date) ? undefined : date,
    )
  }, [])

  const renderItem: ListRenderItem<JournalEntry> = useCallback(
    ({ item }) => (
      <YStack marginHorizontal="$4" marginVertical="$2">
        <JournalEntryCard
          id={item.id}
          createdAt={item.createdAt}
          preview={item.preview}
        />
      </YStack>
    ),
    [],
  )

  const keyExtractor = useCallback((item: JournalEntry) => item.id, [])

  if (isLoading) {
    return <LoadingView />
  }

  if (error) {
    return <ErrorView error={error} />
  }

  if (entries.length === 0) {
    return <EmptyJournalDashboard />
  }

  return (
    <>
      <CalendarView
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        entriesPerDay={entriesPerDay}
      />
      {selectedDate && filteredEntries.length === 0 ? (
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          padding="$4"
        >
          <H6 textAlign="center" color="$color11" fontSize={"$4"}>
            No entries for {format(selectedDate, "MMMM d, yyyy")}
          </H6>
        </YStack>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottom }}
        />
      )}
    </>
  )
}
