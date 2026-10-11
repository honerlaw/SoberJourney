/**
 * The runtime fingerprint decides which native builds an EAS Update can reach
 * (app.json runtimeVersion policy "fingerprint").
 *
 * `extra` is skipped because it is JS-only (read via Constants.expoConfig) and
 * every update ships its own copy in its manifest, while app.config.ts derives
 * extra.apiUrl from NODE_ENV, which would otherwise make the hash depend on the
 * environment it is computed in (CI vs EAS Build vs `eas update`).
 * Never put native-affecting config in `extra`.
 *
 * @type {import('expo/fingerprint').Config}
 */
const config = {
  sourceSkips: ["ExpoConfigExtraSection"],
}

module.exports = config
