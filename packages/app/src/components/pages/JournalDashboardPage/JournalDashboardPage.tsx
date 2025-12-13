import { useCallback } from "react";
import { useJournalList } from "./hooks/useJournalList";
import { LoadingView } from "@/src/components/LoadingView";
import { EmptyJournalDashboard } from "./EmptyJournalDashboard";
import { YStack } from "tamagui";
import { ErrorView } from "../../ErrorView";
import { FlatList, ListRenderItem } from "react-native";
import { JournalEntryCard } from "./JournalEntryCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type JournalEntry = {
  id: string;
  createdAt: Date;
};

export const JournalDashboardPage: React.FC = () => {
  const { entries, isLoading, error } = useJournalList();
  const { bottom } = useSafeAreaInsets();

  const renderItem: ListRenderItem<JournalEntry> = useCallback(
    ({ item }) => (
      <YStack marginHorizontal="$4" marginVertical="$2">
        <JournalEntryCard id={item.id} createdAt={item.createdAt} />
      </YStack>
    ),
    []
  );

  const keyExtractor = useCallback((item: JournalEntry) => item.id, []);

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  if (entries.length === 0) {
    return <EmptyJournalDashboard />;
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: bottom }}
    />
  );
};

