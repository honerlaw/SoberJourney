// Checks the import-free privacy helpers (the app has no test runner):
//   node --experimental-strip-types scripts/check-privacy-helpers.mjs
import assert from "node:assert/strict"
import {
  scrubBreadcrumb,
  stripQuery,
} from "../src/utils/sentryScrub/sentryScrub.ts"
import { safeNotificationPath } from "../src/utils/notificationPath/notificationPath.ts"

// Sentry breadcrumbs
assert.equal(
  scrubBreadcrumb({ category: "console", message: "journal text" }),
  null,
)
assert.deepEqual(
  scrubBreadcrumb({
    category: "xhr",
    data: {
      method: "GET",
      url: "https://www.soberjourney.app/api/trpc/journal.get?batch=1&input=%7B%7D",
      status_code: 200,
    },
  }),
  {
    category: "xhr",
    data: {
      method: "GET",
      url: "https://www.soberjourney.app/api/trpc/journal.get",
      status_code: 200,
    },
  },
)
assert.deepEqual(
  scrubBreadcrumb({ category: "fetch", data: { url: "/api/trpc/x#frag" } }),
  { category: "fetch", data: { url: "/api/trpc/x" } },
)
const navigation = { category: "navigation", data: { from: "a", to: "b" } }
assert.equal(scrubBreadcrumb(navigation), navigation)
const noData = { category: "xhr" }
assert.equal(scrubBreadcrumb(noData), noData)
assert.equal(stripQuery("/plain"), "/plain")

// Notification paths
const allowed = [
  "/(auth)/checkin-new?journeyId=11111111-1111-4111-8111-111111111111",
  "/(auth)/(drawer)/(tabs)/dashboard",
  "/(auth)/checkin-new?at=2026-11-03T10:00:00Z",
]
for (const url of allowed) assert.equal(safeNotificationPath(url), url, url)

const rejected = [
  undefined,
  42,
  "",
  "https://evil.example",
  "//evil.example/(auth)/x",
  "tel:123",
  "soberjourney://(auth)/x",
  "javascript:alert(1)",
  "/(auth)\\evil",
  "/(auth)/x\\y",
  "/(auth)/javascript:alert(1)",
  "/(auth)/../outside",
  "/(auth)/x\u0000",
  "/(public)/sign-in",
  "(auth)/relative",
]
for (const url of rejected)
  assert.equal(safeNotificationPath(url), null, String(url))

console.log("privacy helpers: all checks passed")
