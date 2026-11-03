/**
 * Breadcrumb scrubbing for Sentry.init's `beforeBreadcrumb`.
 *
 * - Console breadcrumbs are dropped. Sentry React Native records every
 *   console call as a breadcrumb and syncs it to the native scope at full
 *   depth, where native crash, ANR and app-hang events pick it up. Any console
 *   output can carry decrypted journal or chat text, so none is sent.
 * - Request breadcrumbs (xhr/fetch) keep their URL without the query string
 *   or fragment. tRPC GET requests put the procedure input in `?input=…`.
 *
 * Kept import-free so it can be checked with plain node
 * (scripts/check-privacy-helpers.mjs); the app has no test runner.
 */

type BreadcrumbLike = {
  category?: string
  data?: { [key: string]: unknown }
}

const REQUEST_CATEGORIES = new Set(["xhr", "fetch"])

/** Removes everything from the first `?` or `#` on. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

export function scrubBreadcrumb<T extends BreadcrumbLike>(
  breadcrumb: T,
): T | null {
  if (breadcrumb.category === "console") {
    return null
  }

  const url = breadcrumb.data?.url
  if (
    breadcrumb.category !== undefined &&
    REQUEST_CATEGORIES.has(breadcrumb.category) &&
    typeof url === "string"
  ) {
    return { ...breadcrumb, data: { ...breadcrumb.data, url: stripQuery(url) } }
  }

  return breadcrumb
}
