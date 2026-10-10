/**
 * Real-browser verification for the web chat input auto-grow fix.
 *
 * packages/app has no test runner, and jsdom has no layout, so this bundles
 * the real ChatInput (react-native-web + Tamagui, the app's tamagui.config)
 * with esbuild and drives headless Chrome, sampling the textarea height on
 * every animation frame.
 *
 * Run from the repo root after `npm ci` (needs Google Chrome installed):
 *
 *   npm i --no-save playwright-core@1.57.0
 *   node .minerva/work/2026-10-10-chat-input-web-autogrow/verify-chat-input-autogrow.mjs
 *
 * (or install playwright-core in any directory and run the script from there).
 *
 * `--component <path>` checks another ChatInput file (e.g. the pre-fix one
 * from `git show <ref>:packages/app/src/components/pages/SponsorPage/ChatInput/ChatInput.tsx`,
 * saved next to the original so its imports resolve); `--expect-ratchet`
 * then asserts the mount check FAILS, proving the harness detects the bug.
 */
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createRequire } from "node:module"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const appRoot = path.join(repoRoot, "packages/app")
const require = createRequire(path.join(repoRoot, "package.json"))
const esbuild = require("esbuild")
// playwright-core is not an app dependency: resolve it from the repo, or from
// the current directory (run from wherever it was installed).
const loadPlaywright = () => {
  try {
    return require("playwright-core")
  } catch {
    return createRequire(path.join(process.cwd(), "noop.js"))("playwright-core")
  }
}
const { chromium } = loadPlaywright()

const args = process.argv.slice(2)
const componentArg = args.indexOf("--component")
const component = path.resolve(
  componentArg >= 0
    ? args[componentArg + 1]
    : path.join(appRoot, "src/components/pages/SponsorPage/ChatInput/ChatInput.tsx"),
)
const expectRatchet = args.includes("--expect-ratchet")

const MIN = 44
const MAX = 140

const outDir = mkdtempSync(path.join(tmpdir(), "chat-input-verify-"))
const entry = path.join(outDir, "entry.tsx")
writeFileSync(
  entry,
  `
import React from "react"
import { createRoot } from "react-dom/client"
import { TamaguiProvider } from "tamagui"
import { config } from "@/tamagui.config"
import { ChatInput } from ${JSON.stringify(component)}

const heights: number[] = []
;(window as any).__heights = heights
const sample = () => {
  const ta = document.querySelector("textarea")
  if (ta) heights.push(ta.getBoundingClientRect().height)
  requestAnimationFrame(sample)
}
requestAnimationFrame(sample)

createRoot(document.getElementById("root")!).render(
  <TamaguiProvider config={config} defaultTheme="light">
    <div id="box" style={{ width: 400 }}>
      <ChatInput onSend={async () => true} bottomPadding="$3" />
    </div>
  </TamaguiProvider>,
)
`,
)
writeFileSync(
  path.join(outDir, "index.html"),
  `<!doctype html><html><body><div id="root"></div>
<script>window.process = { env: { NODE_ENV: "development", TAMAGUI_TARGET: "web" } }</script>
<script src="bundle.js"></script></body></html>`,
)
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  outfile: path.join(outDir, "bundle.js"),
  absWorkingDir: appRoot,
  nodePaths: [path.join(repoRoot, "node_modules")],
  alias: { "react-native": "react-native-web", "@": appRoot },
  resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".mjs", ".js"],
  define: {
    "process.env.NODE_ENV": '"development"',
    "process.env.TAMAGUI_TARGET": '"web"',
    __DEV__: "true",
    global: "window",
  },
  loader: { ".js": "jsx" },
  jsx: "automatic",
  logLevel: "error",
})

const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage()
const pageErrors = []
page.on("pageerror", (error) => pageErrors.push(error.message))
await page.goto(pathToFileURL(path.join(outDir, "index.html")).href)
await page.waitForSelector("textarea")

const sinceMark = async (ms) => {
  await page.evaluate(() => ((window).__mark = window.__heights.length))
  await page.waitForTimeout(ms)
  return page.evaluate(() => window.__heights.slice(window.__mark))
}
/** Heights over the next `frames` animation frames. */
const nextFrames = (frames) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const out = []
        const step = () => {
          out.push(document.querySelector("textarea").getBoundingClientRect().height)
          if (out.length >= n) resolve(out)
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    frames,
  )
