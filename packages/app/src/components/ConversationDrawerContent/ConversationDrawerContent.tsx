import { FlatList } from "react-native"
import { YStack } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DrawerContentScrollView } from "@react-navigation/drawer"
import type { DrawerContentComponentProps } from "@react-navigation/drawer"

import { LoadingView } from "@/src/components/LoadingView"
import { EmptyView } from "@/src/components/EmptyView"
import {
  useConversation,
  type ConversationListItem,
} from "@/src/providers/ConversationProvider/ConversationContext"
import { ListHeader } from "./ListHeader"
import { RenderItem } from "./RenderItem"

type ConversationDrawerContentProps = DrawerContentComponentProps

export const ConversationDrawerContent: React.FC<
  ConversationDrawerContentProps
> = (props) => {
  const { bottom } = useSafeAreaInsets()
  const {
    conversations,
    createConversation,
    isCreatingConversation,
    isLoadingConversations,
  } = useConversation()

  if (isLoadingConversations) {
    return (
      <DrawerContentScrollView {...props}>
        <LoadingView small />
      </DrawerContentScrollView>
    )
  }

  if (conversations.length === 0) {
    return (
      <DrawerContentScrollView {...props}>
        <ListHeader
          isCreatingConversation={isCreatingConversation}
          createConversation={createConversation}
          navigation={props.navigation}
        />
        <EmptyView inline message="No conversations yet" />
      </DrawerContentScrollView>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={conversations}
        keyExtractor={(item: ConversationListItem) => item.id}
        renderItem={({ item }) => (
          <RenderItem item={item} navigation={props.navigation} />
        )}
        ListHeaderComponent={
          <ListHeader
            isCreatingConversation={isCreatingConversation}
            createConversation={createConversation}
            navigation={props.navigation}
          />
        }
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
      />
    </YStack>
  )
}
