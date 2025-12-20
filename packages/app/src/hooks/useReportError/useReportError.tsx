import { useToastController } from "@tamagui/toast"
import * as Sentry from "@sentry/react-native"
import { useCallback, useEffect } from "react"

export function useReportError(error?: unknown) {
  const toast = useToastController()

  const report = useCallback(
    (error: unknown, displayMessage?: string) => {
      Sentry.captureException(error)

      if (process.env.NODE_ENV !== "production") {
        console.error(error, displayMessage)
      }

      if (displayMessage) {
        toast.show(displayMessage, {
          type: "error",
          native: false,
        })
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!error) {
      return
    }
    report(error)
  }, [error, report])

  return {
    report,
  }
}
