import { Card, Text, YStack } from "tamagui";

type JournalEntryCardProps = {
  id: string;
  createdAt: Date;
};

export const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  createdAt,
}) => {
  const formattedDate = new Date(createdAt).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card elevate bordered padding="$4">
      <YStack gap="$2">
        <Text fontSize="$5" fontWeight="600">
          {formattedDate}
        </Text>
        <Text fontSize="$3" color="$color11">
          {formattedTime}
        </Text>
      </YStack>
    </Card>
  );
};

