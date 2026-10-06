import { useCallback, useEffect, useMemo, useRef } from "react"
import { useToastController } from "@tamagui/toast"
import { useReportError } from "../useReportError"
import { getErrorMessage } from "./getErrorMessage"

export function useToastError() {
  const { report } = useReportError()
  const toast = useToastController()

  // Latest report/toast, read by the stable `handleError` below. Written in an
  // effect (not during render) so React Compiler can keep memoizing callers.
  const reportRef = useRef(report)
  const toastRef = useRef(toast)
  useEffect(() => {
    reportRef.current = report
    toastRef.current = toast
  }, [report, toast])

  // Referentially stable: consumers list it in effect dependency arrays.
  // Never throws, so it is safe inside callers' `catch` blocks.
  const handleError = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      try {
        reportRef.current(error)
      } catch {
        // reporting must never break error handling
      }
      try {
        toastRef.current.show(getErrorMessage(error, fallbackMessage), {
          type: "error",
          native: false,
        })
      } catch {
        // no toast provider mounted
      }
    },
    [],
  )

  return useMemo(() => ({ handleError }), [handleError])
}
