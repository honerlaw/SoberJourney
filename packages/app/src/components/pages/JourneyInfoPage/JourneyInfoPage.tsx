import React, { useState, useEffect } from "react";
import { Card, Text, XStack, YStack, ScrollView, Separator } from "tamagui";
import { useLocalSearchParams } from "expo-router";
import {
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInSeconds,
  differenceInYears,
  addYears,
  format,
} from "date-fns";
import { useJourneyInfo } from "./hooks/useJourneyInfo";
import { LoadingView } from "@/src/components/LoadingView";
import { ErrorView } from "@/src/components/ErrorView";
import { Clock, RotateCcw } from "@tamagui/lucide-icons";

type JourneyEntry = {
  id: string;
  createdAt: Date;
};

export const JourneyInfoPage: React.FC = () => {
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  const { journey, isLoading, error } = useJourneyInfo(journeyId || "");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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

  const lastEntry = journey.entries[0];
  const lastEntryDate = new Date(lastEntry.createdAt);
  const totalMinutes = differenceInMinutes(now, lastEntryDate);
  const totalSeconds = differenceInSeconds(now, lastEntryDate);
  const years = differenceInYears(now, lastEntryDate);
  const afterYears = addYears(lastEntryDate, years);
  const days = differenceInDays(now, afterYears);
  const hours = differenceInHours(now, lastEntryDate) % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  const sections = [
    [years, "years"],
    [days, "days"],
    [hours, "hours"],
    [minutes, "minutes"],
    [seconds, "seconds"],
  ] as const;

  // All entries except the first one are "resets" (the first entry is the start)
  const resets = journey.entries.slice(1);
  const startEntry = journey.entries[journey.entries.length - 1];

  return (
    <ScrollView flex={1}>
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
            <XStack alignItems="center" gap="$2">
              <Clock size={20} color="$color11" />
              <Text fontSize="$5" fontWeight="600" color="$color12">
                Current Streak
              </Text>
            </XStack>

            <YStack gap="$1">
              <XStack alignItems="baseline" gap="$4" flexWrap="wrap">
                {sections.map(([value, label], index) => {
                  const size = sections.length - index;
                  if (value === 0) {
                    return null;
                  }
                  return (
                    <XStack key={label} alignItems="baseline" gap="$2">
                      <Text fontSize={`$${6 + size}`} fontWeight="600">
                        {value}
                      </Text>
                      <Text fontSize="$4" color="$color11">
                        {label}
                      </Text>
                    </XStack>
                  );
                })}
              </XStack>
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
        <Card
          elevate
          bordered
          borderRadius="$4"
          backgroundColor="$background"
          padding="$4"
        >
          <YStack gap="$4">
            <XStack alignItems="center" gap="$2">
              <RotateCcw size={20} color="$color11" />
              <Text fontSize="$5" fontWeight="600" color="$color12">
                Reset History
              </Text>
            </XStack>

            {resets.length === 0 ? (
              <YStack
                paddingVertical="$6"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="$4" color="$color11" textAlign="center">
                  No resets yet! Keep up the great work! 🎉
                </Text>
              </YStack>
            ) : (
              <YStack gap="$3">
                {resets.map((reset: JourneyEntry, index: number) => {
                  const resetDate = new Date(reset.createdAt);
                  // Calculate the streak length before this reset
                  const previousEntry = journey.entries[index + 2] || startEntry;
                  const previousDate = new Date(previousEntry.createdAt);
                  const streakDays = differenceInDays(resetDate, previousDate);

                  return (
                    <YStack key={reset.id} gap="$2">
                      {index > 0 && <Separator />}
                      <XStack
                        justifyContent="space-between"
                        alignItems="flex-start"
                        paddingTop={index > 0 ? "$2" : 0}
                      >
                        <YStack gap="$1" flex={1}>
                          <Text fontSize="$4" color="$color12" fontWeight="500">
                            Reset #{resets.length - index}
                          </Text>
                          <Text fontSize="$3" color="$color11">
                            {format(resetDate, "EEEE, MMM d, yyyy")}
                          </Text>
                          <Text fontSize="$2" color="$color10">
                            {format(resetDate, "h:mm a")}
                          </Text>
                        </YStack>
                        <YStack alignItems="flex-end">
                          <Text fontSize="$3" color="$color11">
                            Streak before reset
                          </Text>
                          <Text fontSize="$4" fontWeight="500" color="$color12">
                            {streakDays} {streakDays === 1 ? "day" : "days"}
                          </Text>
                        </YStack>
                      </XStack>
                    </YStack>
                  );
                })}
              </YStack>
            )}
          </YStack>
        </Card>
      </YStack>
    </ScrollView>
  );
};

