import { LoadingView } from "@/src/components/LoadingView"
import { useAuth } from "@/src/hooks/useAuth"
import { Redirect, Stack, useRouter, useSegments } from "expo-router"
import { WebLayout } from "@/src/components/WebLayout"
import React from "react"
import { HeaderButton } from "@/src/components/HeaderButton"
import { Pencil, PlusCircle, User } from "@tamagui/lucide-icons"

export const unstable_settings = {
  initialRouteName: "(tabs)",
}

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  // Determine which tab is active based on route segments
  const isJournalTab = (segments as string[]).includes("journal")
  const isSponsorTab = (segments as string[]).includes("sponsor")

  if (!isLoaded) {
    return <LoadingView />
  }

  if (!isSignedIn) {
    return <Redirect href="/" />
  }

  const renderHeaderRight = () => {
    if (isSponsorTab) {
      return null
    }
    if (isJournalTab) {
      return (
        <HeaderButton
          icon={Pencil}
          onPress={() => router.push("/journal-new")}
        />
      )
    }
    // Dashboard tab (default)
    return (
      <HeaderButton
        icon={PlusCircle}
        onPress={() => router.push("/journeys-new")}
      />
    )
  }

  return (
    <WebLayout>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerTitle: "SoberJourney",
            headerRight: renderHeaderRight,
            headerLeft: () => (
              <HeaderButton
                icon={User}
                onPress={() => router.push("/profile")}
              />
            ),
          }}
        />

        {/* Journey Routes */}
        <Stack.Screen
          name="journeys-new"
          options={{
            headerTitle: "New Journey",
          }}
        />
        <Stack.Screen
          name="journeys-modify"
          options={{
            headerTitle: "Edit Journey",
          }}
        />
        <Stack.Screen
          name="journeys-info"
          options={{
            headerTitle: "Journey Details",
          }}
        />

        {/* Journal Routes */}
        <Stack.Screen
          name="journal-new"
          options={{
            headerTitle: "New Entry",
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            headerTitle: "Profile",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </WebLayout>
  )
}
