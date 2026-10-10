/**
 * Checks the typography and padding props the real ChatInput passes to its
 * TextArea on iOS, Android and web (stubbed react-native + tamagui, as in
 * 2026-10-10-chat-input-native-autosize/verify-chat-input-native-props.mjs).
 * It checks ChatInput's own prop choices only; native layout is not exercised.
 *
 * Run from the repo root after `npm ci`:
 *
 *   node .minerva/work/2026-10-10-chat-input-alignment/verify-chat-input-alignment-props.mjs
 *
 * `--component <path>` checks another ChatInput file (e.g. the pre-change one,
 * saved next to the original so its imports resolve); it must fail there.
 */
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const appRoot = path.join(repoRoot, "packages/app")
const require = createRequire(path.join(repoRoot, "package.json"))
const esbuild = require("esbuild")

const args = process.argv.slice(2)
const componentArg = args.indexOf("--component")
const component = path.resolve(
  componentArg >= 0
    ? args[componentArg + 1]
    : path.join(appRoot, "src/components/pages/SponsorPage/ChatInput/ChatInput.tsx"),
)

const dir = mkdtempSync(path.join(tmpdir(), "chat-input-props-"))
const stub = (name, code) => {
  const file = path.join(dir, `${name}.jsx`)
  writeFileSync(file, code)
  return file
}
const rnStub = stub(
  "react-native",
  `export const Platform = { get OS() { return globalThis.__OS } }`,
)
const tamaguiStub = stub(
  "tamagui",
  `import React from "react"
const Box = ({ children }) => <div>{children}</div>
export const XStack = Box
export const YStack = Box
export const Button = () => <button />
export const TextArea = React.forwardRef((props, ref) => {
  globalThis.__textAreaProps = props
  return <textarea />
})`,
)
const iconStub = stub("icons", `export const Send = () => null; export const Square = () => null`)
const entry = stub(
  "entry",
  `import React from "react"
import { renderToString } from "react-dom/server"
import { ChatInput } from ${JSON.stringify(component)}
export function propsFor(os) {
  globalThis.__OS = os
  globalThis.__textAreaProps = undefined
  renderToString(<ChatInput onSend={async () => true} bottomPadding="$3" />)
  return globalThis.__textAreaProps
}`,
)
const outfile = path.join(dir, "bundle.cjs")
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  absWorkingDir: appRoot,
  nodePaths: [path.join(repoRoot, "node_modules")],
  alias: { "react-native": rnStub, tamagui: tamaguiStub, "@tamagui/lucide-icons": iconStub },
  define: { __DEV__: "true" },
  jsx: "automatic",
  logLevel: "error",
})
const { propsFor } = createRequire(outfile)(outfile)

const results = []
const check = (name, fn) => {
  try {
    fn()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`)
  }
}
const typography = (props) =>
  Object.fromEntries(
    ["fontSize", "lineHeight", "paddingVertical", "paddingHorizontal"].map((key) => [key, props[key]]),
  )
const expected = { fontSize: 16, lineHeight: 20, paddingVertical: 11, paddingHorizontal: 14 }

for (const os of ["ios", "android", "web"]) {
  const props = propsFor(os)
  check(`${os}: explicit typography/padding ${JSON.stringify(typography(props))}`, () => {
    assert.deepEqual(typography(props), expected)
  })
}
// One line of the component's own values = padding x2 + line + 1px border x2
// = its 44px native floor, the Send button's Tamagui $true height.
for (const os of ["ios", "android"]) {
  const props = propsFor(os)
  check(`${os}: one line sums to minHeight 44, no Android font padding`, () => {
    assert.equal(2 * props.paddingVertical + props.lineHeight + 2, 44)
    assert.equal(props.minHeight, 44)
    assert.equal(props.includeFontPadding, false)
  })
}

rmSync(dir, { recursive: true, force: true })
console.log(results.join("\n"))
process.exit(results.every((line) => line.startsWith("PASS")) ? 0 : 1)
