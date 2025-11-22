import React, { createContext, useContext, useState, ReactNode } from "react";
import { useSignIn } from "@clerk/clerk-expo";
import { useToastController } from "@tamagui/toast";
import { useReportError } from "@/src/hooks/useReportError";

export type ForgotPasswordStep = "email" | "code" | "password";

type ForgotPasswordState = {
  currentStep: ForgotPasswordStep;
  emailAddress: string;
  code: string;
  password: string;
  confirmPassword: string;
  errors: string[];
  isSubmitting: boolean;
};

type ForgotPasswordActions = {
  setEmailAddress: (value: string) => void;
  setCode: (value: string) => void;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  onEmailSubmit: () => Promise<boolean>;
  onCodeSubmit: () => Promise<boolean>;
  onPasswordSubmit: () => Promise<boolean>;
  resetForm: () => void;
  goBackToEmailStep: () => void;
  goBackToCodeStep: () => void;
};

type ForgotPasswordContextValue = ForgotPasswordState & ForgotPasswordActions;

const ForgotPasswordContext = createContext<
  ForgotPasswordContextValue | undefined
>(undefined);

type ForgotPasswordProviderProps = {
  children: ReactNode;
};

export const ForgotPasswordProvider: React.FC<ForgotPasswordProviderProps> = ({
  children,
}) => {
  const [currentStep, setCurrentStep] = useState<ForgotPasswordStep>("email");
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { signIn } = useSignIn();
  const toast = useToastController();
  const { report } = useReportError();
  const validateEmail = (email: string): boolean => {
    if (!email.trim()) {
      setErrors(["Please enter your email address"]);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors(["Please enter a valid email address"]);
      return false;
    }

    return true;
  };

  const validateCode = (code: string): boolean => {
    if (!code.trim()) {
      setErrors(["Please enter the verification code"]);
      return false;
    }

    if (code.length !== 6) {
      setErrors(["Please enter a valid 6-digit code"]);
      return false;
    }

    return true;
  };

  const validatePasswords = (
    password: string,
    confirmPassword: string,
  ): boolean => {
    if (!password.trim()) {
      setErrors(["Please enter your new password"]);
      return false;
    }

    if (password.length < 8) {
      setErrors(["Password must be at least 8 characters long"]);
      return false;
    }

    if (password !== confirmPassword) {
      setErrors(["Passwords do not match"]);
      return false;
    }

    return true;
  };

  const onEmailSubmit = async (): Promise<boolean> => {
    if (!validateEmail(emailAddress)) return false;

    setErrors([]);
    setIsSubmitting(true);

    try {
      await signIn?.create({
        strategy: "reset_password_email_code",
        identifier: emailAddress,
      });
      return true;
    } catch (error) {
      report(error);
      setErrors(["Failed to send verification code. Please try again."]);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const onCodeSubmit = async (): Promise<boolean> => {
    if (!validateCode(code)) return false;

    setErrors([]);
    setIsSubmitting(true);

    try {
      // Prepare the sign in attempt with the code but don't finalize yet
      await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code,
      });
      setCurrentStep("password");
      return true;
    } catch (error) {
      report(error);
      setErrors(["Invalid verification code. Please check and try again."]);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPasswordSubmit = async (): Promise<boolean> => {
    if (!validatePasswords(password, confirmPassword)) return false;

    setErrors([]);
    setIsSubmitting(true);

    try {
      await signIn?.resetPassword({
        password: password,
      });
      // Password reset successful
      toast.show("Password reset successful!", {
        type: "success",
        native: false,
      });
      return true;
    } catch (error) {
      report(error, "Failed to reset password. Please try again.");
      resetToEmailStep();
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetToEmailStep = () => {
    setCurrentStep("email");
    setEmailAddress("");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setErrors([]);
    setIsSubmitting(false);
  };

  const resetForm = () => {
    resetToEmailStep();
  };

  const goBackToEmailStep = () => {
    setCurrentStep("email");
    setCode("");
    setErrors([]);
  };

  const goBackToCodeStep = () => {
    setCurrentStep("code");
    setPassword("");
    setConfirmPassword("");
    setErrors([]);
  };

  const contextValue: ForgotPasswordContextValue = {
    // State
    currentStep,
    emailAddress,
    code,
    password,
    confirmPassword,
    errors,
    isSubmitting,
    // Actions
    setEmailAddress,
    setCode,
    setPassword,
    setConfirmPassword,
    onEmailSubmit,
    onCodeSubmit,
    onPasswordSubmit,
    resetForm,
    goBackToEmailStep,
    goBackToCodeStep,
  };

  return (
    <ForgotPasswordContext.Provider value={contextValue}>
      {children}
    </ForgotPasswordContext.Provider>
  );
};

export const useForgotPasswordContext = () => {
  const context = useContext(ForgotPasswordContext);
  if (context === undefined) {
    throw new Error(
      "useForgotPasswordContext must be used within a ForgotPasswordProvider",
    );
  }
  return context;
};
