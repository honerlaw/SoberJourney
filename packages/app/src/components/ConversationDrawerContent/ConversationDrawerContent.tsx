import { useCallback, useState } from "react"
import { FlatList } from "react-native"
import { YStack, Spinner } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DrawerContentScrollView } from "expo-router/drawer"
import type { DrawerContentComponentProps } from "expo-router/drawer"

import { LoadingView } from "@/src/components/LoadingView"
import { EmptyView } from "@/src/components/EmptyView"
import {
  useConversation,
  type ConversationListItem,
} from "@/src/providers/ConversationProvider/ConversationContext"
import { ListHeader } from "./ListHeader"
import { RenderItem } from "./RenderItem"
import {
  ConversationActionsModal,
  type ConversationActionsMode,
} from "./ConversationActionsModal"

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
    hasMoreConversations,
    isLoadingMoreConversations,
    loadMoreConversations,
    deleteConversation,
    renameConversation,
    isConversationBusy,
  } = useConversation()
  const [selected, setSelected] = useState<ConversationListItem | null>(null)
  const [mode, setMode] = useState<ConversationActionsMode | null>(null)

  const openActions = useCallback((item: ConversationListItem) => {
    setSelected(item)
    setMode("actions")
  }, [])

  const onEndReached = useCallback(() => {
    if (hasMoreConversations && !isLoadingMoreConversations) {
      loadMoreConversations()
    }
  }, [hasMoreConversations, isLoadingMoreConversations, loadMoreConversations])

  const actionsModal = (
    <ConversationActionsModal
      conversation={selected}
      mode={mode}
      onModeChange={(next) => {
        setMode(next)
        if (next === null) setSelected(null)
      }}
      onRename={renameConversation}
      onDelete={deleteConversation}
      isDeleteDisabled={!!selected && isConversationBusy(selected.id)}
    />
  )

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
        {actionsModal}
      </DrawerContentScrollView>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={conversations}
        keyExtractor={(item: ConversationListItem) => item.id}
        renderItem={({ item }) => (
          <RenderItem
            item={item}
            navigation={props.navigation}
            onOpenActions={openActions}
          />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMoreConversations ? (
            <YStack paddingVertical="$3" alignItems="center">
              <Spinner accessibilityLabel="Loading more conversations" />
            </YStack>
          ) : null
        }
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
      {actionsModal}
    </YStack>
  )
}
