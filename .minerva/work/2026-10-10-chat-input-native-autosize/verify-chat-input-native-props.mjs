/**
 * Checks which sizing props the real ChatInput passes to its TextArea on
 * native vs web.
 *
 * packages/app has no test runner and no simulator was available, so this
 * bundles ChatInput with esbuild against small stubs: `react-native` exposes
 * a switchable `Platform.OS`, and `tamagui` records the props its `TextArea`
 * receives. It renders once per platform with react-dom/server.
 *
 * Run from the repo root after `npm ci`:
 *
 *   node .minerva/work/2026-10-10-chat-input-native-autosize/verify-chat-input-native-props.mjs
 */
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const appRoot = path.join(repoRoot, "packages/app")
const require = createRequire(path.join(repoRoot, "package.json"))
const esbuild = require("esbuild")

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
import { ChatInput } from ${JSON.stringify(path.join(appRoot, "src/components/pages/SponsorPage/ChatInput/ChatInput.tsx"))}
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
const sizing = (props) =>
  Object.fromEntries(
    ["height", "minHeight", "maxHeight", "onContentSizeChange", "onLayout", "scrollEnabled"]
      .filter((key) => key in props)
      .map((key) => [key, typeof props[key] === "function" ? "fn" : props[key]]),
  )

for (const os of ["ios", "android"]) {
  const props = propsFor(os)
  check(`${os}: auto-sizes between 44 and 140, no JS height feedback ${JSON.stringify(sizing(props))}`, () => {
    assert.deepEqual(sizing(props), { minHeight: 44, maxHeight: 140 })
    assert.equal(props.rows, undefined)
    assert.equal(props.numberOfLines, undefined)
  })
}
const web = propsFor("web")
check(`web: measured height + onLayout, no onContentSizeChange ${JSON.stringify(sizing(web))}`, () => {
  assert.deepEqual(sizing(web), { height: 44, onLayout: "fn" })
})

console.log(results.join("\n"))
process.exit(results.every((line) => line.startsWith("PASS")) ? 0 : 1)
