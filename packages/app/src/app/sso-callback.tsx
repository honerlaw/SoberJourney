import { Redirect } from "expo-router"

// we get the session id and redirect to the dashboard
export default function SSOCallback() {
  return <Redirect href="/" />
}
