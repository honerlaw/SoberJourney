import { Stack } from "expo-router"
import "react-native-reanimated"
import { AppLayout } from "@/src/components/AppLayout"
import * as Sentry from "@sentry/react-native"
import { useAuth } from "@clerk/clerk-expo"

function Routes() {
  const { isSignedIn } = useAuth()
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
