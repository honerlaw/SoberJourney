import { YStack, XStack, H5, Button } from "tamagui"
import { Plus } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DrawerContentComponentProps } from "@react-navigation/drawer"

type ListHeaderProps = {
  isCreatingConversation: boolean
  createConversation: () => Promise<void>
  navigation: DrawerContentComponentProps["navigation"]
}

export const ListHeader: React.FC<ListHeaderProps> = ({
  isCreatingConversation,
  createConversation,
  navigation,
}) => {
  const { top } = useSafeAreaInsets()
  return (
    <Button
      marginTop={top + 16}
      marginBottom="$4"
      marginHorizontal="$3"
      icon={Plus}
      onPress={async () => {
        await createConversation()
        navigation.closeDrawer()
      }}
      disabled={isCreatingConversation}
      themeInverse
    >
      {isCreatingConversation ? "Creating..." : "New Conversation"}
    </Button>
  )
}
