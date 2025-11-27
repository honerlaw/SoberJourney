import { Redirect } from "expo-router";
import { useAuth } from "@/src/hooks/useAuth";
import { LoadingView } from "@/src/components/LoadingView";
import { Platform } from "react-native";

export default function Page() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingView />;
  }

  if (isSignedIn) {
    return <Redirect href="/dashboard" />;
  }

  // native, so go ahead and show the signin page
  if (Platform.OS !== "web") {
    return <Redirect href="/signin" />;
  }

  // @todo landing page on web
  return null
}