const unique = (list) => [...new Set(list)]
const results = []
const check = (name, fn) => {
  try {
    fn()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`)
  }
}

// (a) Mount: every sampled frame since the first paint has the same height,
// the measured one-line height H1 (52px under the default Tamagui size: 13px
// padding x2 + 24px line + 2px border). The 44 clamp floor is native-tuned.
await page.waitForTimeout(1000)
const mountHeights = await page.evaluate(() => window.__heights.slice())
const oneLine = mountHeights[0]
// The one-line box must show its line without clipping or scrolling.
const oneLineFit = await page.evaluate(() => {
  const ta = document.querySelector("textarea")
  const cs = getComputedStyle(ta)
  const px = (v) => parseFloat(v) || 0
  // What one line needs: vertical padding + line height + borders.
  const need =
    px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.lineHeight) +
    px(cs.borderTopWidth) + px(cs.borderBottomWidth)
  return { scrollHeight: ta.scrollHeight, clientHeight: ta.clientHeight, need }
})
check(`(a) mount holds one-line height H1=${oneLine}, frames=${mountHeights.length} heights=${JSON.stringify(unique(mountHeights))}`, () => {
  assert.equal(unique(mountHeights).length, 1)
  assert.ok(oneLine >= MIN)
  // H1 is the one-line height, not just any stable height: the pre-fix
  // ratchet finishes before first paint, so it is stable too, at the cap.
  assert.equal(oneLine, Math.max(MIN, Math.ceil(oneLineFit.need)), `one-line need ${JSON.stringify(oneLineFit)}`)
  assert.ok(oneLineFit.scrollHeight <= oneLineFit.clientHeight, `one line clipped: ${JSON.stringify(oneLineFit)}`)
})

if (expectRatchet) {
  await browser.close()
  console.log(results.join("\n"))
  const ratcheted = results[0].startsWith("FAIL")
  console.log(ratcheted ? "OK (f): pre-fix ChatInput ratchets on mount" : "UNEXPECTED: pre-fix ChatInput did not ratchet")
  process.exit(ratcheted ? 0 : 1)
}

const textarea = page.locator("textarea")

// (b) Three short lines (well under the cap): grows inside (H1, 140) and holds for 30 frames.
await textarea.fill("one\ntwo\nthree")
await nextFrames(2)
const threeLines = await nextFrames(30)
check(`(b) 3 lines grow and hold, heights=${JSON.stringify(unique(threeLines))}`, () => {
  assert.equal(unique(threeLines).length, 1)
  assert.ok(threeLines[0] > oneLine && threeLines[0] < MAX)
})

// (c) Past the cap: 140px, scrolls, and scrollTop at the bottom survives a keystroke.
await textarea.fill(Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join("\n"))
await nextFrames(2)
const capped = await nextFrames(30)
const scroll = await page.evaluate(async () => {
  const ta = document.querySelector("textarea")
  ta.scrollTop = ta.scrollHeight
  await new Promise((r) => requestAnimationFrame(() => r()))
  return { scrollTop: ta.scrollTop, max: ta.scrollHeight - ta.clientHeight }
})
await textarea.press("End")
await textarea.pressSequentially("x")
await nextFrames(2)
const afterKey = await page.evaluate(() => {
  const ta = document.querySelector("textarea")
  return { scrollTop: ta.scrollTop, max: ta.scrollHeight - ta.clientHeight }
})
check(
  `(c) capped at ${MAX}px and scroll kept, heights=${JSON.stringify(unique(capped))} before=${JSON.stringify(scroll)} after=${JSON.stringify(afterKey)}`,
  () => {
    assert.deepEqual(unique(capped), [MAX])
    assert.ok(scroll.max > 0, "content overflows")
    assert.ok(Math.abs(afterKey.max - afterKey.scrollTop) <= 2, "scrollTop stays at the bottom")
  },
)

// (d) Clear: back to H1.
await textarea.fill("")
await nextFrames(2)
const cleared = await nextFrames(30)
check(`(d) cleared shrinks to H1=${oneLine}, heights=${JSON.stringify(unique(cleared))}`, () =>
  assert.deepEqual(unique(cleared), [oneLine]),
)

// (e) Width halved with wrapping text: re-measures larger, then holds.
await textarea.fill("a fairly long sentence that wraps more once the box gets narrower than before")
await nextFrames(2)
const wide = (await nextFrames(5)).at(-1)
await page.evaluate(() => (document.getElementById("box").style.width = "200px"))
await page.waitForTimeout(200)
const narrow = await nextFrames(30)
check(`(e) width halved re-measures and holds, wide=${wide} narrow=${JSON.stringify(unique(narrow))}`, () => {
  assert.equal(unique(narrow).length, 1)
  assert.ok(narrow[0] > wide)
})

check(`no page errors ${JSON.stringify(pageErrors)}`, () => assert.deepEqual(pageErrors, []))

await browser.close()
console.log(results.join("\n"))
process.exit(results.every((line) => line.startsWith("PASS")) ? 0 : 1)
