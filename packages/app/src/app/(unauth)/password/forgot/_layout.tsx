import React from "react";
import { Stack } from "expo-router";
import { ForgotPasswordProvider } from "@/src/components/flows/ForgotPasswordFlow/providers/ForgotPasswordProvider";

export default function ForgotPasswordLayout() {
  return (
    <ForgotPasswordProvider>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="index"
          options={{ headerTitle: "Forgot Password" }}
        />
        <Stack.Screen name="code" options={{ headerTitle: "Enter Code" }} />
        <Stack.Screen
          name="reset"
          options={{ headerTitle: "Reset Password" }}
        />
      </Stack>
    </ForgotPasswordProvider>
  );
}
