// Pure error -> user-facing message mapping. Kept free of React/Expo imports and
// path aliases so it can be exercised directly with `node --experimental-strip-types`.

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again."
export const NETWORK_ERROR_MESSAGE =
  "Unable to reach SoberJourney. Check your connection and try again."

// tRPC error codes whose server message is written for the user (epic rule 4:
// server error messages are plain strings).
const USER_FACING_CODES = new Set([
  "BAD_REQUEST",
  "NOT_FOUND",
  "FORBIDDEN",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
  "PAYLOAD_TOO_LARGE",
])

type TRPCLikeError = {
  name: string
  message: string
  data?: { code?: unknown } | null
}

// Structural check so this file stays import-free. Mirrors tRPC's own
// `isTRPCClientError` (an object whose `name` is "TRPCClientError").
function isTRPCLikeError(error: unknown): error is TRPCLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TRPCClientError"
  )
}

// Zod validation errors arrive as a JSON array of issues in `message`.
// Returns the first issue's message, `null` for any other JSON (never shown raw),
// or `undefined` when the message is a plain string.
function parseJsonMessage(message: string): string | null | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(message)
  } catch {
    return undefined // not JSON: a plain-string message (any non-zod error)
  }
  try {
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first: unknown = parsed[0]
      if (
        first &&
        typeof first === "object" &&
        "message" in first &&
        typeof first.message === "string" &&
        first.message.trim().length > 0
      ) {
        return first.message
      }
    }
  } catch {
    // malformed issue shape
  }
  return null
}

/**
 * Map any thrown value to a message suitable for a toast. Never throws.
 *
 * Order: zod JSON message -> plain message of a user-facing 4xx tRPC error ->
 * `fallbackMessage` -> network / generic text.
 */
export function getErrorMessage(
  error: unknown,
  fallbackMessage?: string,
): string {
  try {
    if (isTRPCLikeError(error)) {
      const message = typeof error.message === "string" ? error.message : ""
      const jsonMessage = parseJsonMessage(message)
      if (jsonMessage) {
        return jsonMessage
      }

      const code = error.data?.code
      if (
        typeof code === "string" &&
        USER_FACING_CODES.has(code) &&
        jsonMessage === undefined &&
        message.trim().length > 0
      ) {
        return message
      }

      if (fallbackMessage) {
        return fallbackMessage
      }

      // No `data` means the request never got a tRPC response (offline, DNS,
      // aborted, non-tRPC gateway error).
      if (!error.data) {
        return NETWORK_ERROR_MESSAGE
      }
      return GENERIC_ERROR_MESSAGE
    }
  } catch {
    // fall through to the fallback
  }
  return fallbackMessage || GENERIC_ERROR_MESSAGE
}
