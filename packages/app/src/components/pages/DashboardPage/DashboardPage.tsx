import { EmptyView } from "@/src/components/EmptyView";
import { TrackerCard } from "./TrackerCard";
import { useJourneyList } from "./hooks/useJourneyList";
import { LoadingView } from "@/src/components/LoadingView";
import { ScrollView, YStack } from "tamagui";
import { differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";

export const DashboardPage: React.FC = () => {
  const { journeys, isLoading } = useJourneyList();

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
    <ScrollView>
      {journeys.map((journey) => {
        if (!journey.lastEntry) {
          return null;
        }

        const now = new Date();
        const lastEntryDate = new Date(journey.lastEntry.createdAt);
        
        const totalMinutes = differenceInMinutes(now, lastEntryDate);
        const days = differenceInDays(now, lastEntryDate);
        const hours = differenceInHours(now, lastEntryDate) % 24;
        const minutes = totalMinutes % 60;

        return (
          <TrackerCard
            key={journey.id}
            title={journey.title}
            days={days}
            hours={hours}
            minutes={minutes}
            lastResetDate={journey.lastEntry.createdAt}
            streakCurrent={0}
            streakGoal={0}
            onReset={() => {}}
          />
        );
      })}
    </ScrollView>
  );
};
