import { Text, Card } from "tamagui"
import { format } from "date-fns"

import {
  useConversation,
  type ConversationListItem,
} from "@/src/providers/ConversationProvider/ConversationContext"
import type { DrawerContentComponentProps } from "@react-navigation/drawer"

type RenderItemProps = {
  item: ConversationListItem
  navigation: DrawerContentComponentProps["navigation"]
}

export const RenderItem: React.FC<RenderItemProps> = ({ item, navigation }) => {
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
      marginHorizontal="$3"
      marginVertical="$1.5"
      padding="$3"
      backgroundColor={isActive ? "$color4" : undefined}
      borderColor={isActive ? "$color8" : undefined}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint="Opens this conversation"
      accessibilityState={{ selected: isActive }}
    >
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
    </Card>
  )
}
