import { useRouter } from "expo-router";
import React from "react";
import { Button, Form, H1, H3, Input, Stack, Text, YStack } from "tamagui";
import { KeyboardAvoiding } from "@/src/components/KeyboardAvoiding";
import { useSignUpForm } from "./hooks/useSignUpForm";
import { VerificationForm } from "./VerificationForm";

export function SignUpPage() {
  const router = useRouter();
  const {
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
  } = useSignUpForm();

  if (pendingVerification) {
    return (
      <VerificationForm
        verificationCode={verificationCode}
        setVerificationCode={setVerificationCode}
        errors={errors}
        onVerifyPress={onVerifyPress}
        isVerifying={isVerifying}
      />
    );
  }

  return (
    <KeyboardAvoiding>
      <Form onSubmit={onSignUpPress} gap="$5" width={"75%"} maxWidth={"400px"}>
        <YStack borderRadius="$4" gap="$5">
          <H1>SoberJourney</H1>
          <H3>Create account</H3>
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
            placeholder="Enter email"
            onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
          />
          <Input
            value={password}
            placeholder="Enter password"
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
          />

          <Stack
            justifyContent="center"
            alignItems="center"
            paddingHorizontal="$2"
          >
            <Text fontSize="$2" textAlign="center" color="$gray10">
              By creating an account, you agree to our{" "}
              <Text
                fontSize="$2"
                color="$primary"
                textDecorationLine="underline"
                onPress={() => router.push("/")}
              >
                terms of service
              </Text>
            </Text>
          </Stack>

          <Form.Trigger asChild>
            <Button disabled={isSigningUp}>
              {isSigningUp ? "Creating..." : "Create account"}
            </Button>
          </Form.Trigger>

          <Stack justifyContent="center" alignItems="center">
            <Text
              onPress={() =>
                router.canGoBack() ? router.back() : router.push("/signin")
              }
            >
              Already have an account? Sign in.
            </Text>
          </Stack>
        </YStack>
      </Form>
    </KeyboardAvoiding>
  );
}
