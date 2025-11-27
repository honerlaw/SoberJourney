import React from "react";
import { Button, Form, H3, Input, Text, YStack } from "tamagui";
import { KeyboardAvoiding } from "@/src/components/KeyboardAvoiding";

type VerificationFormProps = {
  verificationCode: string;
  setVerificationCode: (code: string) => void;
  errors: string[] | null;
  onVerifyPress: () => Promise<void>;
  isVerifying: boolean;
};

export function VerificationForm({
  verificationCode,
  setVerificationCode,
  errors,
  onVerifyPress,
  isVerifying,
}: VerificationFormProps) {
  return (
    <KeyboardAvoiding>
      <Form onSubmit={onVerifyPress} gap="$5" width={"75%"} maxWidth={"400px"}>
        <YStack borderRadius="$4" gap="$5">
          <H3>Create account</H3>
          <Text>
            Please enter the 6-digit verification code sent to your email
            address.
          </Text>
          {errors &&
            errors.map((e) => (
              <Text color="$red10" key={e}>
                {e}
              </Text>
            ))}
          <Input
            value={verificationCode}
            placeholder="Enter verification code"
            onChangeText={(code) => setVerificationCode(code)}
          />
          <Form.Trigger asChild>
            <Button disabled={isVerifying}>
              {isVerifying ? "Verifying..." : "Verify"}
            </Button>
          </Form.Trigger>
        </YStack>
      </Form>
    </KeyboardAvoiding>
  );
}
