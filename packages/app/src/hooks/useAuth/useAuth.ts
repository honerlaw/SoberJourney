import {
  useAuth as useClerkAuth,
  useUser,
  useSignIn,
  useSignUp,
  isClerkAPIResponseError,
} from "@clerk/clerk-expo";
import { useReportError } from "@/src/hooks/useReportError/useReportError";

export function useAuth() {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth();
  const { user } = useUser();
  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { report } = useReportError();

  const login = async (emailAddress: string, password: string) => {
    try {
      if (!signIn) {
        return {
          success: false,
          error: "Sign in is not available",
        };
      }

      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      });

      // This indicates the user is signed in
      await setSignInActive({ session: completeSignIn.createdSessionId });
      return { success: true };
    } catch (err) {
      report(err);
      if (isClerkAPIResponseError(err)) {
        return {
          success: false,
          error: err.errors?.[0]?.message || "An error occurred during sign in",
        };
      }
      return {
        success: false,
        error: "An unexpected error occurred during sign in",
      };
    }
  };

  const signup = async (emailAddress: string, password: string) => {
    try {
      if (!signUp) {
        return {
          success: false,
          error: "Create account is not available",
        };
      }

      const completeSignUp = await signUp.create({
        emailAddress,
        password,
      });

      await completeSignUp.prepareEmailAddressVerification();
      await setSignUpActive({ session: completeSignUp.createdSessionId });
      return { success: true };
    } catch (err) {
      report(err);
      if (isClerkAPIResponseError(err)) {
        return {
          success: false,
          error:
            err.errors?.[0]?.message ||
            "An error occurred during account creation",
        };
      }
      return {
        success: false,
        error: "An unexpected error occurred during account creation",
      };
    }
  };

  const logout = async () => {
    try {
      await signOut();
      return { success: true };
    } catch (err) {
      report(err);
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "An error occurred during sign out",
      };
    }
  };

  return {
    isLoaded,
    isSignedIn,
    user,
    login,
    signup,
    logout,
  };
}
