/**
 * Real-browser verification for the web layout polish (header title gap, web
 * tab bar padding, progress-bar label stacking).
 *
 * Bundles the real `(tabs)/_layout.web.tsx`, `dashboard/_layout.tsx`,
 * `TabStackLayout`, `HeaderButton`, `DurationProgressBar`, `WebLayout` and
 * `JourneyInfoHeader` with esbuild (react-native-web + Tamagui, the app's
 * tamagui.config) and drives headless Chrome. Only expo-router's file-based
 * routing is stubbed: `Stack`/`Tabs` map their `<X.Screen>` children onto
 * expo-router's own forked navigators (`expo-router/native-stack`,
 * `expo-router/js-tabs`), so the header and tab bar are the production ones.
 * Not covered: route files/URLs, the drawer wrapper, authenticated data.
 *
 * Needs SDK 57 dependencies (`npm ci`; expo-router 57 installs nested under
 * packages/app/node_modules) and Google Chrome. playwright-core is not an app
 * dependency:
 *
 *   npm i --no-save playwright-core@1.57.0     # anywhere
 *   node .minerva/work/2026-10-10-web-layout-polish/verify-web-layout.mjs
 *
 * `--ref <git-ref>` loads the three changed files (TabStackLayout, the web
 * tabs layout, DurationProgressBar) from that ref instead of the working tree, and
 * `--expect-fail` then asserts that every fix-guarding check FAILS and that the
 * measured numbers match the bug as reported (calibration).
 * `--shots <dir>` saves screenshots.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createRequire } from "node:module"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const appRoot = path.join(repoRoot, "packages/app")
const require = createRequire(path.join(repoRoot, "package.json"))
const esbuild = require("esbuild")
const loadPlaywright = () => {
  try {
    return require("playwright-core")
  } catch {
    return createRequire(path.join(process.cwd(), "noop.js"))("playwright-core")
  }
}
const { chromium } = loadPlaywright()

const args = process.argv.slice(2)
const argValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const ref = argValue("--ref")
const expectFail = args.includes("--expect-fail")
const shots = argValue("--shots")
if (shots) mkdirSync(shots, { recursive: true })

// expo-router 57 (with its forked react-navigation) installs nested under the
// app; a stale root install would otherwise resolve first. Fail loudly.
const appRequire = createRequire(path.join(appRoot, "package.json"))
const routerDir = path.dirname(appRequire.resolve("expo-router/package.json"))
const routerVersion = JSON.parse(readFileSync(path.join(routerDir, "package.json"), "utf8")).version
if (!existsSync(path.join(routerDir, "js-tabs.js"))) {
  throw new Error(`expo-router ${routerVersion} at ${routerDir} has no js-tabs: run npm ci (SDK 57 deps)`)
}
const expoDir = path.dirname(appRequire.resolve("expo/package.json"))
const modulesCoreDir = path.dirname(
  createRequire(path.join(expoDir, "package.json")).resolve("expo-modules-core/package.json"),
)

const tabsDir = path.join(appRoot, "src/app/(auth)/(drawer)/(tabs)")
const changedFiles = [
  path.join(appRoot, "src/components/TabStackLayout/TabStackLayout.tsx"),
  path.join(tabsDir, "_layout.web.tsx"),
  path.join(appRoot, "src/components/DurationProgressBar/DurationProgressBar.tsx"),
]

const outDir = mkdtempSync(path.join(tmpdir(), "web-layout-verify-"))
const stubRouter = path.join(outDir, "stub-expo-router.tsx")
writeFileSync(
  stubRouter,
  `
import React from "react"
import { createNativeStackNavigator } from "ernav/native-stack"
import { createBottomTabNavigator } from "ernav/js-tabs"
import { useNavigation } from "ernav/react-navigation"

const screens = () => (window as any).__screens as Record<string, React.ComponentType>

function make(nav: any) {
  const Navigator: any = ({ children, screenOptions }: any) => (
    <nav.Navigator screenOptions={screenOptions}>
      {React.Children.toArray(children).map((child: any) => (
        <nav.Screen
          key={child.props.name}
          name={child.props.name}
          options={child.props.options}
          component={screens()[child.props.name]}
        />
      ))}
    </nav.Navigator>
  )
  // Rendered inside a screen (e.g. JourneyInfoHeader), Stack.Screen sets the
  // screen's options, as expo-router's does.
  Navigator.Screen = ({ options }: any) => {
    const navigation = useNavigation()
    React.useLayoutEffect(() => {
      if (options) navigation.setOptions(options)
    }, [navigation, options])
    return null
  }
  return Navigator
}

export const Stack = make(createNativeStackNavigator())
export const Tabs = make(createBottomTabNavigator())
export const router = {
  push(href: unknown) {
    ;((window as any).__pushed ??= []).push(href)
  },
}
export const useRouter = () => router
`,
)
writeFileSync(path.join(outDir, "stub-glass.ts"), "export const isLiquidGlassAvailable = () => false\n")

const entry = path.join(outDir, "entry.tsx")
writeFileSync(
  entry,
  `
import React from "react"
import { createRoot } from "react-dom/client"
import { TamaguiProvider, YStack, Text } from "tamagui"
import { NavigationContainer, DefaultTheme } from "ernav/react-navigation"
import { Stack } from "expo-router"
import { SafeAreaProvider, SafeAreaInsetsContext } from "react-native-safe-area-context"
import { config } from "@/tamagui.config"
import TabsLayout from ${JSON.stringify(path.join(tabsDir, "_layout.web.tsx"))}
import DashboardLayout from ${JSON.stringify(path.join(tabsDir, "dashboard/_layout.tsx"))}
import { TabStackLayout } from "@/src/components/TabStackLayout"
import { DurationProgressBar } from "@/src/components/DurationProgressBar"
import { WebLayout } from "@/src/components/WebLayout"
import { JourneyInfoHeader } from "@/src/components/pages/JourneyInfoPage/JourneyInfoHeader"

const params = new URLSearchParams(location.search)
const insetBottom = Number(params.get("insetBottom") ?? 0)

const Dashboard = () => (
  <YStack padding="$4" gap="$3" testID="dashboard">
    <YStack borderRadius="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$color2" padding="$4" gap="$3">
      <Text fontSize="$7" fontWeight="600">Alcohol</Text>
      <DurationProgressBar value={0} max={2000} label="days" singularLabel="day" />
      <DurationProgressBar value={1234} max={2000} label="days" singularLabel="day" />
      <DurationProgressBar value={2000} max={2000} label="days" singularLabel="day" />
    </YStack>
  </YStack>
)
const JourneyInfo = () => (
  <YStack testID="journey">
    <JourneyInfoHeader journeyId="1" journeyTitle="Alcohol and late-night snacking" onDeletePress={() => {}} />
  </YStack>
)

;(window as any).__screens = {
  dashboard: DashboardLayout,
  sponsor: () => <TabStackLayout title="Sponsor" />,
  journal: () => <TabStackLayout title="Journal" />,
  index: Dashboard,
  journey: JourneyInfo,
}

const App = () =>
  params.get("scenario") === "journey" ? (
    <WebLayout>
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", headerShadowVisible: false }}>
        <Stack.Screen name="journey" />
      </Stack>
    </WebLayout>
  ) : (
    <WebLayout>
      <TabsLayout />
    </WebLayout>
  )

createRoot(document.getElementById("root")!).render(
  <SafeAreaProvider>
    <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, left: 0, bottom: insetBottom }}>
      <TamaguiProvider config={config} defaultTheme="light">
        <NavigationContainer theme={DefaultTheme}>
          <App />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaInsetsContext.Provider>
  </SafeAreaProvider>,
)
`,
)
writeFileSync(
  path.join(outDir, "index.html"),
  `<!doctype html><html><head><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style></head>
<body><div id="root"></div>
<script>window.process = { env: { NODE_ENV: "development", TAMAGUI_TARGET: "web", EXPO_OS: "web" } }</script>
<script src="bundle.js"></script></body></html>`,
)

const refSources = new Map()
if (ref) {
  for (const file of changedFiles) {
    const rel = path.relative(repoRoot, file)
    refSources.set(file, execFileSync("git", ["-C", repoRoot, "show", `${ref}:${rel}`], { encoding: "utf8" }))
  }
}

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  outfile: path.join(outDir, "bundle.js"),
  absWorkingDir: appRoot,
  nodePaths: [path.join(appRoot, "node_modules"), path.join(repoRoot, "node_modules")],
  alias: {
    "react-native": "react-native-web",
    "@": appRoot,
    ernav: routerDir,
    "expo-glass-effect": path.join(outDir, "stub-glass.ts"),
    "expo-modules-core": modulesCoreDir,
  },
  resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".mjs", ".js"],
  define: {
    "process.env.NODE_ENV": '"development"',
    "process.env.TAMAGUI_TARGET": '"web"',
    "process.env.EXPO_OS": '"web"',
    __DEV__: "true",
    global: "window",
  },
  loader: { ".js": "jsx", ".png": "dataurl" },
  jsx: "automatic",
  logLevel: "error",
  plugins: [
    {
      name: "stub-router-and-ref",
      setup(build) {
        build.onResolve({ filter: /^expo-router$/ }, () => ({ path: stubRouter }))
        build.onLoad({ filter: /\.tsx$/ }, (a) =>
          refSources.has(a.path)
            ? { contents: refSources.get(a.path), loader: "tsx", resolveDir: path.dirname(a.path) }
            : undefined,
        )
      },
    },
  ],
})

const browser = await chromium.launch({ channel: "chrome", headless: true })
const pageErrors = []
const open = async (query, viewport) => {
  const page = await browser.newPage({ viewport })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(`${pathToFileURL(path.join(outDir, "index.html")).href}?${query}`)
  return page
}

const measureDashboard = (page) =>
  page.evaluate(() => {
    const rect = (el) => el.getBoundingClientRect()
    const profile = document.querySelector('[aria-label="Profile"]')
    const newJourney = document.querySelector('[aria-label="New journey"]')
    const title = [...document.querySelectorAll('[role="heading"]')].find((e) => e.textContent === "Journeys")
    const tablist = document.querySelector('[role="tablist"]')
    // The header row: the closest element holding both header buttons.
    let headerRow = profile.parentElement
    while (!headerRow.contains(newJourney)) headerRow = headerRow.parentElement
    const bar = tablist.parentElement
    const barStyle = getComputedStyle(bar)
    const barRect = rect(bar)
    const contentTop = barRect.top + parseFloat(barStyle.paddingTop)
    const contentBottom = barRect.bottom - parseFloat(barStyle.paddingBottom)
    // The tab bar renders each icon twice (active + inactive, stacked).
    const icons = [...tablist.querySelectorAll('[role="tab"]')].map((tab) => rect(tab.querySelector("svg")))
    const labels = [...document.querySelectorAll("span")].filter((s) => /^\d+ days?$/.test(s.textContent))
    return {
      titleGap: rect(title).left - rect(profile).right,
      titleClearance: rect(newJourney).left - rect(title).right,
      leftInset: rect(profile).left - rect(headerRow).left,
      rightInset: rect(headerRow).right - rect(newJourney).right,
      buttons: [profile, newJourney].map((b) => {
        const s = getComputedStyle(b)
        return { bg: s.backgroundColor, shadow: s.boxShadow }
      }),
      barHeight: barRect.height,
      iconCenterOffsets: icons.map((r) => (r.top + r.bottom) / 2 - (contentTop + contentBottom) / 2),
      iconBottomGaps: icons.map((r) => innerHeight - r.bottom),
      labels: labels.map((label) => {
        const r = rect(label)
        const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)
        return { text: label.textContent, onTop: label.contains(hit) }
      }),
    }
  })

const results = []
const check = (name, ok, detail, guardsFix = true) => results.push({ name, ok, detail, guardsFix })

// Header (criterion 1) at three widths: mobile, narrow phone, desktop.
for (const viewport of [
  { width: 466, height: 780 },
  { width: 375, height: 780 },
  { width: 1280, height: 800 },
]) {
  const page = await open("insetBottom=0", viewport)
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 })
  await page.waitForTimeout(300)
  const m = await measureDashboard(page)
  if (shots) await page.screenshot({ path: path.join(shots, `dashboard-${viewport.width}.png`) })
  console.log(`header @${viewport.width}:`, JSON.stringify({ titleGap: m.titleGap, titleClearance: m.titleClearance, leftInset: m.leftInset, rightInset: m.rightInset }))
  const tag = `[${viewport.width}px]`
  check(`1 ${tag} title gap >= 16px`, m.titleGap >= 16, `${m.titleGap}px`)
  check(`1 ${tag} left inset >= 13px`, m.leftInset >= 13, `${m.leftInset}px`)
  check(`1 ${tag} right inset >= 13px`, m.rightInset >= 13, `${m.rightInset}px`)
  check(`1 ${tag} title clears the right button`, m.titleClearance > 0, `${m.titleClearance}px`, false)
  check(
    `1 ${tag} header buttons flat (transparent, no shadow)`,
    m.buttons.every((b) => b.bg === "rgba(0, 0, 0, 0)" && b.shadow === "none"),
    JSON.stringify(m.buttons),
    false,
  )
  if (viewport.width === 466) {
    await page.click('[aria-label="Profile"]')
    await page.click('[aria-label="New journey"]')
    const pushed = await page.evaluate(() => window.__pushed ?? [])
    check(
      "1 wrapped header buttons still navigate",
      pushed.includes("/profile") && pushed.includes("/journeys-new"),
      JSON.stringify(pushed),
      false,
    )
    results.calibration = { titleGap: m.titleGap }
  }
  await page.close()
}

// Tab bar (criterion 3) with and without a bottom safe-area inset, and the
// progress labels (criterion 4).
for (const [insetBottom, viewport] of [
  [0, { width: 466, height: 780 }],
  [34, { width: 466, height: 780 }],
  // Desktop: the tab bar switches to its beside-icon layout at >= 768px.
  [0, { width: 1280, height: 800 }],
]) {
  const page = await open(`insetBottom=${insetBottom}`, viewport)
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 })
  await page.waitForTimeout(300)
  const m = await measureDashboard(page)
  if (shots) await page.screenshot({ path: path.join(shots, `tabbar-${viewport.width}-inset${insetBottom}.png`) })
  console.log(`tab bar ${viewport.width}px inset ${insetBottom}:`, JSON.stringify({ barHeight: m.barHeight, iconCenterOffsets: m.iconCenterOffsets, iconBottomGaps: m.iconBottomGaps, labels: m.labels }))
  const tag = `[${viewport.width}px inset ${insetBottom}]`
  if (insetBottom === 0 && viewport.width === 466) {
    const labelsOnTop = (pattern) => m.labels.filter((l) => pattern.test(l.text))
    const onTop = (pattern) => labelsOnTop(pattern).length === 1 && labelsOnTop(pattern).every((l) => l.onTop)
    check("4 label on top at 0%", onTop(/^0 /), JSON.stringify(labelsOnTop(/^0 /)), false)
    check("4 label on top at 62%", onTop(/^1234 /), JSON.stringify(labelsOnTop(/^1234 /)))
    check("4 label on top at 100%", onTop(/^2000 /), JSON.stringify(labelsOnTop(/^2000 /)))
    results.calibration.iconBottomGap = m.iconBottomGaps[0]
  }
  check(
    `3 ${tag} icons centered in bar content box (±1px)`,
    m.iconCenterOffsets.length === 3 && m.iconCenterOffsets.every((d) => Math.abs(d) <= 1),
    JSON.stringify(m.iconCenterOffsets),
  )
  check(
    `3 ${tag} icon bottom gap >= ${16 + insetBottom}px`,
    m.iconBottomGaps.length === 3 && m.iconBottomGaps.every((g) => g >= 16 + insetBottom),
    JSON.stringify(m.iconBottomGaps),
  )
  await page.close()
}

// Non-tab header (criterion 2): a baseline-parity smoke check. HeaderButton is
// unchanged, so its spacing must equal main's (7px right inset). It cannot fail
// against main, and main's long titles already overlap here.
{
  const page = await open("scenario=journey", { width: 375, height: 300 })
  await page.waitForSelector('[aria-label="Delete journey"]', { timeout: 15000 })
  await page.waitForTimeout(300)
  if (shots) await page.screenshot({ path: path.join(shots, "journey-header-375.png") })
  const inset = await page.evaluate(
    () => innerWidth - document.querySelector('[aria-label="Delete journey"]').getBoundingClientRect().right,
  )
  check("2 JourneyInfoHeader Delete right inset == 7px (main)", Math.abs(inset - 7) <= 0.5, `${inset}px`, false)
  await page.close()
}
await browser.close()

console.log(`\nexpo-router ${routerVersion}${ref ? `, changed files from ${ref}` : ", working tree"}`)
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`)
if (pageErrors.length) console.log("page errors:", pageErrors)

let failed = pageErrors.length > 0
if (expectFail) {
  // Every check that guards a fix must fail on the old code, the rest must
  // still pass, and the old code must measure as the bug was reported.
  const wrong = results.filter((r) => r.ok === r.guardsFix)
  const { titleGap, iconBottomGap } = results.calibration
  const calibrated = Math.abs(titleGap - 11) <= 0.5 && iconBottomGap < 5
  console.log(`\ncalibration: title gap ${titleGap}px (expect 11), icon bottom gap ${iconBottomGap}px (expect ~3.5)`)
  for (const r of wrong) console.log(`UNEXPECTED ${r.ok ? "PASS" : "FAIL"}  ${r.name}`)
  failed ||= wrong.length > 0 || !calibrated
  console.log(failed ? "\nEXPECT-FAIL RUN: harness did NOT discriminate" : "\nEXPECT-FAIL RUN: old code fails every fix check, as expected")
} else {
  failed ||= results.some((r) => !r.ok)
  console.log(failed ? "\nFAILED" : "\nALL PASSED")
}
process.exit(failed ? 1 : 0)
