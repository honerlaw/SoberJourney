import React, { useState, useEffect } from "react";
import { Card, Text, XStack, YStack, Button } from "tamagui";
import { RotateCcw, Trash2 } from "@tamagui/lucide-icons";
import { AppRouter } from "@onerlaw/soberjourney-server/dist/network/rpc/index.mjs";
import {
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInSeconds,
  differenceInYears,
  addYears,
} from "date-fns";
import { AlertModal } from "@/src/components/AlertModal";
import { useJourneyReset } from "./hooks/useJourneyReset";
import { useJourneyRemove } from "./hooks/useJourneyRemove";

type UserJourneyWithEntryModel = NonNullable<
  AppRouter["journey"]["list"]["_def"]["$types"]["output"]["journeys"][number]
>;

export type TrackerCardProps = {
  title: string;
  model: UserJourneyWithEntryModel;
  requestRefetch: () => void | Promise<void>;
};

export const TrackerCard: React.FC<TrackerCardProps> = ({
  title,
  model,
  requestRefetch,
}) => {
  const { resetJourney } = useJourneyReset();
  const { removeJourney } = useJourneyRemove();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update the current time every second for live counter
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  if (!model.lastEntry) {
    return null;
  }

  const lastEntryDate = new Date(model.lastEntry.createdAt);
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
  ];

  const onReset = async () => {
    await resetJourney(model.id);
    await requestRefetch();
  };

  const onDelete = async () => {
    await removeJourney(model.id);
    await requestRefetch();
  };

  return (
    <Card
      elevate
      bordered
      borderRadius="$4"
      backgroundColor="$background"
      padding="$4"
    >
      <YStack gap="$4">
        {/* Header with title */}
        <XStack justifyContent="space-between" alignItems="center">
          <Text
            fontSize="$6"
            fontWeight="600"
            color="$color12"
            flex={1}
            flexWrap="wrap"
          >
            {title}
          </Text>
          <XStack gap="$2">
            <AlertModal
              title="Reset"
              message="This is a hard moment — are you ready to honor it and start again?"
              buttons={[
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  onPress: onReset,
                },
              ]}
            >
              <Button size="$2" icon={RotateCcw}>
                <Text fontSize="$3" color="$color11">
                  Reset
                </Text>
              </Button>
            </AlertModal>
            <AlertModal
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
            >
              <Button
                size="$2"
                icon={Trash2}
                theme="red"
              />
            </AlertModal>
          </XStack>
        </XStack>

        {/* Main counter */}
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
      </YStack>
    </Card>
  );
};
