import { XStack, YStack, TextArea, Button } from "tamagui"
import { Send, Square } from "@tamagui/lucide-icons"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  Platform,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputKeyPressEventData,
} from "react-native"

/** Server-side limit for a single sponsor chat message (`chatInput` schema). */
const MAX_MESSAGE_LENGTH = 16000
/** One line of input matches the Send/Stop button (Tamagui `$true` = 44). */
const MIN_INPUT_HEIGHT = 44
// Explicit typography and padding replace the TextArea size variant's
// (14px text on a 24px line, 13px vertical padding): one line is
// 2 × 11 padding + 20 line + 2 × 1 border = MIN_INPUT_HEIGHT, so the input and
// the button share their top and bottom edges, and the text sits centered.
const INPUT_FONT_SIZE = 16
const INPUT_LINE_HEIGHT = 20
const INPUT_PADDING_VERTICAL = 11
const INPUT_PADDING_HORIZONTAL = 14
const MAX_INPUT_HEIGHT = 140
const clampInputHeight = (height: number) =>
  Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, Math.ceil(height)))

/**
 * Measures the web textarea's content height, independent of its current
 * height.
 *
 * react-native-web reports `scrollHeight` as the content size, and a
 * textarea's `scrollHeight` is never below its own client height. Sizing the
 * box from that report feeds back on itself, so the input ratchets up to the
 * cap on mount and never shrinks. Collapsing the box for the read gives the
 * real content height (padding included).
 */
function measureWebInputHeight(node: unknown): number | undefined {
  if (typeof HTMLTextAreaElement === "undefined") return undefined
  if (!(node instanceof HTMLTextAreaElement)) {
    if (__DEV__) {
      console.warn("ChatInput: expected the web input ref to be a <textarea>")
    }
    return undefined
  }
  const border = node.offsetHeight - node.clientHeight
  const previousHeight = node.style.height
  const previousOverflow = node.style.overflow
  const previousScrollTop = node.scrollTop
  try {
    // Hidden overflow keeps a scrollbar from narrowing the text (and so
    // changing its wrapping) while the collapsed box is read.
    node.style.overflow = "hidden"
    node.style.height = "0px"
    return clampInputHeight(node.scrollHeight + border)
  } finally {
    node.style.height = previousHeight
    node.style.overflow = previousOverflow
    node.scrollTop = previousScrollTop
  }
}

type ChatInputProps = {
  /** Resolves `true` when the message was sent; the text is kept otherwise. */
  onSend: (text: string) => Promise<boolean>
  disabled?: boolean
  /** A reply is streaming and can be stopped: Stop replaces Send. */
  canStop?: boolean
  onStop?: () => void
  bottomPadding: number
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
  // Web only: native sizes itself (see the TextArea below).
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

  const isWeb = Platform.OS === "web"
  const measureWebHeight = useCallback(() => {
    const height = measureWebInputHeight(inputRef.current)
    if (height !== undefined) setInputHeight(height)
  }, [])

  // Web sizes the input from its measured content whenever the text changes
  // (after React commits the value, before paint).
  useLayoutEffect(() => {
    if (isWeb) measureWebHeight()
  }, [isWeb, text, measureWebHeight])

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
          fontSize={INPUT_FONT_SIZE}
          lineHeight={INPUT_LINE_HEIGHT}
          paddingVertical={INPUT_PADDING_VERTICAL}
          paddingHorizontal={INPUT_PADDING_HORIZONTAL}
          // Never size from onContentSizeChange: both platforms report a
          // size that depends on the box's own layout, so setting the height
          // from it loops (web ratchets to the cap; iOS re-reports on every
          // layout pass and flickers). Native sizes the multiline input to
          // its text during layout; web measures it (see
          // measureWebInputHeight) and re-measures when re-wrapping after a
          // width change.
          {...(isWeb
            ? { height: inputHeight, onLayout: measureWebHeight }
            : {
                minHeight: MIN_INPUT_HEIGHT,
                maxHeight: MAX_INPUT_HEIGHT,
                // Android centers text vertically by default; keep it at the
                // top, as on iOS, when the floor is taller than one line.
                textAlignVertical: "top" as const,
                // Android applies lineHeight to typed text only; without its
                // font padding the empty placeholder line also stays under 44.
                includeFontPadding: false,
              })}
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
