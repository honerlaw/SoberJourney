import React from "react";
import {
  Card,
  Text,
  XStack,
  YStack,
  Button,
  Progress,
} from "tamagui";
import { RotateCcw } from "@tamagui/lucide-icons";

export type TrackerCardProps = {
  title?: string;
  days?: number;
  hours?: number;
  minutes?: number;
  lastResetDate?: Date | string;
  streakCurrent?: number;
  streakGoal?: number;
  onReset?: () => void;
};

export const TrackerCard: React.FC<TrackerCardProps> = ({
  title = "Alcohol",
  days = 285,
  hours = 23,
  minutes = 1,
  lastResetDate,
  streakCurrent = 12,
  streakGoal = 90,
  onReset,
}) => {
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return "";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };


  const progressPercentage = Math.round(streakGoal > 0 
    ? Math.min((streakCurrent / streakGoal) * 100, 100) 
    : 0);

    console.log(progressPercentage)

  return (
    <Card
      elevate
      bordered
      borderRadius="$4"
      backgroundColor="$background"
      padding="$4"
    >
      <YStack gap="$4">
        {/* Header with title and reset button */}
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$6" fontWeight="600" color="$color12">
            {title}
          </Text>
          <Button
            size="$2"
            circular
            chromeless
            icon={RotateCcw}
            onPress={onReset}
            backgroundColor="$color3"
            pressStyle={{ opacity: 0.7 }}
          />
        </XStack>

        {/* Main counter */}
        <YStack gap="$1">
          <XStack alignItems="baseline" gap="$2">
            <Text fontSize="$10" fontWeight="600" color="$green10">
              {days}
            </Text>
            <Text fontSize="$5" color="$color11">
              days
            </Text>
          </XStack>
          <Text fontSize="$3" color="$color11">
            {hours}h {minutes}m
          </Text>
        </YStack>

        {/* Last reset date */}
        {lastResetDate && (
          <Text fontSize="$2" color="$color11">
            Last reset: {formatDate(lastResetDate)}
          </Text>
        )}

        {/* Streak progress */}
        <YStack gap="$2">
          <Text fontSize="$2" color="$color11">
            Streak Progress
          </Text>
          <XStack alignItems="center" gap="$3">
            <Progress
              value={progressPercentage}
              max={100}
              size="$1"
              flex={1}
              backgroundColor="$color4"
            >
              <Progress.Indicator
                animation="bouncy"
                backgroundColor="$green10"
              />
            </Progress>
            <Text fontSize="$2" color="$color11" minWidth={60}>
              {streakCurrent}/{streakGoal} days
            </Text>
          </XStack>
        </YStack>
      </YStack>
    </Card>
  );
};

