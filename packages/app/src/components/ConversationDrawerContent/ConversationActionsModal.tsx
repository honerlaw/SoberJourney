import React, { useEffect, useState } from "react"
import { Modal, Platform } from "react-native"
import { Button, Input, Text, XStack, YStack, View } from "tamagui"

import type { ConversationListItem } from "@/src/providers/ConversationProvider/ConversationContext"
import {
  canSaveTitle,
  LIST_PLACEHOLDER_TITLE,
  renameFieldInitialValue,
} from "@/src/providers/ConversationProvider/conversationCache"

/** Matches the server's rename cap (longer titles are clamped there too). */
const MAX_TITLE_LENGTH = 100

export type ConversationActionsMode = "actions" | "rename" | "delete"

type ConversationActionsModalProps = {
  conversation: ConversationListItem | null
  mode: ConversationActionsMode | null
  onModeChange: (mode: ConversationActionsMode | null) => void
  onRename: (id: string, title: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  /** Delete is unavailable while a send/retry is in flight for the conversation. */
  isDeleteDisabled: boolean
}

/**
 * Rename / delete for one conversation, as a plain react-native Modal so it
 * works on iOS, Android and web (`Alert.alert` is a no-op on web).
 */
export const ConversationActionsModal: React.FC<
  ConversationActionsModalProps
> = ({
  conversation,
  mode,
  onModeChange,
  onRename,
  onDelete,
  isDeleteDisabled,
}) => {
  const [title, setTitle] = useState("")
  const [isWorking, setIsWorking] = useState(false)

  useEffect(() => {
    if (mode === "rename") {
      setTitle(
        renameFieldInitialValue(conversation?.title, LIST_PLACEHOLDER_TITLE),
      )
    }
  }, [mode, conversation?.title])

  const close = () => {
    if (!isWorking) onModeChange(null)
  }

  const run = async (action: () => Promise<boolean>) => {
    setIsWorking(true)
    try {
      if (await action()) onModeChange(null)
    } finally {
      setIsWorking(false)
    }
  }

  const visible = !!conversation && mode !== null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="rgba(0, 0, 0, 0.5)"
        onPress={close}
      >
        <View
          backgroundColor="$background"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$borderColor"
          maxWidth={400}
          minWidth={300}
          padding="$4"
          margin="$4"
          // Taps inside the card must not close the modal.
          onPress={(event) => event.stopPropagation()}
        >
          {conversation && mode === "actions" ? (
            <YStack gap="$3">
              <Text
                fontSize="$6"
                fontWeight="600"
                color="$color12"
                numberOfLines={2}
              >
                {conversation.title}
              </Text>
              <Button
                onPress={() => onModeChange("rename")}
                accessibilityRole="button"
              >
                Rename
              </Button>
              <Button
                theme="red"
                onPress={() => onModeChange("delete")}
                disabled={isDeleteDisabled}
                opacity={isDeleteDisabled ? 0.5 : 1}
                accessibilityRole="button"
                accessibilityState={{ disabled: isDeleteDisabled }}
              >
                Delete
              </Button>
              <Button
                variant="outlined"
                onPress={close}
                accessibilityRole="button"
              >
                Cancel
              </Button>
            </YStack>
          ) : null}

          {conversation && mode === "delete" ? (
            <YStack gap="$3">
              <Text fontSize="$6" fontWeight="600" color="$color12">
                Delete conversation?
              </Text>
              <Text fontSize="$4" color="$color11">
                “{conversation.title}” and all of its messages will be
                permanently deleted. This can&apos;t be undone.
              </Text>
              <XStack gap="$3" marginTop="$2">
                <Button
                  flex={1}
                  variant="outlined"
                  onPress={close}
                  disabled={isWorking}
                  accessibilityRole="button"
                >
                  Cancel
                </Button>
                <Button
                  flex={1}
                  theme="red"
                  onPress={() => void run(() => onDelete(conversation.id))}
                  disabled={isWorking || isDeleteDisabled}
                  accessibilityRole="button"
                  accessibilityLabel="Delete conversation"
                >
                  {isWorking ? "Deleting..." : "Delete"}
                </Button>
              </XStack>
            </YStack>
          ) : null}

          {conversation && mode === "rename" ? (
            <YStack gap="$3">
              <Text fontSize="$6" fontWeight="600" color="$color12">
                Rename conversation
              </Text>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder={LIST_PLACEHOLDER_TITLE}
                maxLength={MAX_TITLE_LENGTH}
                autoFocus={Platform.OS !== "android"}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (canSaveTitle(title) && !isWorking) {
                    void run(() => onRename(conversation.id, title))
                  }
                }}
                accessibilityLabel="Conversation title"
              />
              <XStack gap="$3" marginTop="$2">
                <Button
                  flex={1}
                  variant="outlined"
                  onPress={close}
                  disabled={isWorking}
                  accessibilityRole="button"
                >
                  Cancel
                </Button>
                <Button
                  flex={1}
                  themeInverse
                  onPress={() =>
                    void run(() => onRename(conversation.id, title))
                  }
                  disabled={isWorking || !canSaveTitle(title)}
                  opacity={isWorking || !canSaveTitle(title) ? 0.5 : 1}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isWorking || !canSaveTitle(title),
                  }}
                >
                  {isWorking ? "Saving..." : "Save"}
                </Button>
              </XStack>
            </YStack>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}
