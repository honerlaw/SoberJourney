import { useCallback, useEffect, useRef, useState } from "react"
import { TrackerCard } from "./TrackerCard"
import { useJourneyList } from "./hooks/useJourneyList"
import { useJourneyReorder } from "./hooks/useJourneyReorder"
import { LoadingView } from "@/src/components/LoadingView"
import { EmptyDashboard } from "./EmptyDashboard"
import { YStack } from "tamagui"
import { ErrorView } from "../../ErrorView"
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist"
import { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type JourneyItem = NonNullable<
  AppRouter["journey"]["list"]["_def"]["$types"]["output"]["journeys"][number]
>

export const DashboardPage: React.FC = () => {
  const { journeys, isLoading, refetch, error } = useJourneyList()
  const { reorderJourneys } = useJourneyReorder()
  const [localJourneys, setLocalJourneys] = useState<JourneyItem[]>([])
  const isDragging = useRef(false)
  const { bottom } = useSafeAreaInsets()

  // Sync local state with server data
  useEffect(() => {
    // Don't sync while actively dragging to prevent flickering
    if (isDragging.current) return

    if (journeys.length > 0) {
      setLocalJourneys(journeys)
    }
  }, [journeys])

  const handleDragBegin = useCallback(() => {
    isDragging.current = true
  }, [])

  const handleDragEnd = useCallback(
    async ({ data }: { data: JourneyItem[] }) => {
      setLocalJourneys(data)

      // Create reorder items with new positions
      const items = data.map((journey, index) => ({
        id: journey.id,
        position: index,
      }))

      await reorderJourneys(items)
      isDragging.current = false
    },
    [reorderJourneys],
  )

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<JourneyItem>) => {
      return (
        <ScaleDecorator>
          <YStack
            marginHorizontal="$4"
            marginVertical="$2"
            opacity={isActive ? 0.8 : 1}
          >
            <TrackerCard
              title={item.title}
              model={item}
              requestRefetch={() => {
                refetch()
              }}
              drag={drag}
              isActive={isActive}
            />
          </YStack>
        </ScaleDecorator>
      )
    },
    [refetch],
  )

  if (isLoading) {
    return <LoadingView />
  }

  if (error) {
    return <ErrorView error={error} />
  }

  if (journeys.length === 0) {
    return <EmptyDashboard />
  }

  return (
    <DraggableFlatList
      data={localJourneys}
      onDragBegin={handleDragBegin}
      onDragEnd={handleDragEnd}
      keyExtractor={(item) => item.id}
      containerStyle={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: bottom }}
      renderItem={renderItem}
    />
  )
}
