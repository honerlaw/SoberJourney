import React from "react";
import { Text, YStack, View } from "tamagui";

export type DurationProgressBarProps = {
  value: number;
  max: number;
  label: string;
  singularLabel: string;
};

export const DurationProgressBar: React.FC<DurationProgressBarProps> = ({ value, max, label, singularLabel }) => {
  const progress = Math.min((value / max) * 100, 100);
  const displayLabel = value === 1 ? singularLabel : label;

  return (
    <YStack gap="$1">
      <View
        borderRadius="$2"
        backgroundColor="$color4"
        overflow="hidden"
        justifyContent="center"
        alignItems="center"
      >
        <View
          position="absolute"
          top={0}
          left={0}
          height="100%"
          width={`${progress}%`}
          backgroundColor="$color8"
          borderRadius="$2"
        />
        <Text fontSize="$3" fontWeight="600" color="$color12" paddingVertical={"$2"}>
          {value} {displayLabel}
        </Text>
      </View>
    </YStack>
  );
};

