import { useLiquidGlass } from "@/src/hooks/useLiquidGlass"
import React from "react"
import { Platform } from "react-native"
import { Button } from "tamagui"
import { useRouter } from "expo-router"

type HeaderButtonProps = {
  onPress?: () => void | Promise<void>
  href?: Parameters<ReturnType<typeof useRouter>["push"]>[0]
  icon: React.ComponentType<{ size?: string; pointerEvents?: "none" | "auto" }>
  /** Screen-reader name; the button shows only an icon. */
  label: string
  disabled?: boolean
}

/**
 * An icon button for a native header's left/right slot. On iOS 26 the header
 * hosts it in a bar button item drawn on the system Liquid Glass background,
 * so the button itself stays transparent.
 */
export const HeaderButton: React.FC<HeaderButtonProps> = ({
  onPress,
  href,
  icon: IconComponent,
  label,
  disabled,
}) => {
  const { isLiquidGlassEnabled } = useLiquidGlass()
  const router = useRouter()

  const isAndroid = Platform.OS === "android"
  const isWeb = Platform.OS === "web"

  const handlePress = () => {
    if (onPress) {
      return onPress()
    }
    if (href) {
      return router.push(href)
    }
  }

  return (
    <Button
      size="$3"
      circular
      icon={() => <IconComponent size={"$1.5"} pointerEvents="none" />}
      marginHorizontal={isWeb || isAndroid ? "$2" : undefined}
      backgroundColor={"transparent"}
      hoverStyle={
        isLiquidGlassEnabled
          ? { backgroundColor: "transparent", borderWidth: 0 }
          : undefined
      }
      pressStyle={
        isLiquidGlassEnabled
          ? { backgroundColor: "transparent", borderWidth: 0 }
          : undefined
      }
      onPress={handlePress}
      disabled={disabled}
      // `accessible` makes the button itself the VoiceOver element on iOS, so
      // the label is read instead of descending into the unlabeled icon.
      accessible
      aria-label={label}
    />
  )
}
