import { isLiquidGlassAvailable } from "expo-glass-effect";

export function useLiquidGlass() {
  return {
    isLiquidGlassEnabled: isLiquidGlassAvailable(),
  };
}
