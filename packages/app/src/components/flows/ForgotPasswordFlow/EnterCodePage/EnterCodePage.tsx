import { useRouter } from "expo-router"
import React from "react"
import { Button, Form, H3, Input, Stack, Text, YStack } from "tamagui"
import { KeyboardAvoiding } from "@/src/components/KeyboardAvoiding"
import { useForgotPasswordContext } from "../providers/ForgotPasswordProvider"

export const EnterCodePage: React.FC = () => {
  const router = useRouter()
  const { emailAddress, code, setCode, errors, isSubmitting, onCodeSubmit } =
    useForgotPasswordContext()

  const handleCodeSubmit = async () => {
    const success = await onCodeSubmit()
    if (success) {
      // Navigate to the dedicated password reset route
      router.push("/password/forgot/reset")
    }
  }

  const handleBackPress = () => {
    router.back()
  }
  return (
    <KeyboardAvoiding>
      <Form
        onSubmit={handleCodeSubmit}
        gap="$5"
        width={"75%"}
        maxWidth={"400px"}
      >
        <YStack borderRadius="$4" gap="$5">
          <H3>Enter verification code</H3>
          <Text color="$gray11">
            We&apos;ve sent a 6-digit verification code to {emailAddress}. Enter
            it below to continue.
          </Text>
          {errors &&
            errors.map((e) => (
              <Text color="$red10" key={e}>
                {e}
              </Text>
            ))}
          <Input
            keyboardType="number-pad"
            autoCapitalize="none"
            value={code}
            placeholder="Enter 6-digit code"
            maxLength={6}
            onChangeText={(code) => setCode(code)}
            textAlign="center"
            fontSize="$6"
            letterSpacing="$2"
          />
          <Form.Trigger asChild>
            <Button disabled={isSubmitting || code.length !== 6}>
              {isSubmitting ? "Verifying..." : "Verify code"}
            </Button>
          </Form.Trigger>

          <Stack justifyContent="center" alignItems="center" gap="$3">
            <Text onPress={handleBackPress}>Back to email entry</Text>
            <Text color="$gray11" fontSize="$3" textAlign="center">
              Didn&apos;t receive the code? Check your spam folder.
            </Text>
          </Stack>
        </YStack>
      </Form>
    </KeyboardAvoiding>
  )
}
