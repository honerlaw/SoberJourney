/**
 * Verification script for issue #30's pure date/derivation modules.
 *
 * packages/app has no unit-test runner (adding one is a follow-up), so this
 * stands in for the "unit tests" acceptance line. Run from the repo root after
 * `npm ci`, with TZ set in the environment BEFORE the process starts:
 *
 *   TZ=America/New_York npx tsx .minerva/work/2026-10-06-journeys-journal-fixes/verify-date-math.ts
 */
import assert from "node:assert/strict"
import {
  addDays,
  addHours,
  addMinutes,
  addSeconds,
  addYears,
} from "date-fns"
import { computeDurationSections } from "../../../packages/app/src/hooks/useDurationSections/computeDurationSections"
import { deriveResetHistory } from "../../../packages/app/src/components/pages/JourneyInfoPage/utils/deriveResetHistory"
import { dateToMinuteOfDay } from "../../../packages/app/src/components/NotificationSettings/utils/dateToMinuteOfDay"
import { isNotFoundError } from "../../../packages/app/src/components/pages/JourneyInfoPage/utils/isNotFoundError"

assert.equal(
  process.env.TZ,
  "America/New_York",
  "run with TZ=America/New_York set in the environment",
)

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

// ---------------------------------------------------------------- dateToMinuteOfDay
const at = (h: number, m: number) => new Date(2026, 9, 6, h, m, 0, 0)
const minuteCases: [number, number, number][] = [
  [9, 53, 600],
  [9, 7, 540],
  [9, 8, 555],
  [11, 52, 705],
  [12, 22, 735],
  [23, 53, 0],
  [0, 0, 0],
]
for (const [h, m, expected] of minuteCases) {
  check(`dateToMinuteOfDay ${h}:${String(m).padStart(2, "0")} -> ${expected}`, () =>
    assert.equal(dateToMinuteOfDay(at(h, m)), expected),
  )
}

// ---------------------------------------------------------------- computeDurationSections
type Parts = { y: number; d: number; h: number; m: number; s: number }
function parts(start: Date, now: Date): Parts {
  const [y, d, h, m, s] = computeDurationSections(start, now).map((x) => x.value)
  return { y, d, h, m, s }
}
function recomposes(start: Date, now: Date) {
  const p = parts(start, now)
  for (const v of Object.values(p)) assert.ok(v >= 0, `negative section ${JSON.stringify(p)}`)
  const back = addSeconds(
    addMinutes(addHours(addDays(addYears(start, p.y), p.d), p.h), p.m),
    p.s,
  )
  // seconds are whole, so up to 999 ms of sub-second remainder is expected
  const rest = now.getTime() - back.getTime()
  assert.ok(rest >= 0 && rest < 1000, `recompose ${JSON.stringify(p)} rest=${rest}ms`)
  return p
}

// (a) N calendar days at the same wall-clock time across DST -> days=N, hours=0
const dstCases: [string, Date, Date, number][] = [
  // spring forward 2026-03-08 02:00 -> 03:00 (23-hour day)
  ["spring: 03-07 10:00 -> 03-09 10:00", new Date(2026, 2, 7, 10), new Date(2026, 2, 9, 10), 2],
  ["spring: 03-01 22:15 -> 03-10 22:15", new Date(2026, 2, 1, 22, 15), new Date(2026, 2, 10, 22, 15), 9],
  // fall back 2026-11-01 02:00 -> 01:00 (25-hour day)
  ["fall: 10-31 10:00 -> 11-02 10:00", new Date(2026, 9, 31, 10), new Date(2026, 10, 2, 10), 2],
  ["fall: 10-20 00:30 -> 11-05 00:30", new Date(2026, 9, 20, 0, 30), new Date(2026, 10, 5, 0, 30), 16],
]
for (const [name, start, now, n] of dstCases) {
  check(`(a) DST ${name} -> ${n} days, 0h0m0s`, () => {
    const p = recomposes(start, now)
    assert.deepEqual(p, { y: 0, d: n, h: 0, m: 0, s: 0 })
  })
}
check("(a) old math was wrong here: elapsed hours %24 != 0 across spring-forward", () => {
  const start = new Date(2026, 2, 7, 10)
  const now = new Date(2026, 2, 9, 10)
  const elapsedHours = Math.floor((now.getTime() - start.getTime()) / 3_600_000)
  assert.equal(elapsedHours % 24, 23) // the old `differenceInHours % 24` showed 23 hours
})

// (b) known calendar offset
check("(b) 1y 2d 3h4m5s before now", () => {
  const now = new Date(2026, 9, 6, 12, 0, 0)
  const start = addSeconds(addMinutes(addHours(addDays(addYears(now, -1), -2), -3), -4), -5)
  const p = recomposes(start, now)
  assert.deepEqual(p, { y: 1, d: 2, h: 3, m: 4, s: 5 })
})

// (c) recomposition + non-negativity sweep across both transitions, hourly
check("(c) recompose + non-negative, hourly sweep across 2026 DST changes", () => {
  const starts = [
    new Date(2026, 2, 6, 12, 17, 33),
    new Date(2026, 9, 30, 12, 17, 33),
    new Date(2025, 2, 8, 1, 59, 59),
  ]
  for (const start of starts) {
    for (let i = 1; i < 24 * 6; i++) {
      recomposes(start, new Date(start.getTime() + i * 3_600_000 + 1234))
    }
  }
})

