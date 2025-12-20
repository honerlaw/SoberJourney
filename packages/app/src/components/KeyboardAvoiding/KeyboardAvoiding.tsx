import React from "react"
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { Stack } from "tamagui"

export type KeyboardAvoidingProps = {
  children: React.ReactNode
}

export const KeyboardAvoiding = React.forwardRef<
  ScrollView,
  KeyboardAvoidingProps
>(({ children }, ref) => {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        ref={ref}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Stack
          flex={1}
          justifyContent={"center"}
          alignItems={"center"}
          minHeight={"100%"}
        >
          {children}
        </Stack>
      </ScrollView>
    </KeyboardAvoidingView>
  )
})

KeyboardAvoiding.displayName = "KeyboardAvoiding"
