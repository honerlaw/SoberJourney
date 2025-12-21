import { useLiquidGlass } from "@/src/hooks/useLiquidGlass"
import React from "react"
import { Platform } from "react-native"
import { Button } from "tamagui"

type HeaderButtonProps = {
  onPress: () => void | Promise<void>
  icon: React.ComponentType<{ size?: string; pointerEvents?: "none" | "auto" }>
  disabled?: boolean
}

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  onPress,
  icon: IconComponent,
  disabled,
}) => {
  const { isLiquidGlassEnabled } = useLiquidGlass()

  const isAndroid = Platform.OS === "android"
  const isWeb = Platform.OS === "web"

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
      onPress={onPress}
      disabled={disabled}
    />
  )
}
