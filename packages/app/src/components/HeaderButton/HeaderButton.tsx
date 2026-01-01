import { useLiquidGlass } from "@/src/hooks/useLiquidGlass"
import React, { useState } from "react"
import { Platform, Pressable, StyleSheet } from "react-native"
import { Button, View } from "tamagui"
import { useRouter, useNavigation } from "expo-router"
import { GlassView } from "expo-glass-effect"

type HeaderButtonProps = {
  onPress?: () => void | Promise<void>
  href?: Parameters<ReturnType<typeof useRouter>["push"]>[0] | "openDrawer"
  icon: React.ComponentType<{ size?: string; pointerEvents?: "none" | "auto" }>
  disabled?: boolean
  forceGlass?: boolean // some scenarios the glass effect is not implemented by default in expo, this is a workaround to force it on
}

const GLASS_BUTTON_SIZE = 44

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  onPress,
  href,
  icon: IconComponent,
  disabled,
  forceGlass,
}) => {
  const { isLiquidGlassEnabled } = useLiquidGlass()
  const router = useRouter()
  const navigation = useNavigation()
  const [isPressed, setIsPressed] = useState(false)

  const isAndroid = Platform.OS === "android"
  const isWeb = Platform.OS === "web"

  const handlePress = () => {
    if (onPress) {
      return onPress()
    }
    if (href) {
      if (
        href === "openDrawer" &&
        Object.prototype.hasOwnProperty.call(navigation, "openDrawer")
      ) {
        return (
          navigation as unknown as { openDrawer: () => void }
        ).openDrawer()
      }
      if (href !== "openDrawer") {
        return router.push(href)
      }
    }
  }

  const renderedButton = (
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
    />
  )

  if (forceGlass) {
    return (
      <Pressable
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.glassButtonContainer,
          pressed && styles.glassButtonPressed,
        ]}
      >
        <GlassView
          style={[
            styles.glassView,
            {
              opacity: isPressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={[styles.glassInner]}>
            <IconComponent size={"$1.5"} pointerEvents="none" />
          </View>
        </GlassView>
      </Pressable>
    )
  }

  return renderedButton
}

const styles = StyleSheet.create({
  glassButtonContainer: {
    width: GLASS_BUTTON_SIZE,
    height: GLASS_BUTTON_SIZE,
    borderRadius: GLASS_BUTTON_SIZE / 2,
    // iOS glass-style shadow
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  glassButtonPressed: {
    transform: [{ scale: 1.08 }],
  },
  glassView: {
    width: "100%",
    height: "100%",
    borderRadius: GLASS_BUTTON_SIZE / 2,
    overflow: "hidden",
  },
  glassInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: GLASS_BUTTON_SIZE / 2,
  },
})
