/**
 * Development-only behaviour (stack traces in tRPC errors, Clerk debug logs)
 * is on only when NODE_ENV is exactly "development". The production deploy
 * does not pin NODE_ENV, so an unset or unexpected value must fail closed.
 */
export function isDevelopment(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "development";
}
