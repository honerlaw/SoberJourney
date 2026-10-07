import { XStack, YStack, TextArea, Button } from "tamagui"
import { Send, Square } from "@tamagui/lucide-icons"
import { useEffect, useRef, useState } from "react"
import {
  Platform,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputKeyPressEventData,
} from "react-native"

/** Server-side limit for a single sponsor chat message (`chatInput` schema). */
const MAX_MESSAGE_LENGTH = 16000
const MIN_INPUT_HEIGHT = 44
const MAX_INPUT_HEIGHT = 140
/** Vertical padding added on top of the text content height. */
const INPUT_VERTICAL_PADDING = 20

type ChatInputProps = {
  /** Resolves `true` when the message was sent; the text is kept otherwise. */
  onSend: (text: string) => Promise<boolean>
  disabled?: boolean
  /** A reply is streaming and can be stopped: Stop replaces Send. */
  canStop?: boolean
  onStop?: () => void
  bottomPadding: number | string
  /** Text of a failed send to restore into an empty input. */
  failedDraft?: string
  onFailedDraftConsumed?: () => void
}

/** react-native-web hands onKeyPress the DOM keyboard event. */
type WebKeyPressEvent = NativeSyntheticEvent<
  TextInputKeyPressEventData & {
    isComposing?: boolean
    shiftKey?: boolean
    keyCode?: number
  }
> & { shiftKey?: boolean; key?: string }

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  canStop,
  onStop,
  bottomPadding,
  failedDraft,
  onFailedDraftConsumed,
}) => {
  const [text, setText] = useState("")
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT)
  const sendingRef = useRef(false)
  const inputRef = useRef<TextInput>(null)

  // Restore the text of a send that failed while this input was not the one
  // waiting on it (e.g. the user switched conversations mid-send). An input
  // that still holds text keeps it.
  useEffect(() => {
    if (failedDraft === undefined) return
    setText((current) => (current.trim() ? current : failedDraft))
    onFailedDraftConsumed?.()
  }, [failedDraft, onFailedDraftConsumed])

  const handleSend = async () => {
    const message = text.trim()
    if (!message || disabled || sendingRef.current) return
    sendingRef.current = true
    try {
      // Keep the text visible until the send resolves, so a failure never
      // loses what was typed.
      const sent = await onSend(message)
      if (sent) {
        setText("")
        if (Platform.OS === "web") {
          setTimeout(() => inputRef.current?.focus(), 0)
        }
      }
    } finally {
      sendingRef.current = false
    }
  }

  const handleKeyPress = (event: WebKeyPressEvent) => {
    if (Platform.OS !== "web") return
    const key = event.key ?? event.nativeEvent.key
    const shiftKey = event.shiftKey ?? event.nativeEvent.shiftKey
    // keyCode 229: Safari reports IME commit keydowns with isComposing false.
    const isComposing =
      event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229
    if (key === "Enter" && !shiftKey && !isComposing) {
      event.preventDefault()
      void handleSend()
    }
  }

  const canSend = !!text.trim() && !disabled

  return (
    <YStack
      padding="$3"
      paddingBottom={bottomPadding}
      borderTopWidth={1}
      borderBottomWidth={0}
      borderColor="$color3"
      backgroundColor="$background"
      animation="quick"
    >
      <XStack gap="$2" alignItems="flex-end">
        <TextArea
          ref={inputRef}
          flex={1}
          // TextArea defaults to a fixed 4-line height; size it to its content
          // instead, between one line and a capped maximum.
          rows={undefined}
          numberOfLines={undefined}
          height={inputHeight}
          onContentSizeChange={(event) => {
            const contentHeight = event.nativeEvent.contentSize.height
            setInputHeight(
              Math.min(
                MAX_INPUT_HEIGHT,
                Math.max(
                  MIN_INPUT_HEIGHT,
                  Math.ceil(contentHeight) + INPUT_VERTICAL_PADDING,
                ),
              ),
            )
          }}
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          placeholder="Chat with your AI sponsor"
          value={text}
          onChangeText={setText}
          onKeyPress={handleKeyPress}
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!disabled}
          accessibilityLabel="Message your AI sponsor"
        />
        {canStop && onStop ? (
          <Button
            onPress={onStop}
            themeInverse
            icon={<Square size="$1" pointerEvents="none" />}
            accessibilityRole="button"
            accessibilityLabel="Stop the reply"
          />
        ) : (
          <Button
            onPress={() => void handleSend()}
            disabled={!canSend}
            themeInverse
            icon={<Send size="$1" pointerEvents="none" />}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
          />
        )}
      </XStack>
    </YStack>
  )
}
