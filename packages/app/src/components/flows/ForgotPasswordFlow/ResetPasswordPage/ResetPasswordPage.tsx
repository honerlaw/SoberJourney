import React from "react"
import { router } from "expo-router"
import { Button, Form, H3, Input, Stack, Text, YStack } from "tamagui"
import { KeyboardAvoiding } from "@/src/components/KeyboardAvoiding"
import { useForgotPasswordContext } from "@/src/components/flows/ForgotPasswordFlow/providers/ForgotPasswordProvider"

export const ResetPasswordPage: React.FC = () => {
  const {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    errors,
    isSubmitting,
    onPasswordSubmit,
    goBackToCodeStep,
  } = useForgotPasswordContext()

  const handleSubmit = async () => {
    const result = await onPasswordSubmit()
    if (result === "sign_in_required") {
      // Leave the forgot-password flow for the existing sign-in screen.
      router.dismissAll()
      if (router.canGoBack()) {
        router.back()
      } else {
        router.replace("/signin")
      }
    }
    // "signed_in": the session is active, so the Stack.Protected guards move
    // the user into the app. "failed": stay here with the error shown.
  }

  const handleBackPress = () => {
    goBackToCodeStep()
    router.back()
  }
  return (
    <KeyboardAvoiding>
      <Form onSubmit={handleSubmit} gap="$5" width={"75%"} maxWidth={"400px"}>
        <YStack borderRadius="$4" gap="$5">
          <H3>Reset your password</H3>
          <Text color="$gray11">
            Enter your new password below. Make sure it&apos;s at least 8
            characters long.
          </Text>
          {errors &&
            errors.map((e) => (
              <Text color="$red10" key={e}>
                {e}
              </Text>
            ))}
          <Input
            secureTextEntry
            autoCapitalize="none"
            value={password}
            placeholder="New password"
            onChangeText={(password) => setPassword(password)}
          />
          <Input
            secureTextEntry
            autoCapitalize="none"
            value={confirmPassword}
            placeholder="Confirm new password"
            onChangeText={(confirmPassword) =>
              setConfirmPassword(confirmPassword)
            }
          />
          <Form.Trigger asChild>
            <Button disabled={isSubmitting || !password || !confirmPassword}>
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
          </Form.Trigger>

          <Stack justifyContent="center" alignItems="center">
            <Text onPress={handleBackPress}>Back to code entry</Text>
          </Stack>
        </YStack>
      </Form>
    </KeyboardAvoiding>
  )
}
