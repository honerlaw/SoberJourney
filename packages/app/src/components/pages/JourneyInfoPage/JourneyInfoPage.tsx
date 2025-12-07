import React, { useRef } from "react";
import { Card, Text, XStack, YStack, ScrollView, Separator } from "tamagui";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { format } from "date-fns";
import { useJourneyInfo } from "./hooks/useJourneyInfo";
import { useJourneyRemove } from "@/src/components/pages/DashboardPage/TrackerCard/hooks/useJourneyRemove";
import { DurationProgressBar } from "@/src/components/DurationProgressBar";
import { useDurationSections } from "@/src/hooks/useDurationSections";
import { LoadingView } from "@/src/components/LoadingView";
import { ErrorView } from "@/src/components/ErrorView";
import { AlertModal, AlertModalRef } from "@/src/components/AlertModal";
import { HeaderButton } from "@/src/components/HeaderButton";
import { ResetHistoryCard } from "./ResetHistoryCard";
import { Pencil, Trash2 } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const JourneyInfoPage: React.FC = () => {
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  const { journey, isLoading, error } = useJourneyInfo(journeyId || "");
  const { removeJourney } = useJourneyRemove();
  const alertModalRef = useRef<AlertModalRef>(null);
  const { bottom } = useSafeAreaInsets();
  const lastEntry = journey?.entries[0];
  const { sections } = useDurationSections({
    startDate: lastEntry?.createdAt || new Date(),
  });

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  if (!journey || journey.entries.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text color="$color11">Journey not found</Text>
      </YStack>
    );
  }

  const lastEntryDate = new Date(lastEntry!.createdAt);

  // All entries except the first one are "resets" (the first entry is the start)
  const resets = journey.entries.slice(1);
  const startEntry = journey.entries[journey.entries.length - 1];

  const onDelete = async () => {
    const success = await removeJourney(journeyId || "");
    if (success) {
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <XStack gap="$2">
              <HeaderButton
                icon={Pencil}
                onPress={() =>
                  router.push({
                    pathname: "/journeys-modify",
                    params: { journeyId: journeyId || "", currentTitle: journey?.title || "" },
                  })
                }
              />
              <Separator vertical marginVertical={"$2"} />
              <HeaderButton
                icon={Trash2}
                onPress={() => alertModalRef.current?.show()}
              />
            </XStack>
          ),
        }}
      />
      <AlertModal
        ref={alertModalRef}
        title="Delete Journey"
        message="Are you sure you want to delete this journey and all of the entries associated with it? This action cannot be undone."
        buttons={[
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: onDelete,
          },
        ]}
      />
      <ScrollView flex={1} contentContainerStyle={{ paddingBottom: bottom }}>
        <YStack padding="$4" gap="$4">
          {/* Current Streak Card */}
          <Card
            elevate
            bordered
            borderRadius="$4"
            backgroundColor="$background"
            padding="$4"
          >
          <YStack gap="$4">
            <Text fontSize="$5" fontWeight="600" color="$color12">
              Current Streak
            </Text>

            <YStack gap="$3">
              {sections.map(({ value, max, label, singularLabel }) => {
                if (value === 0 && label !== "seconds") {
                  return null;
                }
                return (
                  <DurationProgressBar
                    key={label}
                    value={value}
                    max={max}
                    label={label}
                    singularLabel={singularLabel}
                  />
                );
              })}
            </YStack>

            <Separator />

            <YStack gap="$2">
              <XStack justifyContent="space-between">
                <Text fontSize="$3" color="$color11">
                  Started on
                </Text>
                <Text fontSize="$3" color="$color12">
                  {format(new Date(startEntry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text fontSize="$3" color="$color11">
                  Current streak since
                </Text>
                <Text fontSize="$3" color="$color12">
                  {format(lastEntryDate, "MMM d, yyyy 'at' h:mm a")}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text fontSize="$3" color="$color11">
                  Total resets
                </Text>
                <Text fontSize="$3" color="$color12">
                  {resets.length}
                </Text>
              </XStack>
            </YStack>
          </YStack>
        </Card>

        {/* Reset History Card */}
        <ResetHistoryCard
          resets={resets}
          entries={journey.entries}
          startEntry={startEntry}
        />
      </YStack>
    </ScrollView>
    </>
  );
};

