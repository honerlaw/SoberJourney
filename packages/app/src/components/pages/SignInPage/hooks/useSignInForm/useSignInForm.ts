import { useSignIn } from "@clerk/clerk-expo";
import React from "react";
import { useReportError } from "@/src/hooks/useReportError/useReportError";

type UseSignInFormReturn = {
  emailAddress: string;
  setEmailAddress: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  errors: string[] | null;
  onSignInPress: () => Promise<void>;
  isSigningIn: boolean;
};

export function useSignInForm(): UseSignInFormReturn {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [errors, setErrors] = React.useState<string[] | null>(null);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const { report } = useReportError();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");

  // Handle the submission of the sign-in form
  const onSignInPress = async () => {
    setErrors(null);
    setIsSigningIn(true);

    if (!isLoaded) {
      setIsSigningIn(false);
      return;
    }

    // Start the sign-in process using the email and password provided
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      // If sign-in process is complete, set the created session as active
      // and redirect the user
      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        // router.replace('/')
      } else {
        report(
          new Error(
            JSON.stringify(
              {
                status: signInAttempt.status,
              },
              null,
              2,
            ),
          ),
        );
      }
    } catch (err) {
      report(err, "Invalid email or password.");
    } finally {
      setIsSigningIn(false);
    }
  };

  return {
    emailAddress,
    setEmailAddress,
    password,
    setPassword,
    errors,
    onSignInPress,
    isSigningIn,
  };
}
