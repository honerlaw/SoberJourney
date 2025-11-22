import { isClerkAPIResponseError, useSignUp } from "@clerk/clerk-expo";
import React from "react";
import { useReportError } from "../../../../../hooks/useReportError/useReportError";

type UseSignUpFormReturn = {
  emailAddress: string;
  setEmailAddress: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  verificationCode: string;
  setVerificationCode: (value: string) => void;
  errors: string[] | null;
  pendingVerification: boolean;
  onSignUpPress: () => Promise<void>;
  onVerifyPress: () => Promise<void>;
  isSigningUp: boolean;
  isVerifying: boolean;
};

export function useSignUpForm(): UseSignUpFormReturn {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [errors, setErrors] = React.useState<string[] | null>(null);
  const [isSigningUp, setIsSigningUp] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const { report } = useReportError();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");

  // Handle the submission of the sign-up form
  const onSignUpPress = async () => {
    setErrors(null);
    setIsSigningUp(true);

    if (!isLoaded) {
      setIsSigningUp(false);
      return;
    }

    // Start the sign-up process using the email and password provided
    try {
      await signUp.create({
        emailAddress,
        password,
      });

      // Send user an email with verification code
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // Set 'pendingVerification' to true to display second form
      // and capture OTP code
      setPendingVerification(true);
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        report(err);
        setErrors(err.errors.map((e) => e.longMessage || e.message));
      } else {
        report(err, "Failed to create account.");
      }
    } finally {
      setIsSigningUp(false);
    }
  };

  const onVerifyPress = async () => {
    setErrors(null);
    setIsVerifying(true);

    if (!isLoaded) {
      setIsVerifying(false);
      return;
    }

    try {
      // Use the code the user provided to attempt verification
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      // If verification was completed, set the session to active
      // and redirect the user
      if (signUpAttempt.status === "complete") {
        await setActive({ session: signUpAttempt.createdSessionId });
      } else {
        report(new Error(JSON.stringify(signUpAttempt, null, 2)));
      }
    } catch (err) {
      setErrors(["Invalid verification code."]);
      report(err);
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    emailAddress,
    setEmailAddress,
    password,
    setPassword,
    verificationCode,
    setVerificationCode,
    errors,
    pendingVerification,
    onSignUpPress,
    onVerifyPress,
    isSigningUp,
    isVerifying,
  };
}
