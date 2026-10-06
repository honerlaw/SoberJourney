import { useCallback } from "react"
import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-expo"
import { useQueryClient } from "@tanstack/react-query"
import { useReportError } from "@/src/hooks/useReportError/useReportError"
import { endSession } from "./endSession"

export function useAuth() {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { report } = useReportError()

  // Signs out and clears every cached query (see endSession).
  const logout = useCallback(async () => {
    try {
      await endSession({ signOut, queryClient })
      return { success: true as const }
    } catch (err) {
      report(err)
      return {
        success: false as const,
        error:
          err instanceof Error
            ? err.message
            : "An error occurred during sign out",
      }
    }
  }, [signOut, queryClient, report])

  return {
    isLoaded,
    isSignedIn,
    user,
    logout,
  }
}
