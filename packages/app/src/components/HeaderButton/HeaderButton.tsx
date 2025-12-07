import { useLiquidGlass } from "@/src/hooks/useLiquidGlass";
import React from "react";
import { Platform } from "react-native";
import { Button } from "tamagui";

type HeaderButtonProps = {
  onPress: () => void | Promise<void>;
  icon: React.ComponentType<{ size?: string, pointerEvents?: "none" | "auto" }>;
};

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  onPress,
  icon: IconComponent,
}) => {
  const { isLiquidGlassEnabled } = useLiquidGlass();

  return (
    <Button
      size="$3"
      circular
      icon={() => <IconComponent size={"$1"} pointerEvents="none" />}
      marginHorizontal={Platform.OS === "web" ? "$4" : undefined}
      backgroundColor={isLiquidGlassEnabled ? "transparent" : undefined}
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
    />
  );
};
