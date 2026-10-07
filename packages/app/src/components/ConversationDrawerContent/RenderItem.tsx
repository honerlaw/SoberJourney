import { Platform } from "react-native"
import { Text, Card, XStack, YStack, Button } from "tamagui"
import { MoreHorizontal } from "@tamagui/lucide-icons"
import { format } from "date-fns"

import {
  useConversation,
  type ConversationListItem,
} from "@/src/providers/ConversationProvider/ConversationContext"
import type { DrawerContentComponentProps } from "@react-navigation/drawer"

type RenderItemProps = {
  item: ConversationListItem
  navigation: DrawerContentComponentProps["navigation"]
  /** Opens rename/delete for this conversation (long-press or the "more" button). */
  onOpenActions: (item: ConversationListItem) => void
}

export const RenderItem: React.FC<RenderItemProps> = ({
  item,
  navigation,
  onOpenActions,
}) => {
  const { conversationId, selectConversation } = useConversation()
  const isActive = item.id === conversationId

  const handlePress = () => {
    selectConversation(item.id)
    navigation.closeDrawer()
  }

  return (
    <Card
      bordered
      onPress={handlePress}
      // tamagui's web press handler fires onLongPress on every click, so
      // long-press is native-only; the "more" button covers web.
      onLongPress={
        Platform.OS === "web" ? undefined : () => onOpenActions(item)
      }
      marginHorizontal="$3"
      marginVertical="$1.5"
      paddingVertical="$3"
      paddingLeft="$3"
      paddingRight="$1"
      backgroundColor={isActive ? "$color4" : undefined}
      borderColor={isActive ? "$color8" : undefined}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={
        Platform.OS === "web"
          ? "Opens this conversation"
          : "Opens this conversation. Long press for rename and delete."
      }
      accessibilityState={{ selected: isActive }}
    >
      <XStack alignItems="center" gap="$2">
        <YStack flex={1}>
          <Text
            fontSize="$4"
            fontWeight="600"
            color="$color"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.title}
          </Text>
          <Text fontSize="$2" color="$color11" numberOfLines={1}>
            {format(new Date(item.updatedAt), "MMM d, yyyy 'at' h:mm a")}
          </Text>
        </YStack>
        <Button
          size="$3"
          circular
          chromeless
          icon={MoreHorizontal}
          onPress={(event) => {
            // Do not also open the conversation.
            event.stopPropagation()
            onOpenActions(item)
          }}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${item.title}`}
        />
      </XStack>
    </Card>
  )
}
