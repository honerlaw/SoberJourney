import React from "react";
import { Button, Text, XStack } from "tamagui";
import { useThemeMode } from "@/src/providers/AppThemeProvider/ThemeContext";
import AppleLightIcon from "@/assets/apple/black_medium.svg";
import AppleDarkIcon from "@/assets/apple/white_medium.svg";
import { useAppleSignIn } from "./hooks/useAppleSignIn";

export const AppleButton: React.FC = () => {
  const { currentTheme } = useThemeMode();
  const isLight = currentTheme === "light";
  const { isSigningIn, onAppleSignInPress } = useAppleSignIn();

  // Apple design guidelines: use black button for standard, white for light mode alternative
  const AppleIcon = isLight ? AppleLightIcon : AppleDarkIcon;

  return (
    <Button
      size="$4"
      onPress={onAppleSignInPress}
      disabled={isSigningIn}
      opacity={isSigningIn ? 0.5 : 1}
    >
      <XStack alignItems="center" justifyContent="center" gap="$3">
        <AppleIcon />
        <Text fontSize="$4" fontWeight="500">
          {isSigningIn ? "Signing in..." : "Sign in with Apple"}
        </Text>
      </XStack>
    </Button>
  );
};
