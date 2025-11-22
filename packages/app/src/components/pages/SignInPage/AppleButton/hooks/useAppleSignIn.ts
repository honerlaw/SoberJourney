import { useSignIn, useSSO } from "@clerk/clerk-expo";
import React from "react";
import { useReportError } from "@/src/hooks/useReportError/useReportError";

type UseAppleSignInReturn = {
  isSigningIn: boolean;
  onAppleSignInPress: () => Promise<void>;
};

export function useAppleSignIn(): UseAppleSignInReturn {
  const { setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const { report } = useReportError();

  // Handle Apple Sign In
  const onAppleSignInPress = async () => {
    setIsSigningIn(true);

    if (!isLoaded) {
      setIsSigningIn(false);
      return;
    }

    try {
      const { createdSessionId } = await startSSOFlow({
        strategy: "oauth_apple",
      });

      if (createdSessionId) {
        await setActive({ session: createdSessionId });
      } else {
        report(
          new Error("Failed to complete Apple sign in."),
          "Failed to complete Apple sign in.",
        );
      }
    } catch (err) {
      report(err, "Failed to sign in with Apple.");
    } finally {
      setIsSigningIn(false);
    }
  };

  return {
    isSigningIn,
    onAppleSignInPress,
  };
}
