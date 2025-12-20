import React from "react"
import { ClerkProvider } from "@clerk/clerk-expo"
import { tokenCache } from "@clerk/clerk-expo/token-cache"
import { useConfig } from "../ConfigProvider"

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const config = useConfig()

  return (
    <ClerkProvider
      publishableKey={config.clerkPublishableKey}
      tokenCache={tokenCache}
    >
      {children}
    </ClerkProvider>
  )
}
