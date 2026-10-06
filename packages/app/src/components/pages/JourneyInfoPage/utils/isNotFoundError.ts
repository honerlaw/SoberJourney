type MaybeTRPCError = {
  data?: { code?: unknown } | null
  shape?: { data?: { code?: unknown } | null } | null
}

/**
 * True when a tRPC client error carries the NOT_FOUND code — e.g. the
 * `journey.get` query for a journey that was deleted (stale deep link).
 */
export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const { data, shape } = error as MaybeTRPCError
  const code = data?.code ?? shape?.data?.code
  return code === "NOT_FOUND"
}
