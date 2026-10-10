/**
 * Real-browser check that the chat input and its Send button line up: with an
 * empty input, the textarea and the button have the same height and their
 * tops and bottoms coincide, and the textarea uses the explicit 16/20/11/14
 * typography and padding (so the overrides beat Tamagui's size variant).
 *
 * Bundles the real ChatInput (react-native-web + Tamagui, the app's
 * tamagui.config) as the 2026-10-10-chat-input-web-autogrow harness does, and
 * measures it in headless Chrome. Run from the repo root after `npm ci`
 * (needs Google Chrome installed):
 *
 *   npm i --no-save playwright-core@1.57.0
 *   node .minerva/work/2026-10-10-chat-input-alignment/verify-chat-input-alignment.mjs
 *
 * `--component <path>` checks another ChatInput file; against the pre-change
 * one (52px textarea vs 44px button) it must fail.
 */
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

const outDir = mkdtempSync(path.join(tmpdir(), "chat-input-align-"))
const entry = path.join(outDir, "entry.tsx")
writeFileSync(
  entry,
  `
import React from "react"
import { createRoot } from "react-dom/client"
import { TamaguiProvider } from "tamagui"
import { config } from "@/tamagui.config"
import { ChatInput } from ${JSON.stringify(component)}

function Harness() {
  const [failedDraft, setFailedDraft] = React.useState<string | undefined>()
  ;(window as any).__setFailedDraft = setFailedDraft
  return (
    <div id="box" style={{ width: 400 }}>
      <ChatInput
        onSend={async () => {
          ;(window as any).__sent = ((window as any).__sent ?? 0) + 1
          return true
        }}
        bottomPadding="$3"
        failedDraft={failedDraft}
        onFailedDraftConsumed={() => setFailedDraft(undefined)}
      />
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <TamaguiProvider config={config} defaultTheme="light">
    <Harness />
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
const pageErrors = []
let m
try {
  const page = await browser.newPage()
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(pathToFileURL(path.join(outDir, "index.html")).href)
  await page.waitForSelector("textarea")

  await page.waitForTimeout(500)
  m = await page.evaluate(() => {
    const ta = document.querySelector("textarea")
    const button = document.querySelector('[aria-label="Send message"]')
    const rect = (el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, height: r.height }
    }
    const cs = getComputedStyle(ta)
    return {
      input: rect(ta),
      button: rect(button),
      style: {
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
      },
    }
  })
} finally {
  await browser.close()
  rmSync(outDir, { recursive: true, force: true })
}

const results = []
const check = (name, fn) => {
  try {
    fn()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`)
  }
}

check(`input and button equal height input=${JSON.stringify(m.input)} button=${JSON.stringify(m.button)}`, () => {
  assert.equal(m.button.height, 44)
  assert.equal(m.input.height, m.button.height)
})
check("tops and bottoms coincide within 0.5px", () => {
  assert.ok(Math.abs(m.input.top - m.button.top) <= 0.5, `top ${m.input.top} vs ${m.button.top}`)
  assert.ok(Math.abs(m.input.bottom - m.button.bottom) <= 0.5, `bottom ${m.input.bottom} vs ${m.button.bottom}`)
})
check(`textarea typography/padding ${JSON.stringify(m.style)}`, () => {
  assert.deepEqual(m.style, {
    fontSize: "16px",
    lineHeight: "20px",
    paddingTop: "11px",
    paddingBottom: "11px",
    paddingLeft: "14px",
    paddingRight: "14px",
  })
})
check(`no page errors ${JSON.stringify(pageErrors)}`, () => assert.deepEqual(pageErrors, []))

console.log(results.join("\n"))
process.exit(results.every((line) => line.startsWith("PASS")) ? 0 : 1)
