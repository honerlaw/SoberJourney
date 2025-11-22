import React from "react";
import { Button, Text, XStack } from "tamagui";
import { useGoogleSignIn } from "./hooks";
import GoogleIcon from "@/assets/google-icon.svg";

export const GoogleButton: React.FC = () => {
  const { signIn, isLoading } = useGoogleSignIn();

  return (
    <Button
      onPress={signIn}
      disabled={isLoading}
      size="$4"
      opacity={isLoading ? 0.5 : 1}
    >
      <XStack alignItems="center" justifyContent="center" gap="$3">
        <GoogleIcon width={20} height={20} />
        <Text fontSize="$4" fontWeight="500">
          {isLoading ? "Signing in..." : "Sign in with Google"}
        </Text>
      </XStack>
    </Button>
  );
};
