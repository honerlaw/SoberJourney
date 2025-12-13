import { YStack, Text, Button, H4 } from "tamagui";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRouter } from "expo-router";
import { BookOpen } from "@tamagui/lucide-icons";

export const EmptyJournalDashboard: React.FC = () => {
  const router = useRouter();
  const headerHeight = useHeaderHeight();

  const handleCreateEntry = () => {
    router.push("/journal-new");
  };

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      paddingHorizontal="$6"
      gap="$8"
      paddingBottom={headerHeight}
    >
      <YStack
        width={120}
        height={120}
        borderRadius={60}
        backgroundColor="$color4"
        justifyContent="center"
        alignItems="center"
      >
        <BookOpen size={60} color="$color11" />
      </YStack>

      <YStack gap="$4" maxWidth={500} alignItems="center">
        <H4 textAlign="center" fontWeight="600">
          Start capturing your thoughts
        </H4>
        <Text
          fontSize="$5"
          color="$color11"
          textAlign="center"
          lineHeight="$5"
        >
          Journaling can help you reflect on your journey, process emotions, and
          celebrate your progress. Write freely and honestly.
        </Text>
      </YStack>

      <Button paddingHorizontal="$7" onPress={handleCreateEntry} themeInverse>
        Write Your First Entry
      </Button>
    </YStack>
  );
};

