import { Stack } from "expo-router"
import "react-native-reanimated"
import { AppLayout } from "@/src/components/AppLayout"
import * as Sentry from "@sentry/react-native"
import { useAuth } from "@clerk/clerk-expo"
import { useEffect, useState } from "react"
import { LoadingView } from "@/src/components/LoadingView"
import { ErrorView } from "@/src/components/ErrorView"
import { usePushNotifications } from "@/src/hooks/usePushNotifications"

// How long to wait for Clerk before telling the user something is wrong.
const AUTH_LOAD_TIMEOUT_MS = 15_000

function useAuthLoadTimedOut(isLoaded: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (isLoaded) {
      return
    }
    const timer = setTimeout(() => setTimedOut(true), AUTH_LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isLoaded])
  return timedOut
}

function Routes() {
  const { isLoaded, isSignedIn } = useAuth()
  const authLoadTimedOut = useAuthLoadTimedOut(isLoaded)

  // Handles notification taps (incl. cold start). Lives here, inside Clerk and
  // next to the navigator, so it can wait for auth + navigation readiness.
  usePushNotifications()

  // Until Clerk has loaded, both Stack.Protected guards would be false and
  // expo-router would redirect away from the requested URL (web refresh /
  // deep link). Render no navigator until the guards are meaningful. The root
  // layout already renders a non-navigator first (ConfigProvider's loader).
  if (!isLoaded) {
    if (authLoadTimedOut) {
      // Keep waiting: the Stack renders as soon as Clerk loads.
      return (
        <ErrorView message="Having trouble connecting. Check your internet connection; we'll keep trying." />
      )
    }
    return <LoadingView />
  }

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
      }}
    >
      {/* Unprotected Routes */}
      <Stack.Protected guard={isSignedIn === false}>
        <Stack.Screen
          name="(unauth)/signin"
          options={{ headerTitle: "", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="(unauth)/signup"
          options={{ headerTitle: "", headerBackTitle: "Sign in" }}
        />
        <Stack.Screen
          name="(unauth)/password/forgot"
          options={{ headerTitle: "", headerBackTitle: "Sign in" }}
        />
      </Stack.Protected>

      {/* Protected Routes */}
      <Stack.Protected guard={isSignedIn === true}>
        {/* Drawer Routes */}
        <Stack.Screen
          name="(auth)/(drawer)"
          options={{ headerShown: false, headerTitle: "Dashboard" }}
        />

        {/* Journey Routes */}
        <Stack.Screen
          name="(auth)/journeys-new"
          options={{
            headerTitle: "New Journey",
          }}
        />
        <Stack.Screen
          name="(auth)/journeys-modify"
          options={{
            headerTitle: "Edit Journey",
          }}
        />
        <Stack.Screen
          name="(auth)/journeys-info"
          options={{
            headerTitle: "Journey Details",
          }}
        />

        {/* Journal Routes */}
        <Stack.Screen
          name="(auth)/journal-new"
          options={{
            headerTitle: "New Entry",
          }}
        />
        <Stack.Screen
          name="(auth)/journal-info"
          options={{
            headerTitle: "Journal Entry",
          }}
        />

        {/* Check-in Routes */}
        <Stack.Screen
          name="(auth)/checkin-new"
          options={{
            headerTitle: "Daily Check-in",
          }}
        />

        {/* Profile Routes */}
        <Stack.Screen
          name="(auth)/profile"
          options={{
            headerTitle: "Profile",
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
          }}
        />
      </Stack.Protected>

      {/* Public / Always Available Routes */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
      <Stack.Screen
        name="privacy"
        options={{
          headerTitle: "Privacy Policy",
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="terms"
        options={{
          headerTitle: "Terms of Service",
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="+not-found"
        options={{
          headerTitle: "Not Found",
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="support"
        options={{
          headerTitle: "Support",
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      />
    </Stack>
  )
}

function RootLayout() {
  return (
    <AppLayout>
      <Routes />
    </AppLayout>
  )
}

export default Sentry.wrap(RootLayout)
