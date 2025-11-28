import { EmptyView } from "@/src/components/EmptyView";
import { TrackerCard } from "./TrackerCard";
import { useJourneyList } from "./hooks/useJourneyList";
import { LoadingView } from "@/src/components/LoadingView";
import { YStack } from "tamagui";
import { FlatList } from "react-native";

export const DashboardPage: React.FC = () => {
  const { journeys, isLoading, refetch } = useJourneyList();

  if (isLoading) {
    return <LoadingView />;
  }

  if (journeys.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <EmptyView message="No journeys found" />
      </YStack>
    );
  }

  return (
    <>
      <FlatList
        data={journeys}
        renderItem={({ item }) => {
          return (
            <YStack marginHorizontal={"$4"} marginVertical={"$2"}>
              <TrackerCard
                title={item.title}
                model={item}
                requestRefetch={() => {
                  refetch()
                }}
              />
            </YStack>
          );
        }}
      />
    </>
  );
};
