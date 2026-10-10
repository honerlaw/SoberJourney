import { useCallback, useEffect, useRef, useState } from "react"
import { Platform, type View } from "react-native"
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context"

/** Tamagui `$3`: the input's bottom padding when nothing sits below it. */
const BASE_PADDING = 13
/** Space between the input and the top of the keyboard. */
const KEYBOARD_GAP = 14

/**
 * Bottom padding that keeps the chat input above the tab bar and, while the
 * keyboard is up, above the keyboard. Neither platform resizes the window for
 * the keyboard (edge-to-edge on Android), so the input is lifted manually.
 *
 * Native tabs can't report the tab bar's height, and the screen sits
 * differently on each platform: on iOS it extends under the tab bar (whose
 * height is in the tab's safe-area inset), on Android it ends above it. So the
 * screen root's distance to the bottom of the safe-area frame is measured, and
 * only while the keyboard is hidden. On Android that frame and
 * `measureInWindow` share window coordinates; on iOS the frame is relative to
 * the tab's view controller, which covers the window from its origin. And: the keyboard never moves the root, and the padding this
 * returns never changes the root's size, so the measurement can't feed back on
 * itself.
 */
export function useInputBottomPadding(keyboardHeight: number) {
  const insets = useSafeAreaInsets()
  const frame = useSafeAreaFrame()
  const rootRef = useRef<View>(null)
  // Distance from the bottom of the screen root to the bottom of the frame.
  const [rootBottomOffset, setRootBottomOffset] = useState(0)

  const frameBottom = frame.y + frame.height
  const measure = useCallback(() => {
    if (Platform.OS === "web" || keyboardHeight > 0) return
    rootRef.current?.measureInWindow((_x, y, _width, height) => {
      setRootBottomOffset(Math.max(0, Math.round(frameBottom - (y + height))))
    })
  }, [keyboardHeight, frameBottom])

  // Root layouts taken while the keyboard is up are skipped, and the keyboard
  // never changes the root's size, so measure again once it hides.
  useEffect(() => {
    measure()
  }, [measure])

  const bottomPadding =
    keyboardHeight > 0
      ? Math.max(BASE_PADDING, keyboardHeight - rootBottomOffset + KEYBOARD_GAP)
      : Math.max(0, insets.bottom - rootBottomOffset) + BASE_PADDING

  return { bottomPadding, onRootLayout: measure, rootRef }
}
