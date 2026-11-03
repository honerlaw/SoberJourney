/**
 * Options for `clerkMiddleware`.
 *
 * `authorizedParties` is opt-in through CLERK_AUTHORIZED_PARTIES, a
 * comma-separated list of origins (e.g. "https://www.soberjourney.app").
 * When set, Clerk rejects a session token whose `azp` claim names any other
 * origin, which closes same-site token reuse from a sibling subdomain. It is
 * not on by default: a wrong value fails auth with 401, and released apps log
 * the user out on 401. Verify the `azp` that native and web tokens carry
 * before enabling it (see the knowledge entry on security limits).
 *
 * Read straight from process.env, like `debug`: a config load failure must
 * never change auth behaviour.
 */
export function parseAuthorizedParties(
  value: string | undefined,
): string[] | undefined {
  const parties = (value ?? "")
    .split(",")
    .map((party) => party.trim())
    .filter((party) => party.length > 0);
  return parties.length > 0 ? parties : undefined;
}

export function buildClerkOptions(env: Record<string, string | undefined> = process.env) {
  const authorizedParties = parseAuthorizedParties(
    env.CLERK_AUTHORIZED_PARTIES,
  );
  return {
    debug: env.NODE_ENV !== "production",
    enableHandshake: true,
    ...(authorizedParties ? { authorizedParties } : {}),
  };
}
