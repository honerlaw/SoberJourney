import { useRouter } from "expo-router";
import React from "react";
import { Button, Form, H3, Input, Stack, Text, YStack } from "tamagui";
import { KeyboardAvoiding } from "@/src/components/KeyboardAvoiding";
import { useForgotPasswordContext } from "../providers/ForgotPasswordProvider";
import { ResetPasswordPage } from "../ResetPasswordPage";

export const ForgotPasswordPage: React.FC = () => {
  const router = useRouter();
  const {
    currentStep,
    emailAddress,
    setEmailAddress,
    errors,
    isSubmitting,
    onEmailSubmit,
  } = useForgotPasswordContext();

  const handleEmailSubmit = async () => {
    const success = await onEmailSubmit();
    if (success) {
      router.push("/password/forgot/code");
    }
  };

  // Show password reset step when user returns from code verification
  if (currentStep === "password") {
    return <ResetPasswordPage />;
  }

  // Default to email step
  return (
    <KeyboardAvoiding>
      <Form
        onSubmit={handleEmailSubmit}
        gap="$5"
        width={"75%"}
        maxWidth={"400px"}
      >
        <YStack borderRadius="$4" gap="$5">
          <H3>Forgot password</H3>
          <Text color="$gray11">
            Enter your email address and we&apos;ll send you a verification code
            to reset your password.
          </Text>
          {errors &&
            errors.map((e) => (
              <Text color="$red10" key={e}>
                {e}
              </Text>
            ))}
          <Input
            keyboardType="email-address"
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Enter your email address"
            onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
          />
          <Form.Trigger asChild>
            <Button disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send verification code"}
            </Button>
          </Form.Trigger>

          <Stack justifyContent="center" alignItems="center">
            <Text onPress={() => router.push("/signin")}>
              Remember your password? Sign in.
            </Text>
          </Stack>
        </YStack>
      </Form>
    </KeyboardAvoiding>
  );
};
