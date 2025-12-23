import React from "react"
import { useRouter } from "expo-router"
import { YStack } from "tamagui"
import { ScrollView } from "react-native"
import { HeroSection } from "./HeroSection"
import { FeaturesSection } from "./FeaturesSection"
import { FooterSection } from "./FooterSection"

export function LandingPage() {
  const router = useRouter()

  const handleGetStarted = () => {
    router.push("/signup")
  }

  const handleSignIn = () => {
    router.push("/signin")
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <YStack flex={1} backgroundColor="$background">
        <HeroSection onGetStarted={handleGetStarted} onSignIn={handleSignIn} />
        <FeaturesSection />
        <FooterSection />
      </YStack>
    </ScrollView>
  )
}
