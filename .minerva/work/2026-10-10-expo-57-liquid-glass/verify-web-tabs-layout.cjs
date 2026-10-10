// Asks expo-router's own route resolver which (tabs) layout file each platform uses.
// Usage: node verify-web-tabs-layout.cjs <path to packages/app>
// Relies on expo-router 57's internal getRoutesCore / require-context-ponyfill.
const path = require("path")
const app = path.resolve(process.argv[2] || ".")
const { getRoutes } = require(path.join(app, "node_modules/expo-router/build/getRoutesCore"))
const requireContext = require(path.join(app, "node_modules/expo-router/build/testing-library/require-context-ponyfill")).default
const ctx = requireContext(path.join(app, "src/app"), true, /\.[tj]sx?$/)
// Modules are never executed: only keys matter for resolution.
const lazyCtx = Object.assign((k) => ({ default: () => null }), { keys: ctx.keys, resolve: ctx.resolve, id: "x" })
function find(node, out = []) {
  if (node.contextKey && node.contextKey.includes("(tabs)/_layout")) out.push(node.contextKey)
  for (const c of node.children || []) find(c, out)
  return out
}
for (const platform of ["web", "ios", "android"]) {
  const tree = getRoutes(lazyCtx, { platform, platformRoutes: true, skipGenerated: true, importMode: "sync" })
  console.log(platform, "→", find(tree).join(", "))
}
