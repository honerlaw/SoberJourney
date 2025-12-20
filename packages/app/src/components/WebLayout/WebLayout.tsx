import React from "react"
import { Platform } from "react-native"
import { View, YStack } from "tamagui"

type WebLayoutProps = {
  children: React.ReactNode
}

export const WebLayout: React.FC<WebLayoutProps> = ({ children }) => {
  // On web, constrain to mobile dimensions and center
  if (Platform.OS === "web") {
    return (
      <View flex={1} alignItems="center" justifyContent="flex-start">
        <YStack
          flex={1}
          width="100%"
          maxWidth={428} // iPhone 14 Pro Max width
          overflow="hidden"
        >
          {children}
        </YStack>
      </View>
    )
  }

  // On mobile, render normally without constraints
  return <>{children}</>
}
