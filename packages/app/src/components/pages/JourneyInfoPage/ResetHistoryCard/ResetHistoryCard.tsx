import React from "react";
import { Card, Text, XStack, YStack, Separator } from "tamagui";
import { differenceInDays, format } from "date-fns";

type JourneyEntry = {
  id: string;
  createdAt: Date;
};

type ResetHistoryCardProps = {
  resets: JourneyEntry[];
  entries: JourneyEntry[];
  startEntry: JourneyEntry;
};

export const ResetHistoryCard: React.FC<ResetHistoryCardProps> = ({
  resets,
  entries,
  startEntry,
}) => {
  return (
    <Card
      elevate
      bordered
      borderRadius="$4"
      backgroundColor="$background"
      padding="$4"
    >
      <YStack gap="$4">
        <XStack alignItems="center" gap="$2">
          <Text fontSize="$5" fontWeight="600" color="$color12">
            History
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
              const previousEntry = entries[index + 2] || startEntry;
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
  );
};

