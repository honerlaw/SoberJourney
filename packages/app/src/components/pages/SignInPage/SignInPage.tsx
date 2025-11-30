import { useRouter } from "expo-router";
import React from "react";
import {
  Button,
  Form,
  H3,
  Input,
  Separator,
  Stack,
  Text,
  XStack,
  YStack,
} from "tamagui";
import { KeyboardAvoiding } from "@/src/components/KeyboardAvoiding";
import { useSignInForm } from "./hooks/useSignInForm";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppleButton } from "@/src/components/pages/SignInPage/AppleButton";
import { GoogleButton } from "./GoogleButton";

export function SignInPage() {
  const router = useRouter();
  const {
    emailAddress,
    setEmailAddress,
    password,
    setPassword,
    errors,
    onSignInPress,
    isSigningIn,
  } = useSignInForm();

  const insets = useSafeAreaInsets();

  return (
    <>
      <KeyboardAvoiding>
        <Form
          onSubmit={onSignInPress}
          gap="$5"
          width={"75%"}
          maxWidth={"400px"}
        >
          <YStack borderRadius="$4" gap="$8">
            <YStack gap="$2" alignItems="center">
              <H3>Sign in</H3>
            </YStack>
            {errors &&
              errors.map((e) => (
                <Text color="$red10" key={e}>
                  {e}
                </Text>
              ))}
            <YStack gap="$3">
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
              <Form.Trigger asChild>
                <Button theme={"base"} disabled={isSigningIn} fontWeight={"600"}>
                  {isSigningIn ? "Signing in..." : "Sign in"}
                </Button>
              </Form.Trigger>

              <Stack justifyContent="center" alignItems="center" gap="$4">
                <Text onPress={() => router.push("/password/forgot")}>
                  Forgot your password?
                </Text>
              </Stack>
            </YStack>

            <XStack alignItems="center" gap="$4">
              <Separator />
              <Text color="$color11" fontSize="$3">
                or
              </Text>
              <Separator />
            </XStack>
            <YStack gap="$3">
              <AppleButton />
              <GoogleButton />
            </YStack>
          </YStack>
        </Form>
      </KeyboardAvoiding>
      <YStack alignItems="center" justifyContent="center" gap="$4">
        <Separator width={"100%"} borderColor="$borderColor" />
        <YStack
          marginBottom={insets.bottom * 1.3}
          width={"75%"}
          maxWidth={"400px"}
        >
          <Button size="$3" onPress={() => router.push("/signup")} themeInverse>
            <Text fontWeight="600">Create an account</Text>
          </Button>
        </YStack>
      </YStack>
    </>
  );
}