// (d) future start -> zeros
check("(d) future start -> all zeros", () => {
  const now = new Date(2026, 9, 6, 12)
  assert.deepEqual(parts(addDays(now, 1), now), { y: 0, d: 0, h: 0, m: 0, s: 0 })
  assert.deepEqual(parts(addSeconds(now, 1), now), { y: 0, d: 0, h: 0, m: 0, s: 0 })
  assert.deepEqual(parts(now, now), { y: 0, d: 0, h: 0, m: 0, s: 0 })
})

// (e) starts adjacent to the skipped hour and inside the repeated hour
check("(e) start 2026-03-08 01:30 (just before skipped hour), +3h elapsed", () => {
  const start = new Date(2026, 2, 8, 1, 30)
  const now = new Date(start.getTime() + 3 * 3_600_000) // 05:30 EDT
  const p = recomposes(start, now)
  assert.deepEqual(p, { y: 0, d: 0, h: 3, m: 0, s: 0 })
})
check("(e) start 2026-11-01 01:30 EDT (repeated hour), +1h and +26h elapsed", () => {
  const start = new Date(2026, 10, 1, 1, 30) // first 01:30 (EDT)
  assert.equal(start.getTimezoneOffset(), 240)
  recomposes(start, new Date(start.getTime() + 3_600_000))
  recomposes(start, new Date(start.getTime() + 26 * 3_600_000))
})

// (f) hours stay <= 23, except the documented 25-hour fall-back day
check("(f) hours <= 23 on ordinary and spring days (sweep)", () => {
  const start = new Date(2026, 2, 1, 0, 0)
  for (let i = 0; i < 24 * 20; i++) {
    const p = parts(start, new Date(start.getTime() + i * 3_600_000 + 60_000))
    assert.ok(p.h <= 23, JSON.stringify(p))
  }
})
check("(f) fall-back day: 00:00 -> 23:30 same calendar day reads 24h30m (documented)", () => {
  const start = new Date(2026, 10, 1, 0, 0)
  const now = new Date(2026, 10, 1, 23, 30)
  const p = recomposes(start, now)
  assert.deepEqual(p, { y: 0, d: 0, h: 24, m: 30, s: 0 })
})

// ---------------------------------------------------------------- deriveResetHistory
const e = (id: string, iso: string) => ({ id, createdAt: new Date(iso) })
const start = e("start", "2026-01-01T10:00:00Z")
const r1 = e("r1", "2026-02-01T10:00:00Z")
const r2 = e("r2", "2026-03-15T10:00:00Z")

check("deriveResetHistory [r2, r1, start] (server order, newest first)", () => {
  const h = deriveResetHistory([r2, r1, start])
  assert.equal(h.startEntry, start)
  assert.equal(h.currentEntry, r2)
  assert.equal(h.resets.length, 2)
  assert.equal(h.resets[0].entry, r2)
  assert.equal(h.resets[0].previousAt.getTime(), r1.createdAt.getTime())
  assert.equal(h.resets[0].number, 2)
  assert.equal(h.resets[1].entry, r1)
  assert.equal(h.resets[1].previousAt.getTime(), start.createdAt.getTime())
  assert.equal(h.resets[1].number, 1)
  assert.ok(!h.resets.some((r) => r.entry === start), "journey start listed as a reset")
})
check("deriveResetHistory shuffled input -> same result", () => {
  const a = deriveResetHistory([r2, r1, start])
  for (const order of [[start, r1, r2], [r1, start, r2], [r1, r2, start]]) {
    const b = deriveResetHistory(order)
    assert.equal(b.startEntry, a.startEntry)
    assert.equal(b.currentEntry, a.currentEntry)
    assert.deepEqual(
      b.resets.map((r) => [r.entry.id, r.number, r.previousAt.getTime()]),
      a.resets.map((r) => [r.entry.id, r.number, r.previousAt.getTime()]),
    )
  }
})
check("deriveResetHistory [start] -> no resets", () => {
  const h = deriveResetHistory([start])
  assert.equal(h.startEntry, start)
  assert.equal(h.currentEntry, start)
  assert.deepEqual(h.resets, [])
})
check("deriveResetHistory [] -> undefined entries, no resets", () => {
  const h = deriveResetHistory([] as { id: string; createdAt: Date }[])
  assert.equal(h.startEntry, undefined)
  assert.equal(h.currentEntry, undefined)
  assert.deepEqual(h.resets, [])
})
check("deriveResetHistory equal createdAt -> deterministic tie-break by id", () => {
  const a = e("a", "2026-02-01T10:00:00Z")
  const b = e("b", "2026-02-01T10:00:00Z")
  const h1 = deriveResetHistory([a, b, start])
  const h2 = deriveResetHistory([b, a, start])
  assert.deepEqual(
    h1.resets.map((r) => r.entry.id),
    h2.resets.map((r) => r.entry.id),
  )
})
check("deriveResetHistory accepts ISO strings (superjson-less callers)", () => {
  const h = deriveResetHistory([
    { id: "x", createdAt: "2026-02-01T10:00:00Z" },
    { id: "y", createdAt: "2026-01-01T10:00:00Z" },
  ])
  assert.equal(h.resets.length, 1)
  assert.equal(h.resets[0].entry.id, "x")
})

// ---------------------------------------------------------------- isNotFoundError
check("isNotFoundError", () => {
  assert.equal(isNotFoundError({ data: { code: "NOT_FOUND" } }), true)
  assert.equal(isNotFoundError({ shape: { data: { code: "NOT_FOUND" } } }), true)
  assert.equal(isNotFoundError({ data: { code: "BAD_REQUEST" } }), false)
  assert.equal(isNotFoundError(new Error("x")), false)
  assert.equal(isNotFoundError(null), false)
  assert.equal(isNotFoundError("NOT_FOUND"), false)
})

console.log(`\n${passed} checks passed`)
