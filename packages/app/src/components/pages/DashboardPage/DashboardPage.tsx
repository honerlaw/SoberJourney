import { useCallback, useEffect, useRef, useState } from "react";
import { TouchableOpacity } from "react-native-gesture-handler";
import { TrackerCard } from "./TrackerCard";
import { useJourneyList } from "./hooks/useJourneyList";
import { useJourneyReorder } from "./hooks/useJourneyReorder";
import { LoadingView } from "@/src/components/LoadingView";
import { EmptyDashboard } from "./EmptyDashboard";
import { YStack, XStack } from "tamagui";
import { ErrorView } from "../../ErrorView";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { GripVertical } from "@tamagui/lucide-icons";
import { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs";

type JourneyItem = NonNullable<
  AppRouter["journey"]["list"]["_def"]["$types"]["output"]["journeys"][number]
>;

export const DashboardPage: React.FC = () => {
  const { journeys, isLoading, refetch, error } = useJourneyList();
  const { reorderJourneys } = useJourneyReorder();
  const [localJourneys, setLocalJourneys] = useState<JourneyItem[]>([]);
  const isDragging = useRef(false);

  // Sync local state with server data
  useEffect(() => {
    // Don't sync while actively dragging to prevent flickering
    if (isDragging.current) return;
    
    if (journeys.length > 0) {
      setLocalJourneys(journeys);
    }
  }, [journeys]);

  const handleDragBegin = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleDragEnd = useCallback(
    async ({ data }: { data: JourneyItem[] }) => {
      setLocalJourneys(data);

      // Create reorder items with new positions
      const items = data.map((journey, index) => ({
        id: journey.id,
        position: index,
      }));

      await reorderJourneys(items);
      isDragging.current = false;
    },
    [reorderJourneys]
  );

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<JourneyItem>) => {
      return (
        <ScaleDecorator>
          <TouchableOpacity
            onLongPress={drag}
            disabled={isActive}
            activeOpacity={1}
            style={{
              marginHorizontal: 16,
              marginVertical: 8,
              opacity: isActive ? 0.8 : 1,
            }}
          >
            <XStack>
              <YStack
                justifyContent="center"
                paddingRight="$2"
              >
                <GripVertical size={24} color="$color8" />
              </YStack>
              <YStack flex={1} pointerEvents="box-none">
                <TrackerCard
                  title={item.title}
                  model={item}
                  requestRefetch={() => {
                    refetch();
                  }}
                />
              </YStack>
            </XStack>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    },
    [refetch]
  );

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  if (journeys.length === 0) {
    return <EmptyDashboard />;
  }

  return (
    <DraggableFlatList
      data={localJourneys}
      onDragBegin={handleDragBegin}
      onDragEnd={handleDragEnd}
      keyExtractor={(item) => item.id}
      containerStyle={{ flex: 1 }}
      renderItem={renderItem}
    />
  );
};
